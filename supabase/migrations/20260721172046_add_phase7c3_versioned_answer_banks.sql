create extension if not exists unaccent with schema extensions;

create table private.category_answer_bank_versions (
  id uuid primary key default gen_random_uuid(),
  category_draft_id uuid not null references private.category_drafts(id) on delete restrict,
  revision integer not null check (revision > 0),
  editor_user_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'editing' check (status in ('editing', 'review-ready')),
  snapshot_date date,
  time_limit_seconds integer check (time_limit_seconds between 10 and 600),
  source_label text check (
    source_label is null or (
      char_length(source_label) between 3 and 160
      and source_label = regexp_replace(btrim(source_label), '[[:space:]]+', ' ', 'g')
      and source_label !~ '[[:cntrl:]]'
    )
  ),
  source_url text check (
    source_url is null or (
      char_length(source_url) between 12 and 500
      and source_url ~ '^https://[^[:space:]]+$'
      and source_url !~ '[[:cntrl:]]'
    )
  ),
  version_note text check (
    version_note is null or (
      char_length(version_note) between 8 and 500
      and version_note = regexp_replace(btrim(version_note), '[[:space:]]+', ' ', 'g')
      and version_note !~ '[[:cntrl:]]'
    )
  ),
  competitive_eligible boolean not null default false check (not competitive_eligible),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  submitted_at timestamptz,
  unique (category_draft_id, revision),
  check (
    (status = 'editing' and submitted_at is null)
    or (status = 'review-ready' and submitted_at is not null)
  ),
  check (updated_at >= created_at),
  check (submitted_at is null or submitted_at >= created_at)
);

create unique index category_answer_bank_one_editing_idx
  on private.category_answer_bank_versions (category_draft_id)
  where status = 'editing';

create index category_answer_bank_draft_revision_idx
  on private.category_answer_bank_versions (category_draft_id, revision desc);

create table private.category_answer_bank_answers (
  id uuid primary key default gen_random_uuid(),
  bank_version_id uuid not null references private.category_answer_bank_versions(id) on delete restrict,
  stable_id text not null check (
    char_length(stable_id) between 1 and 160
    and stable_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  canonical_text text not null check (
    char_length(canonical_text) between 1 and 160
    and canonical_text = regexp_replace(btrim(canonical_text), '[[:space:]]+', ' ', 'g')
    and canonical_text !~ '[[:cntrl:]]'
  ),
  normalized_text text not null check (char_length(normalized_text) between 1 and 160),
  sort_order integer not null check (sort_order >= 0),
  unique (bank_version_id, stable_id),
  unique (bank_version_id, normalized_text),
  unique (bank_version_id, sort_order),
  unique (bank_version_id, id)
);

create table private.category_answer_bank_aliases (
  bank_version_id uuid not null references private.category_answer_bank_versions(id) on delete restrict,
  answer_id uuid not null,
  alias_text text not null check (
    char_length(alias_text) between 1 and 160
    and alias_text = regexp_replace(btrim(alias_text), '[[:space:]]+', ' ', 'g')
    and alias_text !~ '[[:cntrl:]]'
  ),
  normalized_alias text not null check (char_length(normalized_alias) between 1 and 160),
  primary key (bank_version_id, normalized_alias),
  foreign key (bank_version_id, answer_id)
    references private.category_answer_bank_answers(bank_version_id, id)
    on delete restrict
);

alter table private.category_answer_bank_versions enable row level security;
alter table private.category_answer_bank_answers enable row level security;
alter table private.category_answer_bank_aliases enable row level security;

revoke all on table private.category_answer_bank_versions from public, anon, authenticated;
revoke all on table private.category_answer_bank_answers from public, anon, authenticated;
revoke all on table private.category_answer_bank_aliases from public, anon, authenticated;

create function private.category_bank_normalize(p_value text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select btrim(
    regexp_replace(
      regexp_replace(
        lower(extensions.unaccent('extensions.unaccent', translate(
          normalize(p_value, NFKD),
          '‐‑‒–—―’‘`´',
          '          '
        ))),
        '[^a-z0-9[:space:]]',
        ' ',
        'g'
      ),
      '[[:space:]]+',
      ' ',
      'g'
    )
  );
$$;

create function private.category_bank_payload(p_version_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'draftId', draft.id,
    'prompt', draft.prompt,
    'sourceNotes', draft.source_notes,
    'coverageNotes', draft.coverage_notes,
    'revision', version.revision,
    'status', version.status,
    'snapshotDate', version.snapshot_date,
    'timeLimitSeconds', version.time_limit_seconds,
    'sourceLabel', version.source_label,
    'sourceUrl', version.source_url,
    'versionNote', version.version_note,
    'competitiveEligible', version.competitive_eligible,
    'updatedAt', version.updated_at,
    'submittedAt', version.submitted_at,
    'answers', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'canonicalText', answer.canonical_text,
          'aliases', coalesce((
            select jsonb_agg(alias.alias_text order by alias.normalized_alias)
            from private.category_answer_bank_aliases as alias
            where alias.bank_version_id = answer.bank_version_id
              and alias.answer_id = answer.id
          ), '[]'::jsonb)
        )
        order by answer.sort_order
      )
      from private.category_answer_bank_answers as answer
      where answer.bank_version_id = version.id
    ), '[]'::jsonb)
  )
  from private.category_answer_bank_versions as version
  join private.category_drafts as draft on draft.id = version.category_draft_id
  where version.id = p_version_id;
$$;

create function private.category_bank_replace_answers(
  p_version_id uuid,
  p_answers jsonb
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  answer_value jsonb;
  alias_value jsonb;
  canonical_value text;
  normalized_value text;
  alias_text_value text;
  stable_value text;
  answer_id uuid;
  answer_index integer := 0;
  alias_count integer;
  seen_values text[] := array[]::text[];
begin
  if p_answers is null
    or jsonb_typeof(p_answers) <> 'array'
    or jsonb_array_length(p_answers) not between 1 and 500
  then
    raise invalid_parameter_value using message = 'Invalid answer bank.';
  end if;

  delete from private.category_answer_bank_aliases where bank_version_id = p_version_id;
  delete from private.category_answer_bank_answers where bank_version_id = p_version_id;

  for answer_value in select value from jsonb_array_elements(p_answers)
  loop
    if jsonb_typeof(answer_value) <> 'object'
      or jsonb_typeof(answer_value -> 'canonicalText') <> 'string'
      or jsonb_typeof(answer_value -> 'aliases') <> 'array'
      or jsonb_array_length(answer_value -> 'aliases') > 20
    then
      raise invalid_parameter_value using message = 'Invalid answer bank.';
    end if;

    canonical_value := regexp_replace(btrim(answer_value ->> 'canonicalText'), '[[:space:]]+', ' ', 'g');
    if canonical_value = ''
      or char_length(canonical_value) > 160
      or canonical_value ~ '[[:cntrl:]]'
    then
      raise invalid_parameter_value using message = 'Invalid canonical answer.';
    end if;

    normalized_value := private.category_bank_normalize(canonical_value);
    if normalized_value = '' or normalized_value = any(seen_values) then
      raise invalid_parameter_value using message = 'Answer or alias collision.';
    end if;
    seen_values := array_append(seen_values, normalized_value);
    stable_value := replace(normalized_value, ' ', '-');

    insert into private.category_answer_bank_answers (
      bank_version_id,
      stable_id,
      canonical_text,
      normalized_text,
      sort_order
    ) values (
      p_version_id,
      stable_value,
      canonical_value,
      normalized_value,
      answer_index
    ) returning id into answer_id;

    alias_count := 0;
    for alias_value in select value from jsonb_array_elements(answer_value -> 'aliases')
    loop
      if jsonb_typeof(alias_value) <> 'string' then
        raise invalid_parameter_value using message = 'Invalid answer alias.';
      end if;
      alias_text_value := regexp_replace(btrim(alias_value #>> '{}'), '[[:space:]]+', ' ', 'g');
      if alias_text_value = ''
        or char_length(alias_text_value) > 160
        or alias_text_value ~ '[[:cntrl:]]'
      then
        raise invalid_parameter_value using message = 'Invalid answer alias.';
      end if;
      normalized_value := private.category_bank_normalize(alias_text_value);
      if normalized_value = '' or normalized_value = any(seen_values) then
        raise invalid_parameter_value using message = 'Answer or alias collision.';
      end if;
      seen_values := array_append(seen_values, normalized_value);
      insert into private.category_answer_bank_aliases (
        bank_version_id,
        answer_id,
        alias_text,
        normalized_alias
      ) values (
        p_version_id,
        answer_id,
        alias_text_value,
        normalized_value
      );
      alias_count := alias_count + 1;
    end loop;
    answer_index := answer_index + 1;
  end loop;
end;
$$;

create function public.category_bank_queue()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  v_now timestamptz := statement_timestamp();
  queue_payload jsonb;
begin
  if current_user_id is null then
    raise insufficient_privilege using message = 'Authentication required.';
  end if;
  if not exists (
    select 1 from private.category_reviewers as reviewer
    where reviewer.user_id = current_user_id and reviewer.active
  ) then
    raise insufficient_privilege using message = 'Reviewer authorization required.';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'draftId', queued.id,
      'prompt', queued.prompt,
      'sourceNotes', queued.source_notes,
      'coverageNotes', queued.coverage_notes,
      'revision', coalesce(queued.revision, 0),
      'status', coalesce(queued.bank_status, 'not-started'),
      'available', queued.editor_user_id is null or queued.editor_user_id = current_user_id,
      'bank', case
        when queued.version_id is not null
          and (queued.bank_status = 'review-ready' or queued.editor_user_id = current_user_id)
        then private.category_bank_payload(queued.version_id)
        else null
      end
    ) order by queued.prompt, queued.id
  ), '[]'::jsonb) into queue_payload
  from (
    select
      draft.*,
      latest.id as version_id,
      latest.revision,
      latest.status as bank_status,
      latest.editor_user_id
    from private.category_drafts as draft
    left join lateral (
      select version.*
      from private.category_answer_bank_versions as version
      where version.category_draft_id = draft.id
      order by version.revision desc
      limit 1
    ) as latest on true
    where draft.status = 'review-complete'
      and draft.review_status = 'scope-approved'
      and draft.user_id <> current_user_id
    order by draft.prompt, draft.id
    limit 50
  ) as queued;

  return jsonb_build_object('serverNow', v_now, 'authorized', true, 'drafts', queue_payload);
end;
$$;

create function public.category_bank_open(p_draft_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  selected_draft private.category_drafts%rowtype;
  selected_version private.category_answer_bank_versions%rowtype;
begin
  if current_user_id is null then raise insufficient_privilege using message = 'Authentication required.'; end if;
  if not exists (
    select 1 from private.category_reviewers as reviewer
    where reviewer.user_id = current_user_id and reviewer.active
  ) then raise insufficient_privilege using message = 'Reviewer authorization required.'; end if;

  select draft.* into selected_draft
  from private.category_drafts as draft
  where draft.id = p_draft_id and draft.user_id <> current_user_id
  for update;
  if selected_draft.id is null then raise invalid_parameter_value using message = 'Invalid category bank.'; end if;
  if selected_draft.status <> 'review-complete' or selected_draft.review_status <> 'scope-approved' then
    raise object_not_in_prerequisite_state using message = 'Category scope is not approved.';
  end if;

  select version.* into selected_version
  from private.category_answer_bank_versions as version
  where version.category_draft_id = selected_draft.id
  order by version.revision desc
  limit 1
  for update;

  if selected_version.id is null then
    insert into private.category_answer_bank_versions (category_draft_id, revision, editor_user_id)
    values (selected_draft.id, 1, current_user_id)
    returning * into selected_version;
  elsif selected_version.status = 'editing' and selected_version.editor_user_id <> current_user_id then
    raise object_not_in_prerequisite_state using message = 'Answer bank is being edited.';
  end if;
  return private.category_bank_payload(selected_version.id);
end;
$$;

create function public.category_bank_save(
  p_draft_id uuid,
  p_snapshot_date date,
  p_time_limit_seconds integer,
  p_source_label text,
  p_source_url text,
  p_version_note text,
  p_answers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  v_now timestamptz := statement_timestamp();
  normalized_label text;
  normalized_note text;
  selected_version private.category_answer_bank_versions%rowtype;
begin
  if current_user_id is null then raise insufficient_privilege using message = 'Authentication required.'; end if;
  if not exists (
    select 1 from private.category_reviewers as reviewer
    where reviewer.user_id = current_user_id and reviewer.active
  ) then raise insufficient_privilege using message = 'Reviewer authorization required.'; end if;
  if p_draft_id is null or p_snapshot_date is null
    or p_time_limit_seconds not between 10 and 600
    or p_source_label is null or p_source_label ~ '[[:cntrl:]]'
    or p_source_url is null or p_source_url !~ '^https://[^[:space:]]+$' or p_source_url ~ '[[:cntrl:]]'
    or p_version_note is null or p_version_note ~ '[[:cntrl:]]'
  then raise invalid_parameter_value using message = 'Invalid answer bank metadata.'; end if;
  normalized_label := regexp_replace(btrim(p_source_label), '[[:space:]]+', ' ', 'g');
  normalized_note := regexp_replace(btrim(p_version_note), '[[:space:]]+', ' ', 'g');
  if char_length(normalized_label) not between 3 and 160
    or char_length(p_source_url) not between 12 and 500
    or char_length(normalized_note) not between 8 and 500
  then raise invalid_parameter_value using message = 'Invalid answer bank metadata.'; end if;

  select version.* into selected_version
  from private.category_answer_bank_versions as version
  where version.category_draft_id = p_draft_id
  order by version.revision desc
  limit 1
  for update;
  if selected_version.id is null then raise invalid_parameter_value using message = 'Invalid category bank.'; end if;
  if selected_version.status <> 'editing' or selected_version.editor_user_id <> current_user_id then
    raise object_not_in_prerequisite_state using message = 'Answer bank editing is locked.';
  end if;

  perform private.category_bank_replace_answers(selected_version.id, p_answers);
  update private.category_answer_bank_versions as version set
    snapshot_date = p_snapshot_date,
    time_limit_seconds = p_time_limit_seconds,
    source_label = normalized_label,
    source_url = p_source_url,
    version_note = normalized_note,
    updated_at = v_now
  where version.id = selected_version.id;
  return private.category_bank_payload(selected_version.id);
end;
$$;

create function public.category_bank_freeze(p_draft_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  v_now timestamptz := statement_timestamp();
  selected_version private.category_answer_bank_versions%rowtype;
begin
  if current_user_id is null then raise insufficient_privilege using message = 'Authentication required.'; end if;
  if not exists (
    select 1 from private.category_reviewers as reviewer
    where reviewer.user_id = current_user_id and reviewer.active
  ) then raise insufficient_privilege using message = 'Reviewer authorization required.'; end if;
  select version.* into selected_version
  from private.category_answer_bank_versions as version
  where version.category_draft_id = p_draft_id
  order by version.revision desc
  limit 1
  for update;
  if selected_version.id is null then raise invalid_parameter_value using message = 'Invalid category bank.'; end if;
  if selected_version.status <> 'editing' or selected_version.editor_user_id <> current_user_id then
    raise object_not_in_prerequisite_state using message = 'Answer bank editing is locked.';
  end if;
  if selected_version.snapshot_date is null or selected_version.time_limit_seconds is null
    or selected_version.source_label is null or selected_version.source_url is null
    or selected_version.version_note is null
    or (select count(*) from private.category_answer_bank_answers as answer where answer.bank_version_id = selected_version.id) < 2
  then raise object_not_in_prerequisite_state using message = 'Answer bank is not ready for review.'; end if;

  update private.category_answer_bank_versions as version set
    status = 'review-ready', updated_at = v_now, submitted_at = v_now
  where version.id = selected_version.id;
  return private.category_bank_payload(selected_version.id);
end;
$$;

create function public.category_bank_start_revision(p_draft_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  source_version private.category_answer_bank_versions%rowtype;
  next_version private.category_answer_bank_versions%rowtype;
begin
  if current_user_id is null then raise insufficient_privilege using message = 'Authentication required.'; end if;
  if not exists (
    select 1 from private.category_reviewers as reviewer
    where reviewer.user_id = current_user_id and reviewer.active
  ) then raise insufficient_privilege using message = 'Reviewer authorization required.'; end if;
  select version.* into source_version
  from private.category_answer_bank_versions as version
  join private.category_drafts as draft on draft.id = version.category_draft_id
  where version.category_draft_id = p_draft_id and draft.user_id <> current_user_id
  order by version.revision desc
  limit 1
  for update of version;
  if source_version.id is null then raise invalid_parameter_value using message = 'Invalid category bank.'; end if;
  if source_version.status <> 'review-ready' then
    raise object_not_in_prerequisite_state using message = 'Answer bank already has an editing revision.';
  end if;

  insert into private.category_answer_bank_versions (
    category_draft_id, revision, editor_user_id, snapshot_date, time_limit_seconds,
    source_label, source_url, version_note
  ) values (
    source_version.category_draft_id, source_version.revision + 1, current_user_id,
    source_version.snapshot_date, source_version.time_limit_seconds,
    source_version.source_label, source_version.source_url, source_version.version_note
  ) returning * into next_version;

  insert into private.category_answer_bank_answers (
    id, bank_version_id, stable_id, canonical_text, normalized_text, sort_order
  ) select gen_random_uuid(), next_version.id, answer.stable_id, answer.canonical_text,
      answer.normalized_text, answer.sort_order
    from private.category_answer_bank_answers as answer
    where answer.bank_version_id = source_version.id;

  insert into private.category_answer_bank_aliases (
    bank_version_id, answer_id, alias_text, normalized_alias
  ) select next_version.id, next_answer.id, alias.alias_text, alias.normalized_alias
    from private.category_answer_bank_aliases as alias
    join private.category_answer_bank_answers as source_answer
      on source_answer.bank_version_id = source_version.id and source_answer.id = alias.answer_id
    join private.category_answer_bank_answers as next_answer
      on next_answer.bank_version_id = next_version.id and next_answer.stable_id = source_answer.stable_id;

  return private.category_bank_payload(next_version.id);
end;
$$;

revoke all on function private.category_bank_normalize(text) from public, anon, authenticated;
revoke all on function private.category_bank_payload(uuid) from public, anon, authenticated;
revoke all on function private.category_bank_replace_answers(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.category_bank_queue() from public, anon, authenticated;
revoke all on function public.category_bank_open(uuid) from public, anon, authenticated;
revoke all on function public.category_bank_save(uuid, date, integer, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.category_bank_freeze(uuid) from public, anon, authenticated;
revoke all on function public.category_bank_start_revision(uuid) from public, anon, authenticated;

grant execute on function public.category_bank_queue() to authenticated;
grant execute on function public.category_bank_open(uuid) to authenticated;
grant execute on function public.category_bank_save(uuid, date, integer, text, text, text, jsonb) to authenticated;
grant execute on function public.category_bank_freeze(uuid) to authenticated;
grant execute on function public.category_bank_start_revision(uuid) to authenticated;
