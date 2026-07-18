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
  '2026-07-18'::date,
  '2026-08-16'::date,
  interval '1 day'
) as scheduled(challenge_day)
cross join private.category_versions as category
where category.slug = 'current-nba-players'
  and category.version = 1
on conflict (challenge_date) do nothing;
