create index daily_challenges_category_version_idx
  on public.daily_challenges (category_version_id);

create index daily_submissions_answer_idx
  on public.daily_submissions (answer_id);
