alter table private.category_drafts
  add column updated_at timestamptz not null default statement_timestamp(),
  add column submitted_at timestamptz;

alter table private.category_drafts
  drop constraint category_drafts_status_check,
  drop constraint category_drafts_review_status_check;

alter table private.category_drafts
  add constraint category_drafts_status_check
    check (status in ('draft', 'review-requested')),
  add constraint category_drafts_review_status_check
    check (review_status in ('unreviewed', 'pending')),
  add constraint category_drafts_lifecycle_check
    check (
      (
        status = 'draft'
        and review_status = 'unreviewed'
        and submitted_at is null
      )
      or (
        status = 'review-requested'
        and review_status = 'pending'
        and submitted_at is not null
      )
    ),
  add constraint category_drafts_timestamp_order_check
    check (
      updated_at >= created_at
      and (submitted_at is null or submitted_at >= created_at)
    );

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

  return jsonb_build_object(
    'id', created_draft.id,
    'prompt', created_draft.prompt,
    'sourceNotes', created_draft.source_notes,
    'coverageNotes', created_draft.coverage_notes,
    'status', created_draft.status,
    'reviewStatus', created_draft.review_status,
    'competitiveEligible', created_draft.competitive_eligible,
    'createdAt', created_draft.created_at,
    'updatedAt', created_draft.updated_at,
    'submittedAt', created_draft.submitted_at
  );
end;
$$;

create function public.category_list_drafts()
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
      jsonb_build_object(
        'id', owned_draft.id,
        'prompt', owned_draft.prompt,
        'sourceNotes', owned_draft.source_notes,
        'coverageNotes', owned_draft.coverage_notes,
        'status', owned_draft.status,
        'reviewStatus', owned_draft.review_status,
        'competitiveEligible', owned_draft.competitive_eligible,
        'createdAt', owned_draft.created_at,
        'updatedAt', owned_draft.updated_at,
        'submittedAt', owned_draft.submitted_at
      )
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

create function public.category_update_draft(
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

  return jsonb_build_object(
    'id', updated_draft.id,
    'prompt', updated_draft.prompt,
    'sourceNotes', updated_draft.source_notes,
    'coverageNotes', updated_draft.coverage_notes,
    'status', updated_draft.status,
    'reviewStatus', updated_draft.review_status,
    'competitiveEligible', updated_draft.competitive_eligible,
    'createdAt', updated_draft.created_at,
    'updatedAt', updated_draft.updated_at,
    'submittedAt', updated_draft.submitted_at
  );
end;
$$;

create function public.category_submit_draft(p_draft_id uuid)
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

  return jsonb_build_object(
    'id', submitted_draft.id,
    'prompt', submitted_draft.prompt,
    'sourceNotes', submitted_draft.source_notes,
    'coverageNotes', submitted_draft.coverage_notes,
    'status', submitted_draft.status,
    'reviewStatus', submitted_draft.review_status,
    'competitiveEligible', submitted_draft.competitive_eligible,
    'createdAt', submitted_draft.created_at,
    'updatedAt', submitted_draft.updated_at,
    'submittedAt', submitted_draft.submitted_at
  );
end;
$$;

revoke all on function public.category_create_draft(text, text, text) from public, anon, authenticated;
revoke all on function public.category_list_drafts() from public, anon, authenticated;
revoke all on function public.category_update_draft(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.category_submit_draft(uuid) from public, anon, authenticated;

grant execute on function public.category_create_draft(text, text, text) to authenticated;
grant execute on function public.category_list_drafts() to authenticated;
grant execute on function public.category_update_draft(uuid, text, text, text) to authenticated;
grant execute on function public.category_submit_draft(uuid) to authenticated;
