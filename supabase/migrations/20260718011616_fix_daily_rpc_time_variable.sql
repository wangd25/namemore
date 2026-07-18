create or replace function public.daily_get_status()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  v_now timestamptz := statement_timestamp();
  current_challenge_id uuid;
  current_attempt_id uuid;
begin
  if current_user_id is null then
    raise insufficient_privilege using message = 'Authentication required.';
  end if;

  select challenge.id
    into current_challenge_id
  from public.daily_challenges as challenge
  where challenge.challenge_date = timezone('UTC', v_now)::date
    and challenge.is_active
  limit 1;

  if current_challenge_id is null then
    return jsonb_build_object(
      'serverNow', v_now,
      'challenge', null,
      'attempt', null
    );
  end if;

  select attempt.id
    into current_attempt_id
  from public.daily_attempts as attempt
  where attempt.challenge_id = current_challenge_id
    and attempt.user_id = current_user_id;

  if current_attempt_id is not null then
    update public.daily_attempts as attempt
    set status = 'expired',
        completed_at = attempt.deadline_at,
        verified_score = (
          select count(*)::integer
          from public.daily_submissions as submission
          where submission.attempt_id = attempt.id
        )
    where attempt.id = current_attempt_id
      and attempt.status = 'active'
      and attempt.deadline_at <= v_now;
  end if;

  return jsonb_build_object(
    'serverNow', v_now,
    'challenge', private.daily_challenge_payload(current_challenge_id),
    'attempt', case
      when current_attempt_id is null then null
      else private.daily_attempt_payload(current_attempt_id)
    end
  );
end;
$$;
create or replace function public.daily_start_attempt()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  v_now timestamptz := statement_timestamp();
  current_challenge_id uuid;
  challenge_time_limit integer;
  current_attempt_id uuid;
begin
  if current_user_id is null then
    raise insufficient_privilege using message = 'Authentication required.';
  end if;

  select challenge.id, category.time_limit_seconds
    into current_challenge_id, challenge_time_limit
  from public.daily_challenges as challenge
  join private.category_versions as category
    on category.id = challenge.category_version_id
  where challenge.challenge_date = timezone('UTC', v_now)::date
    and challenge.is_active
  limit 1;

  if current_challenge_id is null then
    return jsonb_build_object(
      'serverNow', v_now,
      'challenge', null,
      'attempt', null
    );
  end if;

  insert into public.daily_attempts (
    challenge_id,
    user_id,
    status,
    started_at,
    deadline_at
  ) values (
    current_challenge_id,
    current_user_id,
    'active',
    v_now,
    v_now + make_interval(secs => challenge_time_limit)
  )
  on conflict (challenge_id, user_id) do nothing
  returning id into current_attempt_id;

  if current_attempt_id is null then
    select attempt.id
      into current_attempt_id
    from public.daily_attempts as attempt
    where attempt.challenge_id = current_challenge_id
      and attempt.user_id = current_user_id;
  end if;

  update public.daily_attempts as attempt
  set status = 'expired',
      completed_at = attempt.deadline_at,
      verified_score = (
        select count(*)::integer
        from public.daily_submissions as submission
        where submission.attempt_id = attempt.id
      )
  where attempt.id = current_attempt_id
    and attempt.status = 'active'
    and attempt.deadline_at <= v_now;

  return jsonb_build_object(
    'serverNow', v_now,
    'challenge', private.daily_challenge_payload(current_challenge_id),
    'attempt', private.daily_attempt_payload(current_attempt_id)
  );
end;
$$;
create or replace function public.daily_submit_answer(
  p_attempt_id uuid,
  p_normalized_answer text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  v_now timestamptz := statement_timestamp();
  attempt_row record;
  matched_answer record;
  inserted_count integer := 0;
  current_score integer := 0;
  accepted_time timestamptz;
begin
  if current_user_id is null then
    raise insufficient_privilege using message = 'Authentication required.';
  end if;

  if p_normalized_answer is null
    or char_length(p_normalized_answer) not between 1 and 80
    or p_normalized_answer <> btrim(p_normalized_answer)
    or p_normalized_answer ~ '[[:cntrl:]]'
  then
    return jsonb_build_object('status', 'invalid', 'serverNow', v_now);
  end if;

  select attempt.*, challenge.category_version_id
    into attempt_row
  from public.daily_attempts as attempt
  join public.daily_challenges as challenge
    on challenge.id = attempt.challenge_id
  where attempt.id = p_attempt_id
    and attempt.user_id = current_user_id
  for update of attempt;

  if not found then
    raise insufficient_privilege using message = 'Attempt unavailable.';
  end if;

  if attempt_row.status <> 'active' or attempt_row.deadline_at <= v_now then
    if attempt_row.status = 'active' then
      update public.daily_attempts as attempt
      set status = 'expired',
          completed_at = attempt.deadline_at,
          verified_score = (
            select count(*)::integer
            from public.daily_submissions as submission
            where submission.attempt_id = attempt.id
          )
      where attempt.id = attempt_row.id;
    end if;

    return jsonb_build_object(
      'status', 'round-ended',
      'serverNow', v_now,
      'attempt', private.daily_attempt_payload(attempt_row.id)
    );
  end if;

  select answer.id, answer.stable_id, answer.canonical_text, answer.team_code
    into matched_answer
  from private.category_answer_aliases as alias
  join private.category_answers as answer
    on answer.id = alias.answer_id
  where alias.category_version_id = attempt_row.category_version_id
    and alias.normalized_alias = p_normalized_answer
  limit 1;

  if not found then
    return jsonb_build_object('status', 'invalid', 'serverNow', v_now);
  end if;

  insert into public.daily_submissions (attempt_id, answer_id, submitted_at)
  values (attempt_row.id, matched_answer.id, v_now)
  on conflict (attempt_id, answer_id) do nothing;

  get diagnostics inserted_count = row_count;

  select count(*)::integer
    into current_score
  from public.daily_submissions as submission
  where submission.attempt_id = attempt_row.id;

  select submission.submitted_at
    into accepted_time
  from public.daily_submissions as submission
  where submission.attempt_id = attempt_row.id
    and submission.answer_id = matched_answer.id;

  return jsonb_build_object(
    'status', case when inserted_count = 1 then 'accepted' else 'duplicate' end,
    'serverNow', v_now,
    'score', current_score,
    'answer', jsonb_build_object(
      'id', matched_answer.stable_id,
      'canonicalText', matched_answer.canonical_text,
      'teamCode', matched_answer.team_code,
      'acceptedAt', accepted_time
    )
  );
end;
$$;
create or replace function public.daily_finish_attempt(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  v_now timestamptz := statement_timestamp();
  attempt_row record;
  current_score integer;
begin
  if current_user_id is null then
    raise insufficient_privilege using message = 'Authentication required.';
  end if;

  select attempt.*
    into attempt_row
  from public.daily_attempts as attempt
  where attempt.id = p_attempt_id
    and attempt.user_id = current_user_id
  for update;

  if not found then
    raise insufficient_privilege using message = 'Attempt unavailable.';
  end if;

  select count(*)::integer
    into current_score
  from public.daily_submissions as submission
  where submission.attempt_id = attempt_row.id;

  if attempt_row.status = 'active' then
    update public.daily_attempts as attempt
    set status = 'completed',
        completed_at = v_now,
        verified_score = current_score
    where attempt.id = attempt_row.id;
  end if;

  return jsonb_build_object(
    'serverNow', v_now,
    'attempt', private.daily_attempt_payload(attempt_row.id)
  );
end;
$$;
