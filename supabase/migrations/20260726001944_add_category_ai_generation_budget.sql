create table private.category_ai_generation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  category_draft_id uuid not null references private.category_drafts(id) on delete restrict,
  model text not null check (
    char_length(model) between 2 and 80
    and model ~ '^[a-z0-9][a-z0-9._-]+$'
  ),
  requested_at timestamptz not null default statement_timestamp()
);

create index category_ai_generation_user_time_idx
  on private.category_ai_generation_events (user_id, requested_at desc);

create index category_ai_generation_draft_time_idx
  on private.category_ai_generation_events (category_draft_id, requested_at desc);

alter table private.category_ai_generation_events enable row level security;

revoke all on table private.category_ai_generation_events
  from public, anon, authenticated;

create function public.category_ai_generation_reserve(
  p_draft_id uuid,
  p_model text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  v_now timestamptz := statement_timestamp();
  utc_day_start timestamptz := (
    timezone('UTC', statement_timestamp())::date::timestamp at time zone 'UTC'
  );
  recent_user_count integer;
  recent_draft_count integer;
  created_event_id uuid;
begin
  if current_user_id is null then
    raise insufficient_privilege using message = 'Authentication required.';
  end if;

  if p_draft_id is null
    or p_model is null
    or char_length(p_model) not between 2 and 80
    or p_model !~ '^[a-z0-9][a-z0-9._-]+$'
  then
    raise invalid_parameter_value using message = 'Invalid AI generation request.';
  end if;

  if not exists (
    select 1
    from private.category_reviewers as reviewer
    where reviewer.user_id = current_user_id
      and reviewer.active
  ) then
    raise insufficient_privilege using message = 'Reviewer authorization required.';
  end if;

  if not exists (
    select 1
    from private.category_answer_bank_versions as version
    join private.category_drafts as draft
      on draft.id = version.category_draft_id
    where draft.id = p_draft_id
      and draft.status = 'review-complete'
      and draft.review_status = 'scope-approved'
      and draft.user_id <> current_user_id
      and version.status = 'editing'
      and version.editor_user_id = current_user_id
  ) then
    raise insufficient_privilege using message = 'Editable bank ownership required.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(current_user_id::text, 9)
  );

  if exists (
    select 1
    from private.category_ai_generation_events as generation
    where generation.user_id = current_user_id
      and generation.requested_at > v_now - interval '1 minute'
  ) then
    raise program_limit_exceeded using message = 'AI generation cooldown active.';
  end if;

  select count(*)::integer
    into recent_user_count
  from private.category_ai_generation_events as generation
  where generation.user_id = current_user_id
    and generation.requested_at >= utc_day_start;

  select count(*)::integer
    into recent_draft_count
  from private.category_ai_generation_events as generation
  where generation.user_id = current_user_id
    and generation.category_draft_id = p_draft_id
    and generation.requested_at >= utc_day_start;

  if recent_user_count >= 5 or recent_draft_count >= 3 then
    raise program_limit_exceeded using message = 'AI generation daily limit reached.';
  end if;

  insert into private.category_ai_generation_events (
    user_id,
    category_draft_id,
    model,
    requested_at
  )
  values (
    current_user_id,
    p_draft_id,
    p_model,
    v_now
  )
  returning id into created_event_id;

  return jsonb_build_object(
    'reservationId', created_event_id,
    'remainingToday', 4 - recent_user_count,
    'competitiveEligible', false
  );
end;
$$;

revoke all on function public.category_ai_generation_reserve(uuid, text)
  from public, anon, authenticated;

grant execute on function public.category_ai_generation_reserve(uuid, text)
  to authenticated;
