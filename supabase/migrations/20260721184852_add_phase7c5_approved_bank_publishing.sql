alter table private.category_answers
  drop constraint category_answers_canonical_text_check,
  add constraint category_answers_canonical_text_check check (
    char_length(canonical_text) between 1 and 160
    and canonical_text = regexp_replace(btrim(canonical_text), '[[:space:]]+', ' ', 'g')
    and canonical_text !~ '[[:cntrl:]]'
  );

alter table private.category_answer_aliases
  drop constraint category_answer_aliases_normalized_alias_check,
  add constraint category_answer_aliases_normalized_alias_check check (
    char_length(normalized_alias) between 1 and 160
    and normalized_alias = btrim(normalized_alias)
    and normalized_alias !~ '[[:cntrl:]]'
  );

create table private.category_publishers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active boolean not null default true,
  granted_at timestamptz not null default statement_timestamp()
);

create table private.category_answer_bank_publications (
  id uuid primary key default gen_random_uuid(),
  category_draft_id uuid not null unique references private.category_drafts(id) on delete restrict,
  bank_version_id uuid not null unique references private.category_answer_bank_versions(id) on delete restrict,
  category_version_id uuid not null unique references private.category_versions(id) on delete restrict,
  publisher_user_id uuid not null references auth.users(id) on delete restrict,
  slug text not null unique check (
    char_length(slug) between 3 and 80
    and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  title_snapshot text not null check (
    char_length(title_snapshot) between 2 and 120
    and title_snapshot = regexp_replace(btrim(title_snapshot), '[[:space:]]+', ' ', 'g')
    and title_snapshot !~ '[[:cntrl:]]'
  ),
  summary_snapshot text not null check (
    char_length(summary_snapshot) between 8 and 240
    and summary_snapshot = regexp_replace(btrim(summary_snapshot), '[[:space:]]+', ' ', 'g')
    and summary_snapshot !~ '[[:cntrl:]]'
  ),
  coverage_note_snapshot text not null check (
    char_length(coverage_note_snapshot) between 8 and 300
    and coverage_note_snapshot = regexp_replace(btrim(coverage_note_snapshot), '[[:space:]]+', ' ', 'g')
    and coverage_note_snapshot !~ '[[:cntrl:]]'
  ),
  answers_snapshot jsonb not null check (jsonb_typeof(answers_snapshot) = 'array'),
  published_at timestamptz not null default statement_timestamp(),
  availability text not null default 'practice' check (availability = 'practice'),
  competitive_eligible boolean not null default false check (not competitive_eligible)
);

create index category_answer_bank_publications_publisher_idx
  on private.category_answer_bank_publications (publisher_user_id, published_at desc);

alter table private.category_publishers enable row level security;
alter table private.category_answer_bank_publications enable row level security;

revoke all on table private.category_publishers from public, anon, authenticated;
revoke all on table private.category_answer_bank_publications from public, anon, authenticated;

create function public.category_publisher_status()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  v_now timestamptz := statement_timestamp();
begin
  if current_user_id is null then
    raise insufficient_privilege using message = 'Authentication required.';
  end if;

  return jsonb_build_object(
    'serverNow', v_now,
    'authorized', exists (
      select 1
      from private.category_publishers as publisher
      where publisher.user_id = current_user_id and publisher.active
    )
  );
end;
$$;

create function public.category_publication_queue()
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
    select 1 from private.category_publishers as publisher
    where publisher.user_id = current_user_id and publisher.active
  ) then
    raise insufficient_privilege using message = 'Publisher authorization required.';
  end if;

  select coalesce(
    jsonb_agg(private.category_bank_payload(queued.id) order by queued.updated_at asc, queued.id asc),
    '[]'::jsonb
  ) into queue_payload
  from (
    select version.id, version.updated_at
    from private.category_answer_bank_versions as version
    join private.category_drafts as draft on draft.id = version.category_draft_id
    join private.category_answer_bank_reviews as review on review.bank_version_id = version.id
    left join private.category_answer_bank_publications as publication on publication.bank_version_id = version.id
    where version.status = 'review-ready'
      and version.bank_review_status = 'approved'
      and review.decision = 'approve'
      and publication.id is null
      and draft.user_id <> current_user_id
      and version.editor_user_id <> current_user_id
      and review.reviewer_user_id <> current_user_id
    order by version.updated_at asc, version.id asc
    limit 50
  ) as queued;

  return jsonb_build_object('serverNow', v_now, 'authorized', true, 'banks', queue_payload);
end;
$$;

create function public.category_publish_approved_bank(
  p_draft_id uuid,
  p_slug text,
  p_title text,
  p_summary text,
  p_coverage_note text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  v_now timestamptz := statement_timestamp();
  normalized_slug text;
  normalized_title text;
  normalized_summary text;
  normalized_coverage_note text;
  selected_draft private.category_drafts%rowtype;
  selected_version private.category_answer_bank_versions%rowtype;
  selected_review private.category_answer_bank_reviews%rowtype;
  created_category_version_id uuid := gen_random_uuid();
  created_publication_id uuid;
  next_sort_order integer;
  answer_count integer;
  accepted_name_count integer;
begin
  if current_user_id is null then
    raise insufficient_privilege using message = 'Authentication required.';
  end if;
  if not exists (
    select 1 from private.category_publishers as publisher
    where publisher.user_id = current_user_id and publisher.active
  ) then
    raise insufficient_privilege using message = 'Publisher authorization required.';
  end if;
  if p_draft_id is null or p_slug is null or p_title is null or p_summary is null or p_coverage_note is null
    or p_slug ~ '[[:cntrl:]]' or p_title ~ '[[:cntrl:]]'
    or p_summary ~ '[[:cntrl:]]' or p_coverage_note ~ '[[:cntrl:]]'
  then
    raise invalid_parameter_value using message = 'Invalid category publication.';
  end if;

  normalized_slug := lower(btrim(p_slug));
  normalized_title := regexp_replace(btrim(p_title), '[[:space:]]+', ' ', 'g');
  normalized_summary := regexp_replace(btrim(p_summary), '[[:space:]]+', ' ', 'g');
  normalized_coverage_note := regexp_replace(btrim(p_coverage_note), '[[:space:]]+', ' ', 'g');

  if char_length(normalized_slug) not between 3 and 80
    or normalized_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    or char_length(normalized_title) not between 2 and 120
    or char_length(normalized_summary) not between 8 and 240
    or char_length(normalized_coverage_note) not between 8 and 300
  then
    raise invalid_parameter_value using message = 'Invalid category publication.';
  end if;

  select draft.* into selected_draft
  from private.category_drafts as draft
  where draft.id = p_draft_id
  for update;
  if selected_draft.id is null then
    raise invalid_parameter_value using message = 'Invalid category publication.';
  end if;

  select version.* into selected_version
  from private.category_answer_bank_versions as version
  where version.category_draft_id = selected_draft.id
  order by version.revision desc
  limit 1
  for update;

  if selected_version.id is null
    or selected_version.status <> 'review-ready'
    or selected_version.bank_review_status <> 'approved'
    or selected_draft.user_id = current_user_id
    or selected_version.editor_user_id = current_user_id
  then
    raise object_not_in_prerequisite_state using message = 'Approved bank is not publishable.';
  end if;

  select review.* into selected_review
  from private.category_answer_bank_reviews as review
  where review.bank_version_id = selected_version.id
  for share;

  if selected_review.id is null
    or selected_review.decision <> 'approve'
    or selected_review.reviewer_user_id = current_user_id
  then
    raise object_not_in_prerequisite_state using message = 'Approved bank is not independently publishable.';
  end if;
  if exists (
    select 1 from private.category_answer_bank_publications as publication
    where publication.category_draft_id = selected_draft.id
  ) then
    raise object_not_in_prerequisite_state using message = 'Category bank is already published.';
  end if;

  select count(*)::integer into answer_count
  from private.category_answer_bank_answers as answer
  where answer.bank_version_id = selected_version.id;
  select answer_count + count(*)::integer into accepted_name_count
  from private.category_answer_bank_aliases as alias
  where alias.bank_version_id = selected_version.id;
  if answer_count < 2 then
    raise object_not_in_prerequisite_state using message = 'Approved bank has no publishable answers.';
  end if;

  lock table private.category_discovery_items in share row exclusive mode;
  if exists (
    select 1 from private.category_versions as category where category.slug = normalized_slug
  ) or exists (
    select 1 from private.category_discovery_items as item where item.slug = normalized_slug
  ) then
    raise unique_violation using message = 'Category slug is already in use.';
  end if;
  select coalesce(max(item.sort_order), -1) + 1 into next_sort_order
  from private.category_discovery_items as item;

  insert into private.category_versions (
    id, slug, version, snapshot_date, title, prompt, time_limit_seconds
  ) values (
    created_category_version_id, normalized_slug, 1, selected_version.snapshot_date,
    normalized_title, selected_draft.prompt, selected_version.time_limit_seconds
  );

  insert into private.category_answers (
    id, category_version_id, stable_id, canonical_text, team_code, sort_order, visual_label, group_ids
  )
  select gen_random_uuid(), created_category_version_id, answer.stable_id,
    answer.canonical_text, null, answer.sort_order, null, '{}'::text[]
  from private.category_answer_bank_answers as answer
  where answer.bank_version_id = selected_version.id
  order by answer.sort_order;

  insert into private.category_answer_aliases (category_version_id, normalized_alias, answer_id)
  select created_category_version_id, bank_answer.normalized_text, published_answer.id
  from private.category_answer_bank_answers as bank_answer
  join private.category_answers as published_answer
    on published_answer.category_version_id = created_category_version_id
    and published_answer.stable_id = bank_answer.stable_id
  where bank_answer.bank_version_id = selected_version.id;

  insert into private.category_answer_aliases (category_version_id, normalized_alias, answer_id)
  select created_category_version_id, bank_alias.normalized_alias, published_answer.id
  from private.category_answer_bank_aliases as bank_alias
  join private.category_answer_bank_answers as bank_answer
    on bank_answer.bank_version_id = bank_alias.bank_version_id and bank_answer.id = bank_alias.answer_id
  join private.category_answers as published_answer
    on published_answer.category_version_id = created_category_version_id
    and published_answer.stable_id = bank_answer.stable_id
  where bank_alias.bank_version_id = selected_version.id;

  insert into private.category_discovery_items (
    slug, category_version_id, title, prompt, summary, review_status, availability,
    competitive_eligible, source_label, coverage_note, sort_order
  ) values (
    normalized_slug, created_category_version_id, normalized_title, selected_draft.prompt,
    normalized_summary, 'reviewed', 'practice', false, selected_version.source_label,
    normalized_coverage_note, next_sort_order
  );

  insert into private.category_answer_bank_publications (
    category_draft_id, bank_version_id, category_version_id, publisher_user_id,
    slug, title_snapshot, summary_snapshot, coverage_note_snapshot, answers_snapshot,
    published_at
  ) values (
    selected_draft.id, selected_version.id, created_category_version_id, current_user_id,
    normalized_slug, normalized_title, normalized_summary, normalized_coverage_note,
    private.category_bank_payload(selected_version.id) -> 'answers', v_now
  ) returning id into created_publication_id;

  return jsonb_build_object(
    'publicationId', created_publication_id,
    'draftId', selected_draft.id,
    'bankRevision', selected_version.revision,
    'slug', normalized_slug,
    'categoryVersion', 1,
    'answerCount', answer_count,
    'acceptedNameCount', accepted_name_count,
    'publishedAt', v_now,
    'availability', 'practice',
    'competitiveEligible', false
  );
end;
$$;

create function public.category_practice_get(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_slug text;
  practice_payload jsonb;
begin
  if current_user_id is null then
    raise insufficient_privilege using message = 'Authentication required.';
  end if;
  if p_slug is null or p_slug ~ '[[:cntrl:]]' then
    raise invalid_parameter_value using message = 'Invalid practice category.';
  end if;
  normalized_slug := lower(btrim(p_slug));
  if char_length(normalized_slug) not between 3 and 80
    or normalized_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  then
    raise invalid_parameter_value using message = 'Invalid practice category.';
  end if;

  select jsonb_build_object(
    'slug', item.slug,
    'version', category.version,
    'snapshotDate', category.snapshot_date,
    'title', item.title,
    'prompt', item.prompt,
    'timeLimitSeconds', category.time_limit_seconds,
    'inputLabel', 'Type an answer',
    'inputPlaceholder', 'Type a name…',
    'sourceLabel', item.source_label,
    'competitiveEligible', false,
    'answers', publication.answers_snapshot
  ) into practice_payload
  from private.category_discovery_items as item
  join private.category_versions as category on category.id = item.category_version_id
  join private.category_answer_bank_publications as publication
    on publication.category_version_id = category.id
  where item.slug = normalized_slug
    and item.review_status = 'reviewed'
    and item.availability = 'practice'
    and not item.competitive_eligible
    and not publication.competitive_eligible;

  if practice_payload is null then
    raise invalid_parameter_value using message = 'Practice category not found.';
  end if;
  return practice_payload;
end;
$$;

revoke all on function public.category_publisher_status() from public, anon, authenticated;
revoke all on function public.category_publication_queue() from public, anon, authenticated;
revoke all on function public.category_publish_approved_bank(uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.category_practice_get(text) from public, anon, authenticated;

grant execute on function public.category_publisher_status() to authenticated;
grant execute on function public.category_publication_queue() to authenticated;
grant execute on function public.category_publish_approved_bank(uuid, text, text, text, text) to authenticated;
grant execute on function public.category_practice_get(text) to authenticated;
