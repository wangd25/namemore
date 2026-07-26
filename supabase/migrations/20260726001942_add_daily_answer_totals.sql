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
      'timeLimitSeconds', category.time_limit_seconds,
      'answerCount', (
        select count(*)::integer
        from private.category_answers as answer
        where answer.category_version_id = category.id
      )
    )
  )
  from public.daily_challenges as challenge
  join private.category_versions as category
    on category.id = challenge.category_version_id
  where challenge.id = p_challenge_id;
$$;

revoke all on function private.daily_challenge_payload(uuid)
  from public, anon, authenticated;
