alter table public.daily_attempts
  add column display_name text,
  add column submission_window_started_at timestamptz,
  add column submission_window_count integer not null default 0;

alter table public.daily_attempts
  add constraint daily_attempts_display_name_check check (
    display_name is null
    or (
      char_length(display_name) between 2 and 24
      and display_name = regexp_replace(btrim(display_name), '[[:space:]]+', ' ', 'g')
      and display_name !~ '[[:cntrl:]]'
      and display_name ~ '^[[:alnum:]][[:alnum:] .''’-]*$'
    )
  ),
  add constraint daily_attempts_submission_window_count_check check (
    submission_window_count between 0 and 40
  );

create index daily_leaderboard_order_idx
  on public.daily_attempts (
    challenge_id,
    verified_score desc,
    completed_at asc,
    created_at asc,
    id asc
  )
  where display_name is not null
    and status in ('completed', 'expired');

create or replace function private.normalize_daily_display_name(p_display_name text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  normalized_name text;
begin
  if p_display_name is null then
    return null;
  end if;

  normalized_name := regexp_replace(btrim(p_display_name), '[[:space:]]+', ' ', 'g');

  if char_length(normalized_name) not between 2 and 24
    or normalized_name ~ '[[:cntrl:]]'
    or normalized_name !~ '^[[:alnum:]][[:alnum:] .''’-]*$'
  then
    return null;
  end if;

  return normalized_name;
end;
$$;

create or replace function private.daily_challenge_payload(p_challenge_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', challenge.id,
    'date', challenge.challenge_date,
    'resetAt', ((challenge.challenge_date + 1)::timestamp at time zone 'UTC'),
    'category', jsonb_build_object(
      'slug', category.slug,
      'version', category.version,
      'snapshotDate', category.snapshot_date,
      'title', category.title,
      'prompt', category.prompt,
      'timeLimitSeconds', category.time_limit_seconds
    )
  )
  from public.daily_challenges as challenge
  join private.category_versions as category
    on category.id = challenge.category_version_id
  where challenge.id = p_challenge_id;
$$;

create or replace function private.daily_attempt_payload(p_attempt_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', attempt.id,
    'displayName', attempt.display_name,
    'status', attempt.status,
    'startedAt', attempt.started_at,
    'deadlineAt', attempt.deadline_at,
    'completedAt', attempt.completed_at,
    'score', (
      select count(*)::integer
      from public.daily_submissions as score_submission
      where score_submission.attempt_id = attempt.id
    ),
    'answers', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', answer.stable_id,
            'canonicalText', answer.canonical_text,
            'teamCode', answer.team_code,
            'acceptedAt', submission.submitted_at
          )
          order by submission.submitted_at, submission.id
        )
        from public.daily_submissions as submission
        join private.category_answers as answer
          on answer.id = submission.answer_id
        where submission.attempt_id = attempt.id
      ),
      '[]'::jsonb
    )
  )
  from public.daily_attempts as attempt
  where attempt.id = p_attempt_id;
$$;

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

drop function public.daily_start_attempt();

create function public.daily_start_attempt(p_display_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  v_now timestamptz := statement_timestamp();
  normalized_display_name text := private.normalize_daily_display_name(p_display_name);
  current_challenge_id uuid;
  challenge_time_limit integer;
  current_attempt_id uuid;
  current_attempt record;
begin
  if current_user_id is null then
    raise insufficient_privilege using message = 'Authentication required.';
  end if;

  if normalized_display_name is null then
    raise invalid_parameter_value using message = 'Invalid display name.';
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
    display_name,
    status,
    started_at,
    deadline_at
  ) values (
    current_challenge_id,
    current_user_id,
    normalized_display_name,
    'active',
    v_now,
    v_now + make_interval(secs => challenge_time_limit)
  )
  on conflict (challenge_id, user_id) do nothing
  returning id into current_attempt_id;

  if current_attempt_id is null then
    select attempt.*
      into current_attempt
    from public.daily_attempts as attempt
    where attempt.challenge_id = current_challenge_id
      and attempt.user_id = current_user_id
    for update;

    if current_attempt.status = 'active' and current_attempt.deadline_at <= v_now then
      update public.daily_attempts as attempt
      set status = 'expired',
          completed_at = attempt.deadline_at,
          verified_score = (
            select count(*)::integer
            from public.daily_submissions as submission
            where submission.attempt_id = attempt.id
          )
      where attempt.id = current_attempt.id;

      current_attempt.status := 'expired';
    end if;

    if current_attempt.display_name is null
      and current_attempt.status = 'active'
      and not exists (
        select 1
        from public.daily_submissions as submission
        where submission.attempt_id = current_attempt.id
      )
    then
      update public.daily_attempts as attempt
      set display_name = normalized_display_name
      where attempt.id = current_attempt.id;
    elsif current_attempt.display_name is distinct from normalized_display_name then
      raise insufficient_privilege using message = 'Attempt unavailable.';
    end if;

    current_attempt_id := current_attempt.id;
  end if;

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

  if attempt_row.submission_window_started_at is null
    or attempt_row.submission_window_started_at <= v_now - interval '10 seconds'
  then
    update public.daily_attempts as attempt
    set submission_window_started_at = v_now,
        submission_window_count = 1
    where attempt.id = attempt_row.id;
  elsif attempt_row.submission_window_count >= 40 then
    return jsonb_build_object('status', 'rate-limited', 'serverNow', v_now);
  else
    update public.daily_attempts as attempt
    set submission_window_count = attempt.submission_window_count + 1
    where attempt.id = attempt_row.id;
  end if;

  if p_normalized_answer is null
    or char_length(p_normalized_answer) not between 1 and 80
    or p_normalized_answer <> btrim(p_normalized_answer)
    or p_normalized_answer ~ '[[:cntrl:]]'
  then
    return jsonb_build_object('status', 'invalid', 'serverNow', v_now);
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
    set status = case when attempt.deadline_at <= v_now then 'expired' else 'completed' end,
        completed_at = case when attempt.deadline_at <= v_now then attempt.deadline_at else v_now end,
        verified_score = current_score
    where attempt.id = attempt_row.id;
  end if;

  return jsonb_build_object(
    'serverNow', v_now,
    'attempt', private.daily_attempt_payload(attempt_row.id)
  );
end;
$$;

create or replace function public.daily_get_leaderboard()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  v_now timestamptz := statement_timestamp();
  current_challenge record;
  leaderboard_entries jsonb;
begin
  if current_user_id is null then
    raise insufficient_privilege using message = 'Authentication required.';
  end if;

  select challenge.id, challenge.challenge_date, category.slug, category.version
    into current_challenge
  from public.daily_challenges as challenge
  join private.category_versions as category
    on category.id = challenge.category_version_id
  where challenge.challenge_date = timezone('UTC', v_now)::date
    and challenge.is_active
  limit 1;

  if not found then
    return jsonb_build_object(
      'serverNow', v_now,
      'challenge', null,
      'entries', '[]'::jsonb
    );
  end if;

  update public.daily_attempts as attempt
  set status = 'expired',
      completed_at = attempt.deadline_at,
      verified_score = (
        select count(*)::integer
        from public.daily_submissions as submission
        where submission.attempt_id = attempt.id
      )
  where attempt.challenge_id = current_challenge.id
    and attempt.status = 'active'
    and attempt.deadline_at <= v_now;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'rank', ranked.position,
        'displayName', ranked.display_name,
        'score', ranked.verified_score,
        'isTied', ranked.is_tied
      )
      order by ranked.position
    ),
    '[]'::jsonb
  )
    into leaderboard_entries
  from (
    select
      (row_number() over (
        order by
          attempt.verified_score desc,
          attempt.completed_at asc,
          attempt.created_at asc,
          attempt.id asc
      ))::integer as position,
      attempt.display_name,
      attempt.verified_score,
      count(*) over (partition by attempt.verified_score) > 1 as is_tied
    from public.daily_attempts as attempt
    where attempt.challenge_id = current_challenge.id
      and attempt.display_name is not null
      and attempt.status in ('completed', 'expired')
    order by
      attempt.verified_score desc,
      attempt.completed_at asc,
      attempt.created_at asc,
      attempt.id asc
    limit 10
  ) as ranked;

  return jsonb_build_object(
    'serverNow', v_now,
    'challenge', jsonb_build_object(
      'date', current_challenge.challenge_date,
      'category', jsonb_build_object(
        'slug', current_challenge.slug,
        'version', current_challenge.version
      )
    ),
    'entries', leaderboard_entries
  );
end;
$$;

revoke all on function private.normalize_daily_display_name(text) from public, anon, authenticated;
revoke all on function private.daily_challenge_payload(uuid) from public, anon, authenticated;
revoke all on function private.daily_attempt_payload(uuid) from public, anon, authenticated;
revoke all on function public.daily_get_status() from public, anon, authenticated;
revoke all on function public.daily_start_attempt(text) from public, anon, authenticated;
revoke all on function public.daily_submit_answer(uuid, text) from public, anon, authenticated;
revoke all on function public.daily_finish_attempt(uuid) from public, anon, authenticated;
revoke all on function public.daily_get_leaderboard() from public, anon, authenticated;

grant execute on function public.daily_get_status() to authenticated;
grant execute on function public.daily_start_attempt(text) to authenticated;
grant execute on function public.daily_submit_answer(uuid, text) to authenticated;
grant execute on function public.daily_finish_attempt(uuid) to authenticated;
grant execute on function public.daily_get_leaderboard() to authenticated;

insert into public.daily_challenges (
  id,
  challenge_date,
  category_version_id,
  is_active
)
select
  md5('namemore-daily:' || challenge_day::date::text)::uuid,
  challenge_day::date,
  category.id,
  true
from generate_series(
  '2026-08-17'::date,
  '2026-12-31'::date,
  interval '1 day'
) as scheduled(challenge_day)
cross join private.category_versions as category
where category.slug = 'current-nba-players'
  and category.version = 1
on conflict (challenge_date) do nothing;
