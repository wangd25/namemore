alter table private.category_drafts
  add column review_revision integer not null default 0
    check (review_revision >= 0);

update private.category_drafts
set review_revision = 1
where status = 'review-requested' and review_status = 'pending';

create table private.category_reviewers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active boolean not null default true,
  added_at timestamptz not null default statement_timestamp()
);

create table private.category_draft_reviews (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references private.category_drafts(id) on delete restrict,
  review_revision integer not null check (review_revision > 0),
  reviewer_user_id uuid not null references auth.users(id) on delete restrict,
  decision text not null check (
    decision in ('request-changes', 'reject', 'scope-approve')
  ),
  decision_note text not null check (
    char_length(decision_note) between 12 and 600
    and decision_note = regexp_replace(btrim(decision_note), '[[:space:]]+', ' ', 'g')
    and decision_note !~ '[[:cntrl:]]'
  ),
  prompt_snapshot text not null,
  source_notes_snapshot text not null,
  coverage_notes_snapshot text not null,
  submitted_at_snapshot timestamptz not null,
  decided_at timestamptz not null default statement_timestamp(),
  competitive_eligible boolean not null default false check (not competitive_eligible),
  unique (draft_id, review_revision)
);

create index category_drafts_review_queue_idx
  on private.category_drafts (submitted_at asc, id asc)
  where status = 'review-requested' and review_status = 'pending';

create index category_draft_reviews_reviewer_time_idx
  on private.category_draft_reviews (reviewer_user_id, decided_at desc);

alter table private.category_reviewers enable row level security;
alter table private.category_draft_reviews enable row level security;

revoke all on table private.category_reviewers from public, anon, authenticated;
revoke all on table private.category_draft_reviews from public, anon, authenticated;

alter table private.category_drafts
  drop constraint category_drafts_status_check,
  drop constraint category_drafts_review_status_check,
  drop constraint category_drafts_lifecycle_check;

alter table private.category_drafts
  add constraint category_drafts_status_check
    check (status in ('draft', 'review-requested', 'review-complete')),
  add constraint category_drafts_review_status_check
    check (
      review_status in (
        'unreviewed',
        'changes-requested',
        'pending',
        'scope-approved',
        'rejected'
      )
    ),
  add constraint category_drafts_lifecycle_check
    check (
      (
        status = 'draft'
        and review_status in ('unreviewed', 'changes-requested')
        and submitted_at is null
      )
      or (
        status = 'review-requested'
        and review_status = 'pending'
        and submitted_at is not null
        and review_revision > 0
      )
      or (
        status = 'review-complete'
        and review_status in ('scope-approved', 'rejected')
        and submitted_at is not null
        and review_revision > 0
      )
    );

create function private.category_draft_payload(p_draft private.category_drafts)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p_draft.id,
    'prompt', p_draft.prompt,
    'sourceNotes', p_draft.source_notes,
    'coverageNotes', p_draft.coverage_notes,
    'status', p_draft.status,
    'reviewStatus', p_draft.review_status,
    'reviewRevision', p_draft.review_revision,
    'competitiveEligible', p_draft.competitive_eligible,
    'createdAt', p_draft.created_at,
    'updatedAt', p_draft.updated_at,
    'submittedAt', p_draft.submitted_at,
    'latestReview', (
      select jsonb_build_object(
        'decision', latest_review.decision,
        'note', latest_review.decision_note,
        'revision', latest_review.review_revision,
        'decidedAt', latest_review.decided_at
      )
      from private.category_draft_reviews as latest_review
      where latest_review.draft_id = p_draft.id
      order by latest_review.review_revision desc
      limit 1
    )
  );
$$;

create or replace function public.category_create_draft(
  p_prompt text,
  p_source_notes text,
  p_coverage_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  v_now timestamptz := statement_timestamp();
  normalized_prompt text;
  normalized_source_notes text;
  normalized_coverage_notes text;
  created_draft private.category_drafts%rowtype;
begin
  if current_user_id is null then
    raise insufficient_privilege using message = 'Authentication required.';
  end if;

  if p_prompt is null or p_source_notes is null or p_coverage_notes is null
    or p_prompt ~ '[[:cntrl:]]'
    or p_source_notes ~ '[[:cntrl:]]'
    or p_coverage_notes ~ '[[:cntrl:]]'
  then
    raise invalid_parameter_value using message = 'Invalid category draft.';
  end if;

  normalized_prompt := regexp_replace(btrim(p_prompt), '[[:space:]]+', ' ', 'g');
  normalized_source_notes := regexp_replace(btrim(p_source_notes), '[[:space:]]+', ' ', 'g');
  normalized_coverage_notes := regexp_replace(btrim(p_coverage_notes), '[[:space:]]+', ' ', 'g');

  if char_length(normalized_prompt) not between 4 and 160
    or char_length(normalized_source_notes) not between 8 and 500
    or char_length(normalized_coverage_notes) not between 8 and 500
  then
    raise invalid_parameter_value using message = 'Invalid category draft.';
  end if;

  if (
    select count(*)
    from private.category_drafts as recent_draft
    where recent_draft.user_id = current_user_id
      and recent_draft.created_at > v_now - interval '1 hour'
  ) >= 5 then
    raise program_limit_exceeded using message = 'Category draft limit reached.';
  end if;

  insert into private.category_drafts (
    user_id,
    prompt,
    source_notes,
    coverage_notes,
    updated_at
  )
  values (
    current_user_id,
    normalized_prompt,
    normalized_source_notes,
    normalized_coverage_notes,
    v_now
  )
  returning * into created_draft;

  return private.category_draft_payload(created_draft);
end;
$$;

create or replace function public.category_list_drafts()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  v_now timestamptz := statement_timestamp();
  drafts_payload jsonb;
begin
  if current_user_id is null then
    raise insufficient_privilege using message = 'Authentication required.';
  end if;

  select coalesce(
    jsonb_agg(
      private.category_draft_payload(owned_draft::private.category_drafts)
      order by owned_draft.created_at desc, owned_draft.id desc
    ),
    '[]'::jsonb
  )
    into drafts_payload
  from (
    select draft.*
    from private.category_drafts as draft
    where draft.user_id = current_user_id
    order by draft.created_at desc, draft.id desc
    limit 50
  ) as owned_draft;

  return jsonb_build_object(
    'serverNow', v_now,
    'drafts', drafts_payload
  );
end;
$$;

create or replace function public.category_update_draft(
  p_draft_id uuid,
  p_prompt text,
  p_source_notes text,
  p_coverage_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  v_now timestamptz := statement_timestamp();
  normalized_prompt text;
  normalized_source_notes text;
  normalized_coverage_notes text;
  updated_draft private.category_drafts%rowtype;
begin
  if current_user_id is null then
    raise insufficient_privilege using message = 'Authentication required.';
  end if;

  if p_draft_id is null
    or p_prompt is null or p_source_notes is null or p_coverage_notes is null
    or p_prompt ~ '[[:cntrl:]]'
    or p_source_notes ~ '[[:cntrl:]]'
    or p_coverage_notes ~ '[[:cntrl:]]'
  then
    raise invalid_parameter_value using message = 'Invalid category draft.';
  end if;

  normalized_prompt := regexp_replace(btrim(p_prompt), '[[:space:]]+', ' ', 'g');
  normalized_source_notes := regexp_replace(btrim(p_source_notes), '[[:space:]]+', ' ', 'g');
  normalized_coverage_notes := regexp_replace(btrim(p_coverage_notes), '[[:space:]]+', ' ', 'g');

  if char_length(normalized_prompt) not between 4 and 160
    or char_length(normalized_source_notes) not between 8 and 500
    or char_length(normalized_coverage_notes) not between 8 and 500
  then
    raise invalid_parameter_value using message = 'Invalid category draft.';
  end if;

  update private.category_drafts as draft
  set
    prompt = normalized_prompt,
    source_notes = normalized_source_notes,
    coverage_notes = normalized_coverage_notes,
    updated_at = v_now
  where draft.id = p_draft_id
    and draft.user_id = current_user_id
    and draft.status = 'draft'
  returning * into updated_draft;

  if updated_draft.id is null then
    if exists (
      select 1
      from private.category_drafts as owned_draft
      where owned_draft.id = p_draft_id
        and owned_draft.user_id = current_user_id
    ) then
      raise object_not_in_prerequisite_state using message = 'Draft editing is locked.';
    end if;
    raise invalid_parameter_value using message = 'Invalid category draft.';
  end if;

  return private.category_draft_payload(updated_draft);
end;
$$;

create or replace function public.category_submit_draft(p_draft_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  v_now timestamptz := statement_timestamp();
  submitted_draft private.category_drafts%rowtype;
begin
  if current_user_id is null then
    raise insufficient_privilege using message = 'Authentication required.';
  end if;

  if p_draft_id is null then
    raise invalid_parameter_value using message = 'Invalid category draft.';
  end if;

  update private.category_drafts as draft
  set
    status = 'review-requested',
    review_status = 'pending',
    review_revision = draft.review_revision + 1,
    submitted_at = v_now,
    updated_at = v_now
  where draft.id = p_draft_id
    and draft.user_id = current_user_id
    and draft.status = 'draft'
  returning * into submitted_draft;

  if submitted_draft.id is null then
    if exists (
      select 1
      from private.category_drafts as owned_draft
      where owned_draft.id = p_draft_id
        and owned_draft.user_id = current_user_id
    ) then
      raise object_not_in_prerequisite_state using message = 'Draft review was already requested.';
    end if;
    raise invalid_parameter_value using message = 'Invalid category draft.';
  end if;

  return private.category_draft_payload(submitted_draft);
end;
$$;

create function public.category_reviewer_status()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  v_now timestamptz := statement_timestamp();
  authorized boolean := false;
begin
  if current_user_id is null then
    raise insufficient_privilege using message = 'Authentication required.';
  end if;

  select exists (
    select 1
    from private.category_reviewers as reviewer
    where reviewer.user_id = current_user_id
      and reviewer.active
  ) into authorized;

  return jsonb_build_object(
    'serverNow', v_now,
    'authorized', authorized
  );
end;
$$;

create function public.category_review_queue()
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
    select 1
    from private.category_reviewers as reviewer
    where reviewer.user_id = current_user_id
      and reviewer.active
  ) then
    raise insufficient_privilege using message = 'Reviewer authorization required.';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', queued.id,
        'prompt', queued.prompt,
        'sourceNotes', queued.source_notes,
        'coverageNotes', queued.coverage_notes,
        'submittedAt', queued.submitted_at,
        'reviewRevision', queued.review_revision
      )
      order by queued.submitted_at asc, queued.id asc
    ),
    '[]'::jsonb
  ) into queue_payload
  from (
    select draft.*
    from private.category_drafts as draft
    where draft.status = 'review-requested'
      and draft.review_status = 'pending'
      and draft.user_id <> current_user_id
    order by draft.submitted_at asc, draft.id asc
    limit 50
  ) as queued;

  return jsonb_build_object(
    'serverNow', v_now,
    'authorized', true,
    'drafts', queue_payload
  );
end;
$$;

create function public.category_review_decide(
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
  next_status text;
  next_review_status text;
begin
  if current_user_id is null then
    raise insufficient_privilege using message = 'Authentication required.';
  end if;

  if not exists (
    select 1
    from private.category_reviewers as reviewer
    where reviewer.user_id = current_user_id
      and reviewer.active
  ) then
    raise insufficient_privilege using message = 'Reviewer authorization required.';
  end if;

  if p_draft_id is null
    or p_decision is null
    or p_decision not in ('request-changes', 'reject', 'scope-approve')
    or p_note is null
    or p_note ~ '[[:cntrl:]]'
  then
    raise invalid_parameter_value using message = 'Invalid review decision.';
  end if;

  normalized_note := regexp_replace(btrim(p_note), '[[:space:]]+', ' ', 'g');
  if char_length(normalized_note) not between 12 and 600 then
    raise invalid_parameter_value using message = 'Invalid review decision.';
  end if;

  select draft.*
    into selected_draft
  from private.category_drafts as draft
  where draft.id = p_draft_id
    and draft.user_id <> current_user_id
  for update;

  if selected_draft.id is null then
    raise invalid_parameter_value using message = 'Invalid review decision.';
  end if;

  if selected_draft.status <> 'review-requested'
    or selected_draft.review_status <> 'pending'
  then
    raise object_not_in_prerequisite_state using message = 'Draft review is no longer pending.';
  end if;

  insert into private.category_draft_reviews (
    draft_id,
    review_revision,
    reviewer_user_id,
    decision,
    decision_note,
    prompt_snapshot,
    source_notes_snapshot,
    coverage_notes_snapshot,
    submitted_at_snapshot,
    decided_at
  )
  values (
    selected_draft.id,
    selected_draft.review_revision,
    current_user_id,
    p_decision,
    normalized_note,
    selected_draft.prompt,
    selected_draft.source_notes,
    selected_draft.coverage_notes,
    selected_draft.submitted_at,
    v_now
  );

  if p_decision = 'request-changes' then
    next_status := 'draft';
    next_review_status := 'changes-requested';
  elsif p_decision = 'reject' then
    next_status := 'review-complete';
    next_review_status := 'rejected';
  else
    next_status := 'review-complete';
    next_review_status := 'scope-approved';
  end if;

  update private.category_drafts as draft
  set
    status = next_status,
    review_status = next_review_status,
    submitted_at = case when p_decision = 'request-changes' then null else draft.submitted_at end,
    updated_at = v_now
  where draft.id = selected_draft.id;

  return jsonb_build_object(
    'draftId', selected_draft.id,
    'decision', p_decision,
    'reviewStatus', next_review_status,
    'reviewRevision', selected_draft.review_revision,
    'decidedAt', v_now
  );
end;
$$;

revoke all on function private.category_draft_payload(private.category_drafts) from public, anon, authenticated;
revoke all on function public.category_reviewer_status() from public, anon, authenticated;
revoke all on function public.category_review_queue() from public, anon, authenticated;
revoke all on function public.category_review_decide(uuid, text, text) from public, anon, authenticated;

grant execute on function public.category_reviewer_status() to authenticated;
grant execute on function public.category_review_queue() to authenticated;
grant execute on function public.category_review_decide(uuid, text, text) to authenticated;
