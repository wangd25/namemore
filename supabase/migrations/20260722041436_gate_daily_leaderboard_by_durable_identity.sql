alter table public.daily_attempts
  add column ranked_eligible boolean not null default false;

comment on column public.daily_attempts.ranked_eligible is
  'Server-derived competitive eligibility. Only Auth identities explicitly marked non-anonymous may be ranked.';

create or replace function private.set_daily_ranked_eligibility()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.ranked_eligible := coalesce(auth.jwt() ->> 'is_anonymous', 'true') = 'false';
  return new;
end;
$$;

create trigger set_daily_ranked_eligibility
before insert on public.daily_attempts
for each row execute function private.set_daily_ranked_eligibility();

create or replace function private.daily_attempt_payload(p_attempt_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', attempt.id,
    'displayName', attempt.display_name,
    'rankedEligible', attempt.ranked_eligible,
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
      and attempt.ranked_eligible
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

revoke all on function private.set_daily_ranked_eligibility() from public, anon, authenticated;
revoke all on function private.daily_attempt_payload(uuid) from public, anon, authenticated;
revoke all on function public.daily_get_leaderboard() from public, anon, authenticated;
grant execute on function public.daily_get_leaderboard() to authenticated;
