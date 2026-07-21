alter table private.category_answer_bank_versions
  add column bank_review_status text not null default 'unreviewed'
    check (bank_review_status in ('unreviewed', 'pending', 'changes-requested', 'approved', 'rejected'));

update private.category_answer_bank_versions
set bank_review_status = 'pending'
where status = 'review-ready';

alter table private.category_answer_bank_versions
  add constraint category_answer_bank_versions_review_lifecycle_check
    check (
      (status = 'editing' and bank_review_status = 'unreviewed')
      or (
        status = 'review-ready'
        and bank_review_status in ('pending', 'changes-requested', 'approved', 'rejected')
      )
    );

create table private.category_answer_bank_reviews (
  id uuid primary key default gen_random_uuid(),
  bank_version_id uuid not null references private.category_answer_bank_versions(id) on delete restrict,
  reviewer_user_id uuid not null references auth.users(id) on delete restrict,
  decision text not null check (decision in ('request-correction', 'reject', 'approve')),
  decision_note text not null check (
    char_length(decision_note) between 12 and 600
    and decision_note = regexp_replace(btrim(decision_note), '[[:space:]]+', ' ', 'g')
    and decision_note !~ '[[:cntrl:]]'
  ),
  prompt_snapshot text not null,
  snapshot_date_snapshot date not null,
  time_limit_seconds_snapshot integer not null check (time_limit_seconds_snapshot between 10 and 600),
  source_label_snapshot text not null,
  source_url_snapshot text not null,
  version_note_snapshot text not null,
  answers_snapshot jsonb not null check (jsonb_typeof(answers_snapshot) = 'array'),
  submitted_at_snapshot timestamptz not null,
  decided_at timestamptz not null default statement_timestamp(),
  competitive_eligible boolean not null default false check (not competitive_eligible),
  unique (bank_version_id)
);

create index category_answer_bank_review_queue_idx
  on private.category_answer_bank_versions (submitted_at asc, id asc)
  where status = 'review-ready' and bank_review_status = 'pending';

create index category_answer_bank_reviews_reviewer_time_idx
  on private.category_answer_bank_reviews (reviewer_user_id, decided_at desc);

alter table private.category_answer_bank_reviews enable row level security;
revoke all on table private.category_answer_bank_reviews from public, anon, authenticated;

create or replace function private.category_bank_payload(p_version_id uuid)
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
    'reviewStatus', version.bank_review_status,
    'snapshotDate', version.snapshot_date,
    'timeLimitSeconds', version.time_limit_seconds,
    'sourceLabel', version.source_label,
    'sourceUrl', version.source_url,
    'versionNote', version.version_note,
    'competitiveEligible', version.competitive_eligible,
    'updatedAt', version.updated_at,
    'submittedAt', version.submitted_at,
    'latestReview', (
      select jsonb_build_object(
        'decision', latest_review.decision,
        'note', latest_review.decision_note,
        'revision', version.revision,
        'decidedAt', latest_review.decided_at
      )
      from private.category_answer_bank_reviews as latest_review
      where latest_review.bank_version_id = version.id
    ),
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

create or replace function public.category_bank_queue()
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
  if current_user_id is null then raise insufficient_privilege using message = 'Authentication required.'; end if;
  if not exists (
    select 1 from private.category_reviewers as reviewer
    where reviewer.user_id = current_user_id and reviewer.active
  ) then raise insufficient_privilege using message = 'Reviewer authorization required.'; end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'draftId', queued.id,
      'prompt', queued.prompt,
      'sourceNotes', queued.source_notes,
      'coverageNotes', queued.coverage_notes,
      'revision', coalesce(queued.revision, 0),
      'status', coalesce(queued.bank_status, 'not-started'),
      'available', case
        when queued.version_id is null then true
        when queued.bank_status = 'editing' then queued.editor_user_id = current_user_id
        when queued.bank_review_status = 'changes-requested' then queued.editor_user_id = current_user_id
        else false
      end,
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
      latest.bank_review_status,
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

create or replace function public.category_bank_freeze(p_draft_id uuid)
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
    status = 'review-ready', bank_review_status = 'pending', updated_at = v_now, submitted_at = v_now
  where version.id = selected_version.id;
  return private.category_bank_payload(selected_version.id);
end;
$$;

create or replace function public.category_bank_start_revision(p_draft_id uuid)
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
  if source_version.status <> 'review-ready'
    or source_version.bank_review_status <> 'changes-requested'
    or source_version.editor_user_id <> current_user_id
  then raise object_not_in_prerequisite_state using message = 'A correction revision is not available.'; end if;

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

create function public.category_bank_review_queue()
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
  if current_user_id is null then raise insufficient_privilege using message = 'Authentication required.'; end if;
  if not exists (
    select 1 from private.category_reviewers as reviewer
    where reviewer.user_id = current_user_id and reviewer.active
  ) then raise insufficient_privilege using message = 'Reviewer authorization required.'; end if;

  select coalesce(
    jsonb_agg(private.category_bank_payload(queued.id) order by queued.submitted_at asc, queued.id asc),
    '[]'::jsonb
  ) into queue_payload
  from (
    select version.id, version.submitted_at
    from private.category_answer_bank_versions as version
    join private.category_drafts as draft on draft.id = version.category_draft_id
    where version.status = 'review-ready'
      and version.bank_review_status = 'pending'
      and version.editor_user_id <> current_user_id
      and draft.user_id <> current_user_id
    order by version.submitted_at asc, version.id asc
    limit 50
  ) as queued;

  return jsonb_build_object('serverNow', v_now, 'authorized', true, 'banks', queue_payload);
end;
$$;

create function public.category_bank_review_decide(
  p_draft_id uuid,
  p_decision text,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  v_now timestamptz := statement_timestamp();
  normalized_note text;
  selected_draft private.category_drafts%rowtype;
  selected_version private.category_answer_bank_versions%rowtype;
  next_review_status text;
begin
  if current_user_id is null then raise insufficient_privilege using message = 'Authentication required.'; end if;
  if not exists (
    select 1 from private.category_reviewers as reviewer
    where reviewer.user_id = current_user_id and reviewer.active
  ) then raise insufficient_privilege using message = 'Reviewer authorization required.'; end if;
  if p_draft_id is null
    or p_decision is null or p_decision not in ('request-correction', 'reject', 'approve')
    or p_note is null or p_note ~ '[[:cntrl:]]'
  then raise invalid_parameter_value using message = 'Invalid answer-bank decision.'; end if;
  normalized_note := regexp_replace(btrim(p_note), '[[:space:]]+', ' ', 'g');
  if char_length(normalized_note) not between 12 and 600 then
    raise invalid_parameter_value using message = 'Invalid answer-bank decision.';
  end if;

  select draft.* into selected_draft
  from private.category_drafts as draft
  where draft.id = p_draft_id and draft.user_id <> current_user_id
  for update;
  if selected_draft.id is null then raise invalid_parameter_value using message = 'Invalid answer-bank decision.'; end if;

  select version.* into selected_version
  from private.category_answer_bank_versions as version
  where version.category_draft_id = selected_draft.id
  order by version.revision desc
  limit 1
  for update;
  if selected_version.id is null
    or selected_version.editor_user_id = current_user_id
    or selected_version.status <> 'review-ready'
    or selected_version.bank_review_status <> 'pending'
  then raise object_not_in_prerequisite_state using message = 'Answer-bank review is no longer pending.'; end if;

  if p_decision = 'request-correction' then next_review_status := 'changes-requested';
  elsif p_decision = 'reject' then next_review_status := 'rejected';
  else next_review_status := 'approved';
  end if;

  insert into private.category_answer_bank_reviews (
    bank_version_id, reviewer_user_id, decision, decision_note, prompt_snapshot,
    snapshot_date_snapshot, time_limit_seconds_snapshot, source_label_snapshot,
    source_url_snapshot, version_note_snapshot, answers_snapshot,
    submitted_at_snapshot, decided_at
  ) values (
    selected_version.id, current_user_id, p_decision, normalized_note, selected_draft.prompt,
    selected_version.snapshot_date, selected_version.time_limit_seconds, selected_version.source_label,
    selected_version.source_url, selected_version.version_note,
    private.category_bank_payload(selected_version.id) -> 'answers',
    selected_version.submitted_at, v_now
  );

  update private.category_answer_bank_versions as version
  set bank_review_status = next_review_status, updated_at = v_now
  where version.id = selected_version.id;

  return jsonb_build_object(
    'draftId', selected_draft.id,
    'revision', selected_version.revision,
    'decision', p_decision,
    'reviewStatus', next_review_status,
    'decidedAt', v_now,
    'competitiveEligible', false
  );
end;
$$;

revoke all on function private.category_bank_payload(uuid) from public, anon, authenticated;
revoke all on function public.category_bank_queue() from public, anon, authenticated;
revoke all on function public.category_bank_freeze(uuid) from public, anon, authenticated;
revoke all on function public.category_bank_start_revision(uuid) from public, anon, authenticated;
revoke all on function public.category_bank_review_queue() from public, anon, authenticated;
revoke all on function public.category_bank_review_decide(uuid, text, text) from public, anon, authenticated;

grant execute on function public.category_bank_queue() to authenticated;
grant execute on function public.category_bank_freeze(uuid) to authenticated;
grant execute on function public.category_bank_start_revision(uuid) to authenticated;
grant execute on function public.category_bank_review_queue() to authenticated;
grant execute on function public.category_bank_review_decide(uuid, text, text) to authenticated;
