create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

create table private.category_versions (
  id uuid primary key,
  slug text not null,
  version integer not null check (version > 0),
  snapshot_date date not null,
  title text not null check (char_length(title) between 1 and 120),
  prompt text not null check (char_length(prompt) between 1 and 240),
  time_limit_seconds integer not null check (time_limit_seconds between 10 and 600),
  created_at timestamptz not null default statement_timestamp(),
  unique (slug, version)
);

create table private.category_answers (
  id uuid primary key,
  category_version_id uuid not null references private.category_versions(id) on delete restrict,
  stable_id text not null check (stable_id ~ '^[a-z0-9-]+$'),
  canonical_text text not null check (char_length(canonical_text) between 1 and 120),
  team_code text not null check (team_code ~ '^[A-Z]{3}$'),
  sort_order integer not null check (sort_order >= 0),
  created_at timestamptz not null default statement_timestamp(),
  unique (category_version_id, stable_id),
  unique (category_version_id, sort_order)
);

create table private.category_answer_aliases (
  category_version_id uuid not null references private.category_versions(id) on delete restrict,
  normalized_alias text not null check (
    char_length(normalized_alias) between 1 and 120
    and normalized_alias = btrim(normalized_alias)
    and normalized_alias !~ '[[:cntrl:]]'
  ),
  answer_id uuid not null references private.category_answers(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  primary key (category_version_id, normalized_alias)
);

create index category_answers_version_idx
  on private.category_answers (category_version_id);

create index category_answer_aliases_answer_idx
  on private.category_answer_aliases (answer_id);

create table public.daily_challenges (
  id uuid primary key,
  challenge_date date not null unique,
  category_version_id uuid not null references private.category_versions(id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default statement_timestamp()
);

create table public.daily_attempts (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.daily_challenges(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'completed', 'expired')),
  started_at timestamptz not null,
  deadline_at timestamptz not null,
  completed_at timestamptz,
  verified_score integer not null default 0 check (verified_score >= 0),
  created_at timestamptz not null default statement_timestamp(),
  unique (challenge_id, user_id),
  check (deadline_at > started_at),
  check (
    (status = 'active' and completed_at is null)
    or (status in ('completed', 'expired') and completed_at is not null)
  )
);

create index daily_attempts_user_idx
  on public.daily_attempts (user_id, created_at desc);

create table public.daily_submissions (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.daily_attempts(id) on delete cascade,
  answer_id uuid not null references private.category_answers(id) on delete restrict,
  submitted_at timestamptz not null default statement_timestamp(),
  unique (attempt_id, answer_id)
);

create index daily_submissions_attempt_time_idx
  on public.daily_submissions (attempt_id, submitted_at, id);

alter table private.category_versions enable row level security;
alter table private.category_answers enable row level security;
alter table private.category_answer_aliases enable row level security;
alter table public.daily_challenges enable row level security;
alter table public.daily_attempts enable row level security;
alter table public.daily_submissions enable row level security;

revoke all on table private.category_versions from public, anon, authenticated;
revoke all on table private.category_answers from public, anon, authenticated;
revoke all on table private.category_answer_aliases from public, anon, authenticated;
revoke all on table public.daily_challenges from public, anon, authenticated;
revoke all on table public.daily_attempts from public, anon, authenticated;
revoke all on table public.daily_submissions from public, anon, authenticated;

create or replace function private.daily_challenge_payload(p_challenge_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', challenge.id,
    'date', challenge.challenge_date,
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
  current_time timestamptz := statement_timestamp();
  current_challenge_id uuid;
  current_attempt_id uuid;
begin
  if current_user_id is null then
    raise insufficient_privilege using message = 'Authentication required.';
  end if;

  select challenge.id
    into current_challenge_id
  from public.daily_challenges as challenge
  where challenge.challenge_date = timezone('UTC', current_time)::date
    and challenge.is_active
  limit 1;

  if current_challenge_id is null then
    return jsonb_build_object(
      'serverNow', current_time,
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
      and attempt.deadline_at <= current_time;
  end if;

  return jsonb_build_object(
    'serverNow', current_time,
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
  current_time timestamptz := statement_timestamp();
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
  where challenge.challenge_date = timezone('UTC', current_time)::date
    and challenge.is_active
  limit 1;

  if current_challenge_id is null then
    return jsonb_build_object(
      'serverNow', current_time,
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
    current_time,
    current_time + make_interval(secs => challenge_time_limit)
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
    and attempt.deadline_at <= current_time;

  return jsonb_build_object(
    'serverNow', current_time,
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
  current_time timestamptz := statement_timestamp();
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
    return jsonb_build_object('status', 'invalid', 'serverNow', current_time);
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

  if attempt_row.status <> 'active' or attempt_row.deadline_at <= current_time then
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
      'serverNow', current_time,
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
    return jsonb_build_object('status', 'invalid', 'serverNow', current_time);
  end if;

  insert into public.daily_submissions (attempt_id, answer_id, submitted_at)
  values (attempt_row.id, matched_answer.id, current_time)
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
    'serverNow', current_time,
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
  current_time timestamptz := statement_timestamp();
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
        completed_at = current_time,
        verified_score = current_score
    where attempt.id = attempt_row.id;
  end if;

  return jsonb_build_object(
    'serverNow', current_time,
    'attempt', private.daily_attempt_payload(attempt_row.id)
  );
end;
$$;

revoke all on function private.daily_challenge_payload(uuid) from public, anon, authenticated;
revoke all on function private.daily_attempt_payload(uuid) from public, anon, authenticated;
revoke all on function public.daily_get_status() from public, anon;
revoke all on function public.daily_start_attempt() from public, anon;
revoke all on function public.daily_submit_answer(uuid, text) from public, anon;
revoke all on function public.daily_finish_attempt(uuid) from public, anon;

grant usage on schema public to authenticated;
grant execute on function public.daily_get_status() to authenticated;
grant execute on function public.daily_start_attempt() to authenticated;
grant execute on function public.daily_submit_answer(uuid, text) to authenticated;
grant execute on function public.daily_finish_attempt(uuid) to authenticated;

-- BEGIN GENERATED NBA SEED
insert into private.category_versions (id, slug, version, snapshot_date, title, prompt, time_limit_seconds)
values (
  '11111111-1111-4111-8111-111111111111',
  'current-nba-players',
  1,
  '2026-07-15'::date,
  'Current NBA players',
  'How many NBA players can you name?',
  90
);

insert into private.category_answers (id, category_version_id, stable_id, canonical_text, team_code, sort_order)
values
  ('aa9d6e71-111f-5702-8fbd-858ae9004ab5', '11111111-1111-4111-8111-111111111111', 'nba-cj-mccollum', 'CJ McCollum', 'ATL', 0),
  ('094f78f0-48d3-57c9-ab37-96e33d168a59', '11111111-1111-4111-8111-111111111111', 'nba-jalen-johnson', 'Jalen Johnson', 'ATL', 1),
  ('f9b30df5-c146-5411-b660-34de3299a224', '11111111-1111-4111-8111-111111111111', 'nba-dyson-daniels', 'Dyson Daniels', 'ATL', 2),
  ('26e63941-66a7-5a15-9299-68f11cfc9574', '11111111-1111-4111-8111-111111111111', 'nba-onyeka-okongwu', 'Onyeka Okongwu', 'ATL', 3),
  ('9e12a870-ef63-5d8f-a285-0778af66f94b', '11111111-1111-4111-8111-111111111111', 'nba-nickeil-alexander-walker', 'Nickeil Alexander-Walker', 'ATL', 4),
  ('134f65f8-ae80-5e80-a9ec-b705547c171c', '11111111-1111-4111-8111-111111111111', 'nba-corey-kispert', 'Corey Kispert', 'ATL', 5),
  ('4dfed4f0-17d8-5d81-94f7-060933e62f6b', '11111111-1111-4111-8111-111111111111', 'nba-zaccharie-risacher', 'Zaccharie Risacher', 'ATL', 6),
  ('f4fa9e08-1752-5689-946b-6344f5a03190', '11111111-1111-4111-8111-111111111111', 'nba-buddy-hield', 'Buddy Hield', 'ATL', 7),
  ('b1605b92-44ba-5a04-805f-5d4101fa618e', '11111111-1111-4111-8111-111111111111', 'nba-aaron-wiggins', 'Aaron Wiggins', 'ATL', 8),
  ('6a78c79b-1d6b-545e-92c3-632f36e76713', '11111111-1111-4111-8111-111111111111', 'nba-devin-carter', 'Devin Carter', 'ATL', 9),
  ('2ed1f667-c655-57fa-9abc-d1e78934dcaf', '11111111-1111-4111-8111-111111111111', 'nba-jayson-tatum', 'Jayson Tatum', 'BOS', 10),
  ('2c1a1f99-725d-53d0-95a3-8d4a6c6d5f3f', '11111111-1111-4111-8111-111111111111', 'nba-paul-george', 'Paul George', 'BOS', 11),
  ('7271416a-db22-5cf0-8d84-f462df57064b', '11111111-1111-4111-8111-111111111111', 'nba-derrick-white', 'Derrick White', 'BOS', 12),
  ('a02847cb-848b-5e11-86f0-ec829ac5eefd', '11111111-1111-4111-8111-111111111111', 'nba-mitchell-robinson', 'Mitchell Robinson', 'BOS', 13),
  ('7cfd8819-9fb0-5f05-b730-ee019e391fd0', '11111111-1111-4111-8111-111111111111', 'nba-sam-hauser', 'Sam Hauser', 'BOS', 14),
  ('01676dc1-b40f-53f9-a2b7-61381f9fdbe6', '11111111-1111-4111-8111-111111111111', 'nba-payton-pritchard', 'Payton Pritchard', 'BOS', 15),
  ('10d382ae-c89e-513d-aaeb-47db52bee24f', '11111111-1111-4111-8111-111111111111', 'nba-hugo-gonzalez', 'Hugo Gonzalez', 'BOS', 16),
  ('bc072cbe-0e17-539b-b555-8847c0b6917f', '11111111-1111-4111-8111-111111111111', 'nba-luka-garza', 'Luka Garza', 'BOS', 17),
  ('8b3cdcc2-efd8-5a08-96e2-9e2d79695b1b', '11111111-1111-4111-8111-111111111111', 'nba-baylor-scheierman', 'Baylor Scheierman', 'BOS', 18),
  ('d6e695a3-fb5f-5610-9c71-f29abb117d87', '11111111-1111-4111-8111-111111111111', 'nba-neemias-queta', 'Neemias Queta', 'BOS', 19),
  ('1f9cbeb7-697e-5b70-b7bd-1f6cc4da7a0c', '11111111-1111-4111-8111-111111111111', 'nba-michael-porter-jr', 'Michael Porter Jr.', 'BKN', 20),
  ('6c930ad7-a5c9-523c-a0b1-f206c3f1e4af', '11111111-1111-4111-8111-111111111111', 'nba-julius-randle', 'Julius Randle', 'BKN', 21),
  ('1fbdd360-6745-5c64-9ebb-1da8cc6aa52c', '11111111-1111-4111-8111-111111111111', 'nba-terance-mann', 'Terance Mann', 'BKN', 22),
  ('dec65b0b-c9bb-5845-88a5-10417cb6c5b2', '11111111-1111-4111-8111-111111111111', 'nba-egor-demin', 'Egor Demin', 'BKN', 23),
  ('b7c40b68-5988-57c2-8a42-8b55eb00e9f6', '11111111-1111-4111-8111-111111111111', 'nba-day-ron-sharpe', 'Day''Ron Sharpe', 'BKN', 24),
  ('80f1a319-b1f1-50f2-9fb3-31e353d75e56', '11111111-1111-4111-8111-111111111111', 'nba-noah-clowney', 'Noah Clowney', 'BKN', 25),
  ('d3cf8c12-060f-5ffe-924b-50e36c7d252a', '11111111-1111-4111-8111-111111111111', 'nba-moritz-wagner', 'Moritz Wagner', 'BKN', 26),
  ('82231779-15b2-56dc-b7e5-d0fe83138317', '11111111-1111-4111-8111-111111111111', 'nba-nolan-traore', 'Nolan Traore', 'BKN', 27),
  ('09da131c-6bae-5d71-802e-75cbf17b664a', '11111111-1111-4111-8111-111111111111', 'nba-drake-powell', 'Drake Powell', 'BKN', 28),
  ('d92bd6e5-b687-55fa-97c6-d7090e491b3b', '11111111-1111-4111-8111-111111111111', 'nba-ben-saraf', 'Ben Saraf', 'BKN', 29),
  ('468c9c50-f56b-5fce-9fb6-6a2724a66e10', '11111111-1111-4111-8111-111111111111', 'nba-naz-reid', 'Naz Reid', 'CHA', 30),
  ('f8ffd933-191f-5694-bba3-3b7fa8bfadee', '11111111-1111-4111-8111-111111111111', 'nba-grayson-allen', 'Grayson Allen', 'CHA', 31),
  ('22007959-fbed-59ec-a385-e0cb269fa660', '11111111-1111-4111-8111-111111111111', 'nba-brandon-miller', 'Brandon Miller', 'CHA', 32),
  ('90b4a826-4701-5f10-b16c-bb116ba022f4', '11111111-1111-4111-8111-111111111111', 'nba-grant-williams', 'Grant Williams', 'CHA', 33),
  ('56d73a2c-a081-5cd8-8f62-957101dccc8b', '11111111-1111-4111-8111-111111111111', 'nba-dorian-finney-smith', 'Dorian Finney-Smith', 'CHA', 34),
  ('a996d29d-f3c1-5ce2-b391-ed1f193d3209', '11111111-1111-4111-8111-111111111111', 'nba-coby-white', 'Coby White', 'CHA', 35),
  ('7488bb47-7583-5e72-9f08-9acb6ecac136', '11111111-1111-4111-8111-111111111111', 'nba-royce-o-neale', 'Royce O''Neale', 'CHA', 36),
  ('8594243b-e38b-53c2-95dc-598634a20bac', '11111111-1111-4111-8111-111111111111', 'nba-kon-knueppel', 'Kon Knueppel', 'CHA', 37),
  ('9b74f32f-85a4-57a6-8b28-488167eba2e3', '11111111-1111-4111-8111-111111111111', 'nba-tidjane-salaun', 'Tidjane Salaun', 'CHA', 38),
  ('24b76b75-e99d-5ada-b7e0-e375f83aeb55', '11111111-1111-4111-8111-111111111111', 'nba-tre-mann', 'Tre Mann', 'CHA', 39),
  ('9f64a701-8882-5b74-889f-b75c18e13219', '11111111-1111-4111-8111-111111111111', 'nba-josh-giddey', 'Josh Giddey', 'CHI', 40),
  ('0e63f09b-0d32-5e76-891b-35f2ab1ddf04', '11111111-1111-4111-8111-111111111111', 'nba-nic-claxton', 'Nic Claxton', 'CHI', 41),
  ('618b4f9b-c1fb-5664-a486-07a276811d86', '11111111-1111-4111-8111-111111111111', 'nba-norman-powell', 'Norman Powell', 'CHI', 42),
  ('eb695ebf-d3d4-599d-9b64-844466388c89', '11111111-1111-4111-8111-111111111111', 'nba-zach-collins', 'Zach Collins', 'CHI', 43),
  ('3a4035d9-1a74-5dc8-8e88-4d83d977dc16', '11111111-1111-4111-8111-111111111111', 'nba-patrick-williams', 'Patrick Williams', 'CHI', 44),
  ('8068bac5-c6c8-5b91-ab3b-03efbda3048c', '11111111-1111-4111-8111-111111111111', 'nba-isaac-okoro', 'Isaac Okoro', 'CHI', 45),
  ('373e582f-14ea-5643-8e3a-42eac246deb7', '11111111-1111-4111-8111-111111111111', 'nba-jalen-smith', 'Jalen Smith', 'CHI', 46),
  ('c674bb54-3222-5f78-832b-76eeee3fd2c6', '11111111-1111-4111-8111-111111111111', 'nba-tre-jones', 'Tre Jones', 'CHI', 47),
  ('64cd3fcf-900d-589d-9b1b-d894d6a0a332', '11111111-1111-4111-8111-111111111111', 'nba-rob-dillingham', 'Rob Dillingham', 'CHI', 48),
  ('0b6da973-3637-542a-b739-cb49033d0dea', '11111111-1111-4111-8111-111111111111', 'nba-matas-buzelis', 'Matas Buzelis', 'CHI', 49),
  ('634dca13-2944-5c6d-b6a4-b4999614970c', '11111111-1111-4111-8111-111111111111', 'nba-donovan-mitchell', 'Donovan Mitchell', 'CLE', 50),
  ('20c07e30-23fd-580f-8b73-e2730f6c99cb', '11111111-1111-4111-8111-111111111111', 'nba-evan-mobley', 'Evan Mobley', 'CLE', 51),
  ('e2d46caf-3409-577c-ac9f-324d1e254dfa', '11111111-1111-4111-8111-111111111111', 'nba-james-harden', 'James Harden', 'CLE', 52),
  ('bc06a675-014f-5c30-af59-15bef9d089a5', '11111111-1111-4111-8111-111111111111', 'nba-jarrett-allen', 'Jarrett Allen', 'CLE', 53),
  ('f2174ac7-03ea-5f66-b2fb-e018f4f40f4a', '11111111-1111-4111-8111-111111111111', 'nba-max-strus', 'Max Strus', 'CLE', 54),
  ('1a14b60c-8a93-5c8f-b251-9fa90870cd97', '11111111-1111-4111-8111-111111111111', 'nba-dennis-schroder', 'Dennis Schroder', 'CLE', 55),
  ('f976799e-033c-5aa2-9f81-82d910371c10', '11111111-1111-4111-8111-111111111111', 'nba-sam-merrill', 'Sam Merrill', 'CLE', 56),
  ('7581ae92-b2d1-501e-ac6c-34ed65f36507', '11111111-1111-4111-8111-111111111111', 'nba-jaylon-tyson', 'Jaylon Tyson', 'CLE', 57),
  ('70956387-260b-5099-a6de-a1919884bf23', '11111111-1111-4111-8111-111111111111', 'nba-nae-qwan-tomlin', 'Nae''Qwan Tomlin', 'CLE', 58),
  ('94867cc7-6ad5-5878-a4dd-6c04784353a4', '11111111-1111-4111-8111-111111111111', 'nba-craig-porter-jr', 'Craig Porter Jr.', 'CLE', 59),
  ('28d9cd4a-dd1b-5ed4-a417-ba07c4f0ac5e', '11111111-1111-4111-8111-111111111111', 'nba-kyrie-irving', 'Kyrie Irving', 'DAL', 60),
  ('aba007c8-ae04-5714-b167-de9200025f29', '11111111-1111-4111-8111-111111111111', 'nba-p-j-washington', 'P.J. Washington', 'DAL', 61),
  ('af83c7cd-af3b-5c97-93aa-bb4bd783c81e', '11111111-1111-4111-8111-111111111111', 'nba-klay-thompson', 'Klay Thompson', 'DAL', 62),
  ('97cb70d9-fc4d-5ac6-a739-7f6716e56c9e', '11111111-1111-4111-8111-111111111111', 'nba-daniel-gafford', 'Daniel Gafford', 'DAL', 63),
  ('757dbf65-4b87-5614-9b45-b4e5db8e1caf', '11111111-1111-4111-8111-111111111111', 'nba-santi-aldama', 'Santi Aldama', 'DAL', 64),
  ('d39e4040-7ec8-5f81-aba8-03f58716b5fe', '11111111-1111-4111-8111-111111111111', 'nba-cooper-flagg', 'Cooper Flagg', 'DAL', 65),
  ('65d68852-45ae-5a29-b4dc-ebdc3b15f3e8', '11111111-1111-4111-8111-111111111111', 'nba-caleb-martin', 'Caleb Martin', 'DAL', 66),
  ('52b860ad-037c-5817-a47a-0c54099d261a', '11111111-1111-4111-8111-111111111111', 'nba-naji-marshall', 'Naji Marshall', 'DAL', 67),
  ('16cdfca1-344e-57a9-ab47-a69ef246a373', '11111111-1111-4111-8111-111111111111', 'nba-max-christie', 'Max Christie', 'DAL', 68),
  ('8134e5b8-caca-5078-99ec-c5e40ebd3476', '11111111-1111-4111-8111-111111111111', 'nba-dereck-lively-ii', 'Dereck Lively II', 'DAL', 69),
  ('a0e96675-37b6-571a-b77b-4a67fb33ee40', '11111111-1111-4111-8111-111111111111', 'nba-nikola-jokic', 'Nikola Jokić', 'DEN', 70),
  ('2af0cd37-ca0a-5a43-b134-4d5a887b50fa', '11111111-1111-4111-8111-111111111111', 'nba-jamal-murray', 'Jamal Murray', 'DEN', 71),
  ('e04e60c7-bf03-5afc-a928-0f0d1f376cad', '11111111-1111-4111-8111-111111111111', 'nba-aaron-gordon', 'Aaron Gordon', 'DEN', 72),
  ('0158b5c5-ae59-5db0-a396-ce8f6e899190', '11111111-1111-4111-8111-111111111111', 'nba-cameron-johnson', 'Cameron Johnson', 'DEN', 73),
  ('e2e29ccd-c541-5597-b149-8a53eb798cc4', '11111111-1111-4111-8111-111111111111', 'nba-christian-braun', 'Christian Braun', 'DEN', 74),
  ('19e8aa91-5447-5c8a-a84b-5982cff3819c', '11111111-1111-4111-8111-111111111111', 'nba-zeke-nnaji', 'Zeke Nnaji', 'DEN', 75),
  ('4798330c-49d1-5473-ba4a-4872bf31d8de', '11111111-1111-4111-8111-111111111111', 'nba-julian-strawther', 'Julian Strawther', 'DEN', 76),
  ('3ad2cf7f-aa18-5c42-9702-08af45a55029', '11111111-1111-4111-8111-111111111111', 'nba-peyton-watson', 'Peyton Watson', 'DEN', 77),
  ('329b94df-0c19-5489-8a22-510713c04439', '11111111-1111-4111-8111-111111111111', 'nba-daron-holmes-ii', 'DaRon Holmes II', 'DEN', 78),
  ('3dfdd039-1434-5bd8-b7f3-3f35307e2c95', '11111111-1111-4111-8111-111111111111', 'nba-jalen-pickett', 'Jalen Pickett', 'DEN', 79),
  ('d5e7eef5-29a1-59c5-936c-768d57d87cce', '11111111-1111-4111-8111-111111111111', 'nba-cade-cunningham', 'Cade Cunningham', 'DET', 80),
  ('17e01665-d2d0-5d29-9b53-b637cb1b530f', '11111111-1111-4111-8111-111111111111', 'nba-john-collins', 'John Collins', 'DET', 81),
  ('d5e4eda5-e056-5c6f-b467-05441872c588', '11111111-1111-4111-8111-111111111111', 'nba-kevin-huerter', 'Kevin Huerter', 'DET', 82),
  ('1fd606d4-e02c-5238-b317-4480e5570159', '11111111-1111-4111-8111-111111111111', 'nba-duncan-robinson', 'Duncan Robinson', 'DET', 83),
  ('98bb893b-59c3-57a4-bad0-63f6f92f6abf', '11111111-1111-4111-8111-111111111111', 'nba-isaiah-joe', 'Isaiah Joe', 'DET', 84),
  ('90d8c73a-a53f-50cd-93e3-ba4e6ba2c0da', '11111111-1111-4111-8111-111111111111', 'nba-ausar-thompson', 'Ausar Thompson', 'DET', 85),
  ('a1116b7e-ec74-5376-915a-4eeb73045914', '11111111-1111-4111-8111-111111111111', 'nba-ronald-holland-ii', 'Ronald Holland II', 'DET', 86),
  ('23c3b4d0-10f3-5b8d-b187-823ee903384b', '11111111-1111-4111-8111-111111111111', 'nba-jalen-duren', 'Jalen Duren', 'DET', 87),
  ('c3426c5b-c0ea-5a1d-b4c6-8ce49a427955', '11111111-1111-4111-8111-111111111111', 'nba-paul-reed', 'Paul Reed', 'DET', 88),
  ('a07034e7-3522-5c2f-bf37-03505fb0abfc', '11111111-1111-4111-8111-111111111111', 'nba-daniss-jenkins', 'Daniss Jenkins', 'DET', 89),
  ('017e2b74-9722-5ff5-9273-4b183f8e4d83', '11111111-1111-4111-8111-111111111111', 'nba-stephen-curry', 'Stephen Curry', 'GSW', 90),
  ('ceb8295e-3137-50c8-b6c5-41731dc448eb', '11111111-1111-4111-8111-111111111111', 'nba-jimmy-butler-iii', 'Jimmy Butler III', 'GSW', 91),
  ('fe550f73-41c7-56bb-b6dc-25ae0ee99bee', '11111111-1111-4111-8111-111111111111', 'nba-kristaps-porzingis', 'Kristaps Porzingis', 'GSW', 92),
  ('41bdb75d-d74e-5f88-aff9-812b512d8983', '11111111-1111-4111-8111-111111111111', 'nba-draymond-green', 'Draymond Green', 'GSW', 93),
  ('0fa500d9-dccc-5414-af08-dfd6aa4d0761', '11111111-1111-4111-8111-111111111111', 'nba-moses-moody', 'Moses Moody', 'GSW', 94),
  ('46b593ab-6bbb-5808-9dfb-2b9102eadac9', '11111111-1111-4111-8111-111111111111', 'nba-al-horford', 'Al Horford', 'GSW', 95),
  ('d9b60fd2-599c-587a-9b4c-c0e5942e1fe1', '11111111-1111-4111-8111-111111111111', 'nba-brandin-podziemski', 'Brandin Podziemski', 'GSW', 96),
  ('b11a3015-c3dc-58c5-9de1-751077ec7616', '11111111-1111-4111-8111-111111111111', 'nba-gui-santos', 'Gui Santos', 'GSW', 97),
  ('9436a5ac-69e8-5fcf-a2b7-b669da840aaa', '11111111-1111-4111-8111-111111111111', 'nba-de-anthony-melton', 'De''Anthony Melton', 'GSW', 98),
  ('c0f53b94-3956-5755-8996-037fb0cd30c0', '11111111-1111-4111-8111-111111111111', 'nba-charles-bassey', 'Charles Bassey', 'GSW', 99),
  ('7cb51125-f64a-5f25-bc28-3a1a2436cc73', '11111111-1111-4111-8111-111111111111', 'nba-kevin-durant', 'Kevin Durant', 'HOU', 100),
  ('180327f4-70f7-5ce4-848a-265319749781', '11111111-1111-4111-8111-111111111111', 'nba-alperen-sengun', 'Alperen Sengun', 'HOU', 101),
  ('e16c653e-80ef-54e2-8c36-2ae631561d9c', '11111111-1111-4111-8111-111111111111', 'nba-fred-vanvleet', 'Fred VanVleet', 'HOU', 102),
  ('73fa6bfc-df11-5cbe-b46b-fd55033ffeb9', '11111111-1111-4111-8111-111111111111', 'nba-jabari-smith-jr', 'Jabari Smith Jr.', 'HOU', 103),
  ('7d078a05-e9c6-5aa8-9def-7dbd10181084', '11111111-1111-4111-8111-111111111111', 'nba-bogdan-bogdanovic', 'Bogdan Bogdanović', 'HOU', 104),
  ('c176fe28-5127-5ea3-a3f0-3ae4b1ebb7d9', '11111111-1111-4111-8111-111111111111', 'nba-steven-adams', 'Steven Adams', 'HOU', 105),
  ('be7c8ce7-fd27-5f50-91b4-e9ef14609c31', '11111111-1111-4111-8111-111111111111', 'nba-amen-thompson', 'Amen Thompson', 'HOU', 106),
  ('8e8ae5ef-1730-5d0b-b630-02793f1d7b79', '11111111-1111-4111-8111-111111111111', 'nba-reed-sheppard', 'Reed Sheppard', 'HOU', 107),
  ('16001b4e-1469-5ab2-8843-2f55753b4ace', '11111111-1111-4111-8111-111111111111', 'nba-clint-capela', 'Clint Capela', 'HOU', 108),
  ('c9da9edc-1c31-5b4d-898d-70c4a6e61403', '11111111-1111-4111-8111-111111111111', 'nba-tari-eason', 'Tari Eason', 'HOU', 109),
  ('8f7f0ade-bdd3-5461-bd2a-47518e2b7b40', '11111111-1111-4111-8111-111111111111', 'nba-pascal-siakam', 'Pascal Siakam', 'IND', 110),
  ('090d80c5-91b7-5557-b720-e0d017b160dc', '11111111-1111-4111-8111-111111111111', 'nba-tyrese-haliburton', 'Tyrese Haliburton', 'IND', 111),
  ('26591069-ddf4-54be-9bce-ef51ff6141a7', '11111111-1111-4111-8111-111111111111', 'nba-ivica-zubac', 'Ivica Zubac', 'IND', 112),
  ('8daf632e-aee1-5271-9590-5e1db5c55375', '11111111-1111-4111-8111-111111111111', 'nba-andrew-nembhard', 'Andrew Nembhard', 'IND', 113),
  ('9e6031ff-5ddb-5498-aee3-c8f8607afbef', '11111111-1111-4111-8111-111111111111', 'nba-obi-toppin', 'Obi Toppin', 'IND', 114),
  ('76a9ef17-ee46-586d-82e4-5f4ec56d312d', '11111111-1111-4111-8111-111111111111', 'nba-aaron-nesmith', 'Aaron Nesmith', 'IND', 115),
  ('57931dbd-4127-550a-b820-3b567b519f7a', '11111111-1111-4111-8111-111111111111', 'nba-t-j-mcconnell', 'T.J. McConnell', 'IND', 116),
  ('8fff2b90-7818-5250-bfed-bf6829021bdb', '11111111-1111-4111-8111-111111111111', 'nba-jarace-walker', 'Jarace Walker', 'IND', 117),
  ('c9924641-2472-5fae-b969-6efdac063dc8', '11111111-1111-4111-8111-111111111111', 'nba-kelly-oubre-jr', 'Kelly Oubre Jr.', 'IND', 118),
  ('6d87658b-3a52-587b-830e-5af6b8cfce8c', '11111111-1111-4111-8111-111111111111', 'nba-ben-sheppard', 'Ben Sheppard', 'IND', 119),
  ('9d98c82e-cc41-5301-b116-8cc1c99e5678', '11111111-1111-4111-8111-111111111111', 'nba-kawhi-leonard', 'Kawhi Leonard', 'LAC', 120),
  ('57968b69-cce3-5c42-b4ab-57842732c0cc', '11111111-1111-4111-8111-111111111111', 'nba-darius-garland', 'Darius Garland', 'LAC', 121),
  ('0247b6aa-b950-5275-9de8-c472db8ccfc8', '11111111-1111-4111-8111-111111111111', 'nba-rui-hachimura', 'Rui Hachimura', 'LAC', 122),
  ('f5587e83-beeb-5382-ad89-892b891e0495', '11111111-1111-4111-8111-111111111111', 'nba-derrick-jones-jr', 'Derrick Jones Jr.', 'LAC', 123),
  ('eec5ed64-5fb2-555b-aea1-d4d65b4113fe', '11111111-1111-4111-8111-111111111111', 'nba-bennedict-mathurin', 'Bennedict Mathurin', 'LAC', 124),
  ('1f94d999-b114-587d-9ecf-5f3b741c53a9', '11111111-1111-4111-8111-111111111111', 'nba-brook-lopez', 'Brook Lopez', 'LAC', 125),
  ('bff4f701-bd93-57b1-8315-8c99ddcc6a98', '11111111-1111-4111-8111-111111111111', 'nba-isaiah-jackson', 'Isaiah Jackson', 'LAC', 126),
  ('4cfe62fd-a5e2-5f1c-a9f7-78eddc1b4550', '11111111-1111-4111-8111-111111111111', 'nba-kris-dunn', 'Kris Dunn', 'LAC', 127),
  ('9ef5b8f0-29db-5191-bd20-edc179fe16c7', '11111111-1111-4111-8111-111111111111', 'nba-yanic-konan-niederhauser', 'Yanic Konan Niederhauser', 'LAC', 128),
  ('445686f0-a416-5cec-a6ab-e064d2a2b32f', '11111111-1111-4111-8111-111111111111', 'nba-jordan-miller', 'Jordan Miller', 'LAC', 129),
  ('b8934fdb-2951-5b51-9688-b7e73d652c67', '11111111-1111-4111-8111-111111111111', 'nba-luka-doncic', 'Luka Dončić', 'LAL', 130),
  ('945db8e7-ebf3-5c3d-935e-41a03de5c3b0', '11111111-1111-4111-8111-111111111111', 'nba-lebron-james', 'LeBron James', 'LAL', 131),
  ('ee9c2600-494d-5759-ad27-5f60b93f5dcc', '11111111-1111-4111-8111-111111111111', 'nba-collin-sexton', 'Collin Sexton', 'LAL', 132),
  ('dff96553-9113-5967-a004-22136e92da6c', '11111111-1111-4111-8111-111111111111', 'nba-austin-reaves', 'Austin Reaves', 'LAL', 133),
  ('c3f544f8-6788-5425-890b-57dd965f9b84', '11111111-1111-4111-8111-111111111111', 'nba-jarred-vanderbilt', 'Jarred Vanderbilt', 'LAL', 134),
  ('d20d6f32-b9c1-5185-9e7f-acea7fd24da8', '11111111-1111-4111-8111-111111111111', 'nba-quentin-grimes', 'Quentin Grimes', 'LAL', 135),
  ('de0c421f-ad96-5a10-9426-ef4a18da5982', '11111111-1111-4111-8111-111111111111', 'nba-kevon-looney', 'Kevon Looney', 'LAL', 136),
  ('c79a45b2-a541-5986-8d85-81674671709f', '11111111-1111-4111-8111-111111111111', 'nba-ziaire-williams', 'Ziaire Williams', 'LAL', 137),
  ('14f84547-a14a-5e42-acba-1dc8ae82bbba', '11111111-1111-4111-8111-111111111111', 'nba-jake-laravia', 'Jake LaRavia', 'LAL', 138),
  ('33beff5c-4e4a-57f4-8c31-48886becbe1b', '11111111-1111-4111-8111-111111111111', 'nba-walker-kessler', 'Walker Kessler', 'LAL', 139),
  ('1ae1d4c7-baed-592e-a42b-f9da6c543f0b', '11111111-1111-4111-8111-111111111111', 'nba-jerami-grant', 'Jerami Grant', 'MEM', 140),
  ('e5a965a1-4988-586a-b6d2-8ce4d5b21df5', '11111111-1111-4111-8111-111111111111', 'nba-kentavious-caldwell-pope', 'Kentavious Caldwell-Pope', 'MEM', 141),
  ('fa65d721-2dae-59ed-88c9-84f6a19a95ba', '11111111-1111-4111-8111-111111111111', 'nba-isaiah-stewart', 'Isaiah Stewart', 'MEM', 142),
  ('f1391f99-5608-55d4-84b5-e9f327a541f0', '11111111-1111-4111-8111-111111111111', 'nba-ty-jerome', 'Ty Jerome', 'MEM', 143),
  ('bf75e797-6101-5263-8b25-a8a239235bd7', '11111111-1111-4111-8111-111111111111', 'nba-taylor-hendricks', 'Taylor Hendricks', 'MEM', 144),
  ('12e681de-cc8f-57d8-b72e-2138d2a8d4b6', '11111111-1111-4111-8111-111111111111', 'nba-zach-edey', 'Zach Edey', 'MEM', 145),
  ('90410c57-7d67-56cb-89ef-e369f45dc704', '11111111-1111-4111-8111-111111111111', 'nba-cedric-coward', 'Cedric Coward', 'MEM', 146),
  ('10fbff1b-0089-5d64-b267-2ad6516ac3a1', '11111111-1111-4111-8111-111111111111', 'nba-d-angelo-russell', 'D''Angelo Russell', 'MEM', 147),
  ('f0ee5085-3529-5391-ac26-7ef370c80039', '11111111-1111-4111-8111-111111111111', 'nba-kris-murray', 'Kris Murray', 'MEM', 148),
  ('c691dc77-d9c2-572a-9400-5d1e3ac86b55', '11111111-1111-4111-8111-111111111111', 'nba-walter-clayton-jr', 'Walter Clayton Jr.', 'MEM', 149),
  ('47844cee-92cd-5d9c-b69f-593dbd46f4c6', '11111111-1111-4111-8111-111111111111', 'nba-giannis-antetokounmpo', 'Giannis Antetokounmpo', 'MIA', 150),
  ('532119a6-e565-58a0-8ed4-f8842aadb8c1', '11111111-1111-4111-8111-111111111111', 'nba-bam-adebayo', 'Bam Adebayo', 'MIA', 151),
  ('756222ff-52d4-58a3-bcfd-6c0bc08c3f4b', '11111111-1111-4111-8111-111111111111', 'nba-andrew-wiggins', 'Andrew Wiggins', 'MIA', 152),
  ('7965d54a-8ad8-55f0-8b04-480967e91d9e', '11111111-1111-4111-8111-111111111111', 'nba-nikola-jovic', 'Nikola Jović', 'MIA', 153),
  ('d92fd1bc-f428-52bf-8f0f-36311ea00ae5', '11111111-1111-4111-8111-111111111111', 'nba-bobby-portis', 'Bobby Portis', 'MIA', 154),
  ('ea8688d2-a5d1-563a-b0fb-b46db006e873', '11111111-1111-4111-8111-111111111111', 'nba-davion-mitchell', 'Davion Mitchell', 'MIA', 155),
  ('3dc7d455-7cbf-5160-8e21-502afe55bce0', '11111111-1111-4111-8111-111111111111', 'nba-simone-fontecchio', 'Simone Fontecchio', 'MIA', 156),
  ('7ea4cc3a-f7aa-5125-9ab8-5365f1a784dd', '11111111-1111-4111-8111-111111111111', 'nba-dru-smith', 'Dru Smith', 'MIA', 157),
  ('433feaa6-b514-54fa-9907-f228008cd4cf', '11111111-1111-4111-8111-111111111111', 'nba-tim-hardaway-jr', 'Tim Hardaway Jr.', 'MIA', 158),
  ('bbcd3da4-ae66-5fcd-b959-8644320f8e39', '11111111-1111-4111-8111-111111111111', 'nba-pelle-larsson', 'Pelle Larsson', 'MIA', 159),
  ('97dc4a23-7ffe-5487-86cb-1b0946fc0eaf', '11111111-1111-4111-8111-111111111111', 'nba-tyler-herro', 'Tyler Herro', 'MIL', 160),
  ('6700264a-257d-5dc7-94f4-f503a920b686', '11111111-1111-4111-8111-111111111111', 'nba-myles-turner', 'Myles Turner', 'MIL', 161),
  ('59424fc9-8445-51ba-847c-e825a459fd7d', '11111111-1111-4111-8111-111111111111', 'nba-kyle-kuzma', 'Kyle Kuzma', 'MIL', 162),
  ('8eb3e988-e167-55a0-a87d-e6981fe5dba6', '11111111-1111-4111-8111-111111111111', 'nba-caris-levert', 'Caris LeVert', 'MIL', 163),
  ('db018d85-bf34-5e27-92b0-538712eec8ea', '11111111-1111-4111-8111-111111111111', 'nba-aj-green', 'AJ Green', 'MIL', 164),
  ('552db30e-38de-5a6a-83bc-f774d287dba2', '11111111-1111-4111-8111-111111111111', 'nba-ousmane-dieng', 'Ousmane Dieng', 'MIL', 165),
  ('92d976c1-d8cf-538a-88f5-63319e8346af', '11111111-1111-4111-8111-111111111111', 'nba-jaime-jaquez-jr', 'Jaime Jaquez Jr.', 'MIL', 166),
  ('1320a938-f24f-58f5-8413-9aef81e53233', '11111111-1111-4111-8111-111111111111', 'nba-kevin-porter-jr', 'Kevin Porter Jr.', 'MIL', 167),
  ('018dbbf4-862f-51f8-a34b-0a694f89fdf0', '11111111-1111-4111-8111-111111111111', 'nba-kel-el-ware', 'Kel''el Ware', 'MIL', 168),
  ('aa908742-b121-5735-9195-c1de3eebb68e', '11111111-1111-4111-8111-111111111111', 'nba-ryan-rollins', 'Ryan Rollins', 'MIL', 169),
  ('c2b81f21-46a8-5b13-99a2-db197292bf38', '11111111-1111-4111-8111-111111111111', 'nba-anthony-edwards', 'Anthony Edwards', 'MIN', 170),
  ('f3663088-c877-5038-b3a0-e704a54c4c36', '11111111-1111-4111-8111-111111111111', 'nba-lamelo-ball', 'LaMelo Ball', 'MIN', 171),
  ('273bc52f-8c62-54e1-95e4-cf7cac272d72', '11111111-1111-4111-8111-111111111111', 'nba-rudy-gobert', 'Rudy Gobert', 'MIN', 172),
  ('c334b171-623e-57f1-8c40-622af07854db', '11111111-1111-4111-8111-111111111111', 'nba-jaden-mcdaniels', 'Jaden McDaniels', 'MIN', 173),
  ('ad01f4bf-4b05-5a2c-a1bd-269facf4522b', '11111111-1111-4111-8111-111111111111', 'nba-josh-green', 'Josh Green', 'MIN', 174),
  ('c0dfb2ab-afbe-5256-984c-47f10151bc04', '11111111-1111-4111-8111-111111111111', 'nba-donte-divincenzo', 'Donte DiVincenzo', 'MIN', 175),
  ('4e5c7b43-fbcf-5ac2-bebe-9f6739f34433', '11111111-1111-4111-8111-111111111111', 'nba-trey-lyles', 'Trey Lyles', 'MIN', 176),
  ('15957e64-ac53-5363-aa00-4dd6462fc7f8', '11111111-1111-4111-8111-111111111111', 'nba-ayo-dosunmu', 'Ayo Dosunmu', 'MIN', 177),
  ('b22660dc-0186-5ad0-9a69-ea0a8b8b58e6', '11111111-1111-4111-8111-111111111111', 'nba-joan-beringer', 'Joan Beringer', 'MIN', 178),
  ('30695469-2c11-5cdb-930c-9a3345c8f3ed', '11111111-1111-4111-8111-111111111111', 'nba-terrence-shannon-jr', 'Terrence Shannon Jr.', 'MIN', 179),
  ('d1f207e5-1b45-5b13-8672-2291f682bdd9', '11111111-1111-4111-8111-111111111111', 'nba-zion-williamson', 'Zion Williamson', 'NOP', 180),
  ('64895673-ae53-5f91-b9fd-06622b389787', '11111111-1111-4111-8111-111111111111', 'nba-jordan-poole', 'Jordan Poole', 'NOP', 181),
  ('da7e1c38-2b9e-57f9-acb2-d099f15b4883', '11111111-1111-4111-8111-111111111111', 'nba-dejounte-murray', 'Dejounte Murray', 'NOP', 182),
  ('ad05cab8-e0e1-5fd1-97fd-df8c8eea3c74', '11111111-1111-4111-8111-111111111111', 'nba-trey-murphy-iii', 'Trey Murphy III', 'NOP', 183),
  ('0ce69187-f547-5c7f-b3ef-78153756a99f', '11111111-1111-4111-8111-111111111111', 'nba-herbert-jones', 'Herbert Jones', 'NOP', 184),
  ('eb27f503-0e5c-5866-a44e-174de9451697', '11111111-1111-4111-8111-111111111111', 'nba-jeremiah-fears', 'Jeremiah Fears', 'NOP', 185),
  ('abfb5901-50bc-5fde-badf-6e7658ef8939', '11111111-1111-4111-8111-111111111111', 'nba-jordan-hawkins', 'Jordan Hawkins', 'NOP', 186),
  ('d2197b51-67c2-5495-a382-bf594bb9ff2e', '11111111-1111-4111-8111-111111111111', 'nba-saddiq-bey', 'Saddiq Bey', 'NOP', 187),
  ('e9f6a6ff-20c4-59d1-8ec7-7ba286559e87', '11111111-1111-4111-8111-111111111111', 'nba-derik-queen', 'Derik Queen', 'NOP', 188),
  ('924a94fa-a123-5acb-a902-488fc86ecb77', '11111111-1111-4111-8111-111111111111', 'nba-yves-missi', 'Yves Missi', 'NOP', 189),
  ('3acc64ae-773e-5d44-b340-921d6f488e83', '11111111-1111-4111-8111-111111111111', 'nba-karl-anthony-towns', 'Karl-Anthony Towns', 'NYK', 190),
  ('408d42de-a85f-58b1-ac25-dae42029dde2', '11111111-1111-4111-8111-111111111111', 'nba-og-anunoby', 'OG Anunoby', 'NYK', 191),
  ('99dfd60c-c6d6-5a96-8e0c-4766ca918088', '11111111-1111-4111-8111-111111111111', 'nba-jalen-brunson', 'Jalen Brunson', 'NYK', 192),
  ('b892ebcd-86b4-538e-b559-7be8c4684ca4', '11111111-1111-4111-8111-111111111111', 'nba-mikal-bridges', 'Mikal Bridges', 'NYK', 193),
  ('30167d9a-6cd1-5721-a357-0d85d879f2a3', '11111111-1111-4111-8111-111111111111', 'nba-josh-hart', 'Josh Hart', 'NYK', 194),
  ('4583cb67-12ec-5b2b-9674-3c1cd3b89156', '11111111-1111-4111-8111-111111111111', 'nba-andre-drummond', 'Andre Drummond', 'NYK', 195),
  ('874794d6-b9c1-5911-a718-615e16482920', '11111111-1111-4111-8111-111111111111', 'nba-jose-alvarado', 'Jose Alvarado', 'NYK', 196),
  ('a2bd7774-3de1-560b-900a-2de57e942a94', '11111111-1111-4111-8111-111111111111', 'nba-miles-mcbride', 'Miles McBride', 'NYK', 197),
  ('07a9a727-71bd-55b5-a81d-17aca4ff88f3', '11111111-1111-4111-8111-111111111111', 'nba-pacome-dadiet', 'Pacome Dadiet', 'NYK', 198),
  ('11b504b1-6db9-54fb-bb1d-5a45c64f2246', '11111111-1111-4111-8111-111111111111', 'nba-jordan-clarkson', 'Jordan Clarkson', 'NYK', 199),
  ('dd836cbd-0739-5cb4-9956-f22465d543e6', '11111111-1111-4111-8111-111111111111', 'nba-chet-holmgren', 'Chet Holmgren', 'OKC', 200),
  ('9fd5a1b5-5a42-5275-b519-03ca1030c75c', '11111111-1111-4111-8111-111111111111', 'nba-jalen-williams', 'Jalen Williams', 'OKC', 201),
  ('8d57a7a4-082c-50c8-ba77-44c06af486ce', '11111111-1111-4111-8111-111111111111', 'nba-shai-gilgeous-alexander', 'Shai Gilgeous-Alexander', 'OKC', 202),
  ('ca177d6d-9a1b-59ca-96df-2d260a78b715', '11111111-1111-4111-8111-111111111111', 'nba-isaiah-hartenstein', 'Isaiah Hartenstein', 'OKC', 203),
  ('decfeee4-4e9c-5244-8a7f-aae01fb1c845', '11111111-1111-4111-8111-111111111111', 'nba-alex-caruso', 'Alex Caruso', 'OKC', 204),
  ('57e7fa44-9517-55e1-ab1e-15704e986bd5', '11111111-1111-4111-8111-111111111111', 'nba-luguentz-dort', 'Luguentz Dort', 'OKC', 205),
  ('7fed5859-76a4-5b46-8bcb-44d98f359cca', '11111111-1111-4111-8111-111111111111', 'nba-jaylin-williams', 'Jaylin Williams', 'OKC', 206),
  ('dd5976fe-1fa3-5fd5-a6bb-22236aa11d5e', '11111111-1111-4111-8111-111111111111', 'nba-cason-wallace', 'Cason Wallace', 'OKC', 207),
  ('cb9f350c-0d63-53b5-a628-96898d600ee7', '11111111-1111-4111-8111-111111111111', 'nba-kenrich-williams', 'Kenrich Williams', 'OKC', 208),
  ('704f6bfc-c57e-52fb-acbd-970714770cf6', '11111111-1111-4111-8111-111111111111', 'nba-nikola-topic', 'Nikola Topić', 'OKC', 209),
  ('ce1518d8-d703-5521-9225-741940a9d6b0', '11111111-1111-4111-8111-111111111111', 'nba-franz-wagner', 'Franz Wagner', 'ORL', 210),
  ('2c7ef32a-9a1c-52bd-9f94-daf54fce10e6', '11111111-1111-4111-8111-111111111111', 'nba-paolo-banchero', 'Paolo Banchero', 'ORL', 211),
  ('d6299e5f-2145-5338-b76d-a49eedac8dcc', '11111111-1111-4111-8111-111111111111', 'nba-desmond-bane', 'Desmond Bane', 'ORL', 212),
  ('0e6f5075-947a-5fdc-972d-bb132000435c', '11111111-1111-4111-8111-111111111111', 'nba-jalen-suggs', 'Jalen Suggs', 'ORL', 213),
  ('c1f742b5-eebf-50cc-886f-251b0e9a80e5', '11111111-1111-4111-8111-111111111111', 'nba-nikola-vucevic', 'Nikola Vučević', 'ORL', 214),
  ('43334b42-1fba-59df-8b4b-0561eab4efeb', '11111111-1111-4111-8111-111111111111', 'nba-wendell-carter-jr', 'Wendell Carter Jr.', 'ORL', 215),
  ('fa44d3ac-09ac-51e7-b3ec-67fef1abbae6', '11111111-1111-4111-8111-111111111111', 'nba-jonathan-isaac', 'Jonathan Isaac', 'ORL', 216),
  ('b376ef47-5da6-5b80-9f72-f3f6c2ff994a', '11111111-1111-4111-8111-111111111111', 'nba-anthony-black', 'Anthony Black', 'ORL', 217),
  ('4089d48e-fcc0-562f-ba08-c064bb8f28d9', '11111111-1111-4111-8111-111111111111', 'nba-goga-bitadze', 'Goga Bitadze', 'ORL', 218),
  ('2b44aeac-22c6-5190-ac6d-cb52cf8227f9', '11111111-1111-4111-8111-111111111111', 'nba-tristan-da-silva', 'Tristan da Silva', 'ORL', 219),
  ('85ac505d-60bc-5eaa-8387-9d6c704538ca', '11111111-1111-4111-8111-111111111111', 'nba-joel-embiid', 'Joel Embiid', 'PHI', 220),
  ('c27c2eaf-79b5-54e8-89d6-c10dbaa67ad2', '11111111-1111-4111-8111-111111111111', 'nba-jaylen-brown', 'Jaylen Brown', 'PHI', 221),
  ('bed68fc6-c365-5ffd-8755-8c47a7d1886c', '11111111-1111-4111-8111-111111111111', 'nba-tyrese-maxey', 'Tyrese Maxey', 'PHI', 222),
  ('dc093170-f828-58f9-8826-7d010b05b6f9', '11111111-1111-4111-8111-111111111111', 'nba-anfernee-simons', 'Anfernee Simons', 'PHI', 223),
  ('97eb52f1-9db9-5fba-86ff-77b084b33be2', '11111111-1111-4111-8111-111111111111', 'nba-vj-edgecombe', 'VJ Edgecombe', 'PHI', 224),
  ('f2ba6923-b485-5da7-8107-53976f63d516', '11111111-1111-4111-8111-111111111111', 'nba-dean-wade', 'Dean Wade', 'PHI', 225),
  ('0582184b-d5cb-513a-a6ca-7432db9ac716', '11111111-1111-4111-8111-111111111111', 'nba-dominick-barlow', 'Dominick Barlow', 'PHI', 226),
  ('0f8d7a91-cb25-56ea-acc7-8b45e0caf640', '11111111-1111-4111-8111-111111111111', 'nba-trendon-watford', 'Trendon Watford', 'PHI', 227),
  ('099068c0-e05a-56f7-9603-6ad0759b1675', '11111111-1111-4111-8111-111111111111', 'nba-jabari-walker', 'Jabari Walker', 'PHI', 228),
  ('df3eec0d-7cba-543f-b17e-3e708ae6e12a', '11111111-1111-4111-8111-111111111111', 'nba-justin-edwards', 'Justin Edwards', 'PHI', 229),
  ('6e846446-7bac-53f7-93ce-a68f50ac3f8d', '11111111-1111-4111-8111-111111111111', 'nba-devin-booker', 'Devin Booker', 'PHX', 230),
  ('b02c870f-0c72-5ec8-9374-9afecd9743b2', '11111111-1111-4111-8111-111111111111', 'nba-jalen-green', 'Jalen Green', 'PHX', 231),
  ('3284994c-24a6-5625-8d11-775654e44dcd', '11111111-1111-4111-8111-111111111111', 'nba-miles-bridges', 'Miles Bridges', 'PHX', 232),
  ('d38ca593-05c8-5c6c-bf10-2e0f05f42e48', '11111111-1111-4111-8111-111111111111', 'nba-dillon-brooks', 'Dillon Brooks', 'PHX', 233),
  ('e1796c1d-0e70-5da4-aedf-20ab29a56eb6', '11111111-1111-4111-8111-111111111111', 'nba-luke-kennard', 'Luke Kennard', 'PHX', 234),
  ('5116d09a-720f-584e-8f8c-cfd400dcc1ab', '11111111-1111-4111-8111-111111111111', 'nba-khaman-maluach', 'Khaman Maluach', 'PHX', 235),
  ('53820af2-e3ba-5e6a-8cba-6a36d8c3e93c', '11111111-1111-4111-8111-111111111111', 'nba-mark-williams', 'Mark Williams', 'PHX', 236),
  ('5da63169-b70d-5aea-a443-067ce03d3508', '11111111-1111-4111-8111-111111111111', 'nba-haywood-highsmith', 'Haywood Highsmith', 'PHX', 237),
  ('5a3618e5-1dd0-5fe4-ba32-50b2bd00389c', '11111111-1111-4111-8111-111111111111', 'nba-ryan-dunn', 'Ryan Dunn', 'PHX', 238),
  ('7abc4497-3205-548a-9145-7db05b6ef0dd', '11111111-1111-4111-8111-111111111111', 'nba-jamaree-bouyea', 'Jamaree Bouyea', 'PHX', 239),
  ('80885d00-5263-5ef1-bcd4-d8cf76c8ab59', '11111111-1111-4111-8111-111111111111', 'nba-ja-morant', 'Ja Morant', 'POR', 240),
  ('514deb19-47e7-5f23-b224-e865d17f67a1', '11111111-1111-4111-8111-111111111111', 'nba-jrue-holiday', 'Jrue Holiday', 'POR', 241),
  ('fa8117cb-69cc-5074-88d9-d6c0702aadd6', '11111111-1111-4111-8111-111111111111', 'nba-shaedon-sharpe', 'Shaedon Sharpe', 'POR', 242),
  ('61509eeb-9ca8-5c8b-a647-789e44d51590', '11111111-1111-4111-8111-111111111111', 'nba-toumani-camara', 'Toumani Camara', 'POR', 243),
  ('a4b466f6-52a9-5f4c-8293-8da9d2e24994', '11111111-1111-4111-8111-111111111111', 'nba-scoot-henderson', 'Scoot Henderson', 'POR', 244),
  ('c7107fa5-2cca-5f17-a47b-ec88a9883c05', '11111111-1111-4111-8111-111111111111', 'nba-damian-lillard', 'Damian Lillard', 'POR', 245),
  ('2c49f36d-f3f1-5ae7-ae74-86e6768bacb1', '11111111-1111-4111-8111-111111111111', 'nba-robert-williams-iii', 'Robert Williams III', 'POR', 246),
  ('fa0e9dfc-937e-575c-b53b-b770989a3b24', '11111111-1111-4111-8111-111111111111', 'nba-deni-avdija', 'Deni Avdija', 'POR', 247),
  ('a934757e-f3c3-5a02-ac8e-8e910050845d', '11111111-1111-4111-8111-111111111111', 'nba-donovan-clingan', 'Donovan Clingan', 'POR', 248),
  ('c521de08-34e1-5cda-a42c-3cb8d2da9852', '11111111-1111-4111-8111-111111111111', 'nba-yang-hansen', 'Yang Hansen', 'POR', 249),
  ('d1b70f9e-57f9-5906-a4bf-79b59c004dd2', '11111111-1111-4111-8111-111111111111', 'nba-zach-lavine', 'Zach LaVine', 'SAC', 250),
  ('603ca035-8a6d-5cdd-91de-5a18bfbdb4d1', '11111111-1111-4111-8111-111111111111', 'nba-domantas-sabonis', 'Domantas Sabonis', 'SAC', 251),
  ('ada01b98-48de-5980-a28e-a769d6d000eb', '11111111-1111-4111-8111-111111111111', 'nba-de-andre-hunter', 'De''Andre Hunter', 'SAC', 252),
  ('2360403e-0517-55ca-9b5c-5c9c52050c31', '11111111-1111-4111-8111-111111111111', 'nba-keegan-murray', 'Keegan Murray', 'SAC', 253),
  ('16a5216f-31d4-5aa8-98e3-0a5a5b0e1484', '11111111-1111-4111-8111-111111111111', 'nba-malik-monk', 'Malik Monk', 'SAC', 254),
  ('98453afb-f1ef-5d13-bc43-6ccd8ebd71ab', '11111111-1111-4111-8111-111111111111', 'nba-nique-clifford', 'Nique Clifford', 'SAC', 255),
  ('69624737-72f3-5b56-a4c8-1b2eb00f5e0d', '11111111-1111-4111-8111-111111111111', 'nba-jonathan-mogbo', 'Jonathan Mogbo', 'SAC', 256),
  ('e7a09a7d-0a9b-5ac0-bc8f-6a6ac6197339', '11111111-1111-4111-8111-111111111111', 'nba-dylan-cardwell', 'Dylan Cardwell', 'SAC', 257),
  ('9dcf6dd8-8f51-5950-aab0-8afb21e6f404', '11111111-1111-4111-8111-111111111111', 'nba-maxime-raynaud', 'Maxime Raynaud', 'SAC', 258),
  ('61cafa45-05a1-55b7-abbc-68f757bae14d', '11111111-1111-4111-8111-111111111111', 'nba-precious-achiuwa', 'Precious Achiuwa', 'SAC', 259),
  ('e7ce22d5-3e34-5ac0-833a-5c1898414074', '11111111-1111-4111-8111-111111111111', 'nba-de-aaron-fox', 'De''Aaron Fox', 'SAS', 260),
  ('c1565d0a-8276-500f-9efb-117e04ac7920', '11111111-1111-4111-8111-111111111111', 'nba-devin-vassell', 'Devin Vassell', 'SAS', 261),
  ('8a24582b-4340-5eb5-8c22-2db51fe5ad9e', '11111111-1111-4111-8111-111111111111', 'nba-tobias-harris', 'Tobias Harris', 'SAS', 262),
  ('c429e7cd-9761-523d-aae3-39084d6881df', '11111111-1111-4111-8111-111111111111', 'nba-harrison-barnes', 'Harrison Barnes', 'SAS', 263),
  ('2d1a076e-6594-50a0-b54b-7410f2ce9060', '11111111-1111-4111-8111-111111111111', 'nba-keldon-johnson', 'Keldon Johnson', 'SAS', 264),
  ('33095356-b2c3-5050-ab17-3410ccca9a97', '11111111-1111-4111-8111-111111111111', 'nba-victor-wembanyama', 'Victor Wembanyama', 'SAS', 265),
  ('776eba14-dad1-515b-af3a-7f516e96600d', '11111111-1111-4111-8111-111111111111', 'nba-dylan-harper', 'Dylan Harper', 'SAS', 266),
  ('63f02dd1-8d88-5e05-ad6d-e25036acaa68', '11111111-1111-4111-8111-111111111111', 'nba-luke-kornet', 'Luke Kornet', 'SAS', 267),
  ('b9ce6259-a96c-5aea-b4cf-c5285f698cf0', '11111111-1111-4111-8111-111111111111', 'nba-stephon-castle', 'Stephon Castle', 'SAS', 268),
  ('7e793e39-95de-5ff5-bdda-e287c58d1bd8', '11111111-1111-4111-8111-111111111111', 'nba-carter-bryant', 'Carter Bryant', 'SAS', 269),
  ('ecfd3d09-2b9a-5bcb-aa8d-a9357685f279', '11111111-1111-4111-8111-111111111111', 'nba-scottie-barnes', 'Scottie Barnes', 'TOR', 270),
  ('fc39dd6c-ae65-57f8-b065-4ef193e7dd1c', '11111111-1111-4111-8111-111111111111', 'nba-brandon-ingram', 'Brandon Ingram', 'TOR', 271),
  ('3d59c499-e973-53bf-beaf-b2a15b88e3e8', '11111111-1111-4111-8111-111111111111', 'nba-immanuel-quickley', 'Immanuel Quickley', 'TOR', 272),
  ('fd983ec3-55a1-577a-bab1-4984d9320b3a', '11111111-1111-4111-8111-111111111111', 'nba-rj-barrett', 'RJ Barrett', 'TOR', 273),
  ('a9b1c75a-13be-57b4-a47f-4573ceb73b3d', '11111111-1111-4111-8111-111111111111', 'nba-jakob-poeltl', 'Jakob Poeltl', 'TOR', 274),
  ('43930d19-7df3-510e-83d0-05b181f92e86', '11111111-1111-4111-8111-111111111111', 'nba-gradey-dick', 'Gradey Dick', 'TOR', 275),
  ('d4a34f3d-a331-5425-a5a1-9f9dc287060c', '11111111-1111-4111-8111-111111111111', 'nba-collin-murray-boyles', 'Collin Murray-Boyles', 'TOR', 276),
  ('35044446-d6ca-5305-95cc-12546afcb96e', '11111111-1111-4111-8111-111111111111', 'nba-ja-kobe-walter', 'Ja''Kobe Walter', 'TOR', 277),
  ('9c682405-9c51-5931-abd8-44b8ab18fb8d', '11111111-1111-4111-8111-111111111111', 'nba-trayce-jackson-davis', 'Trayce Jackson-Davis', 'TOR', 278),
  ('48f12232-8c2b-52df-bfe3-a8991b2a050e', '11111111-1111-4111-8111-111111111111', 'nba-jamal-shead', 'Jamal Shead', 'TOR', 279),
  ('ff5688b0-86d6-596e-b69d-d5c2f8beb7af', '11111111-1111-4111-8111-111111111111', 'nba-jaren-jackson-jr', 'Jaren Jackson Jr.', 'UTA', 280),
  ('5a22d921-b530-595b-bd68-163ff2023609', '11111111-1111-4111-8111-111111111111', 'nba-lauri-markkanen', 'Lauri Markkanen', 'UTA', 281),
  ('64bd2a34-4a50-57f5-bc8f-9bf5f34718f7', '11111111-1111-4111-8111-111111111111', 'nba-jusuf-nurkic', 'Jusuf Nurkić', 'UTA', 282),
  ('c0df8550-8b77-5585-a5af-7cc6d85f087a', '11111111-1111-4111-8111-111111111111', 'nba-ace-bailey', 'Ace Bailey', 'UTA', 283),
  ('8858665f-c7ac-5bcb-abe9-ce36c2534f28', '11111111-1111-4111-8111-111111111111', 'nba-josh-okogie', 'Josh Okogie', 'UTA', 284),
  ('5c9a4bce-43c0-58ee-b47b-b3dbfdeca358', '11111111-1111-4111-8111-111111111111', 'nba-keyonte-george', 'Keyonte George', 'UTA', 285),
  ('46377008-2406-5517-aaeb-6139fc3ef047', '11111111-1111-4111-8111-111111111111', 'nba-john-konchar', 'John Konchar', 'UTA', 286),
  ('77c2d13f-a465-5ea6-87ab-be1669ce016b', '11111111-1111-4111-8111-111111111111', 'nba-cody-williams', 'Cody Williams', 'UTA', 287),
  ('1164eebb-2ce9-5dd6-b68e-454aaf3d13fb', '11111111-1111-4111-8111-111111111111', 'nba-brice-sensabaugh', 'Brice Sensabaugh', 'UTA', 288),
  ('bd9650ef-e9b1-5f65-a10a-918c23a0bc7e', '11111111-1111-4111-8111-111111111111', 'nba-svi-mykhailiuk', 'Svi Mykhailiuk', 'UTA', 289),
  ('06c66bf5-18ec-5c57-8e79-3a632c17fad6', '11111111-1111-4111-8111-111111111111', 'nba-anthony-davis', 'Anthony Davis', 'WAS', 290),
  ('bc8b2a68-e23f-569f-81c3-72e0fa4daedd', '11111111-1111-4111-8111-111111111111', 'nba-trae-young', 'Trae Young', 'WAS', 291),
  ('4de7acb2-0ac6-502d-9951-85a0e89f652c', '11111111-1111-4111-8111-111111111111', 'nba-khris-middleton', 'Khris Middleton', 'WAS', 292),
  ('8e808dc4-b6cf-57b0-918c-8b0bcb46b893', '11111111-1111-4111-8111-111111111111', 'nba-alex-sarr', 'Alex Sarr', 'WAS', 293),
  ('10fd7b7b-3767-53d4-89d4-549604a563b1', '11111111-1111-4111-8111-111111111111', 'nba-bilal-coulibaly', 'Bilal Coulibaly', 'WAS', 294),
  ('0106f743-6466-5ed2-aaa8-44a084b39d65', '11111111-1111-4111-8111-111111111111', 'nba-tre-johnson', 'Tre Johnson', 'WAS', 295),
  ('8a417e7a-d001-507d-8b89-a79d4fa51093', '11111111-1111-4111-8111-111111111111', 'nba-deandre-ayton', 'Deandre Ayton', 'WAS', 296),
  ('89bd81c9-a0e2-5d01-a6b7-a6cfd9aedc58', '11111111-1111-4111-8111-111111111111', 'nba-cam-whitmore', 'Cam Whitmore', 'WAS', 297),
  ('66746971-4e63-5cd8-ae65-8dd6a32a2254', '11111111-1111-4111-8111-111111111111', 'nba-bub-carrington', 'Bub Carrington', 'WAS', 298),
  ('7e26312a-a39c-5a3f-9fe7-fbf77377c797', '11111111-1111-4111-8111-111111111111', 'nba-will-riley', 'Will Riley', 'WAS', 299);

insert into private.category_answer_aliases (category_version_id, normalized_alias, answer_id)
values
  ('11111111-1111-4111-8111-111111111111', 'aaron gordon', 'e04e60c7-bf03-5afc-a928-0f0d1f376cad'),
  ('11111111-1111-4111-8111-111111111111', 'aaron nesmith', '76a9ef17-ee46-586d-82e4-5f4ec56d312d'),
  ('11111111-1111-4111-8111-111111111111', 'aaron wiggins', 'b1605b92-44ba-5a04-805f-5d4101fa618e'),
  ('11111111-1111-4111-8111-111111111111', 'ace bailey', 'c0df8550-8b77-5585-a5af-7cc6d85f087a'),
  ('11111111-1111-4111-8111-111111111111', 'achiuwa', '61cafa45-05a1-55b7-abbc-68f757bae14d'),
  ('11111111-1111-4111-8111-111111111111', 'ad', '06c66bf5-18ec-5c57-8e79-3a632c17fad6'),
  ('11111111-1111-4111-8111-111111111111', 'adams', 'c176fe28-5127-5ea3-a3f0-3ae4b1ebb7d9'),
  ('11111111-1111-4111-8111-111111111111', 'adebayo', '532119a6-e565-58a0-8ed4-f8842aadb8c1'),
  ('11111111-1111-4111-8111-111111111111', 'aj green', 'db018d85-bf34-5e27-92b0-538712eec8ea'),
  ('11111111-1111-4111-8111-111111111111', 'al horford', '46b593ab-6bbb-5808-9dfb-2b9102eadac9'),
  ('11111111-1111-4111-8111-111111111111', 'aldama', '757dbf65-4b87-5614-9b45-b4e5db8e1caf'),
  ('11111111-1111-4111-8111-111111111111', 'alex caruso', 'decfeee4-4e9c-5244-8a7f-aae01fb1c845'),
  ('11111111-1111-4111-8111-111111111111', 'alex sarr', '8e808dc4-b6cf-57b0-918c-8b0bcb46b893'),
  ('11111111-1111-4111-8111-111111111111', 'alexander', '8d57a7a4-082c-50c8-ba77-44c06af486ce'),
  ('11111111-1111-4111-8111-111111111111', 'alperen sengun', '180327f4-70f7-5ce4-848a-265319749781'),
  ('11111111-1111-4111-8111-111111111111', 'alvarado', '874794d6-b9c1-5911-a718-615e16482920'),
  ('11111111-1111-4111-8111-111111111111', 'amen thompson', 'be7c8ce7-fd27-5f50-91b4-e9ef14609c31'),
  ('11111111-1111-4111-8111-111111111111', 'andre drummond', '4583cb67-12ec-5b2b-9674-3c1cd3b89156'),
  ('11111111-1111-4111-8111-111111111111', 'andrew nembhard', '8daf632e-aee1-5271-9590-5e1db5c55375'),
  ('11111111-1111-4111-8111-111111111111', 'andrew wiggins', '756222ff-52d4-58a3-bcfd-6c0bc08c3f4b'),
  ('11111111-1111-4111-8111-111111111111', 'anfernee simons', 'dc093170-f828-58f9-8826-7d010b05b6f9'),
  ('11111111-1111-4111-8111-111111111111', 'ant', 'c2b81f21-46a8-5b13-99a2-db197292bf38'),
  ('11111111-1111-4111-8111-111111111111', 'antetokounmpo', '47844cee-92cd-5d9c-b69f-593dbd46f4c6'),
  ('11111111-1111-4111-8111-111111111111', 'anthony black', 'b376ef47-5da6-5b80-9f72-f3f6c2ff994a'),
  ('11111111-1111-4111-8111-111111111111', 'anthony davis', '06c66bf5-18ec-5c57-8e79-3a632c17fad6'),
  ('11111111-1111-4111-8111-111111111111', 'anthony edwards', 'c2b81f21-46a8-5b13-99a2-db197292bf38'),
  ('11111111-1111-4111-8111-111111111111', 'anunoby', '408d42de-a85f-58b1-ac25-dae42029dde2'),
  ('11111111-1111-4111-8111-111111111111', 'ausar thompson', '90d8c73a-a53f-50cd-93e3-ba4e6ba2c0da'),
  ('11111111-1111-4111-8111-111111111111', 'austin reaves', 'dff96553-9113-5967-a004-22136e92da6c'),
  ('11111111-1111-4111-8111-111111111111', 'avdija', 'fa0e9dfc-937e-575c-b53b-b770989a3b24'),
  ('11111111-1111-4111-8111-111111111111', 'ayo dosunmu', '15957e64-ac53-5363-aa00-4dd6462fc7f8'),
  ('11111111-1111-4111-8111-111111111111', 'ayton', '8a417e7a-d001-507d-8b89-a79d4fa51093'),
  ('11111111-1111-4111-8111-111111111111', 'bailey', 'c0df8550-8b77-5585-a5af-7cc6d85f087a'),
  ('11111111-1111-4111-8111-111111111111', 'ball', 'f3663088-c877-5038-b3a0-e704a54c4c36'),
  ('11111111-1111-4111-8111-111111111111', 'bam', '532119a6-e565-58a0-8ed4-f8842aadb8c1'),
  ('11111111-1111-4111-8111-111111111111', 'bam adebayo', '532119a6-e565-58a0-8ed4-f8842aadb8c1'),
  ('11111111-1111-4111-8111-111111111111', 'banchero', '2c7ef32a-9a1c-52bd-9f94-daf54fce10e6'),
  ('11111111-1111-4111-8111-111111111111', 'bane', 'd6299e5f-2145-5338-b76d-a49eedac8dcc'),
  ('11111111-1111-4111-8111-111111111111', 'barlow', '0582184b-d5cb-513a-a6ca-7432db9ac716'),
  ('11111111-1111-4111-8111-111111111111', 'barrett', 'fd983ec3-55a1-577a-bab1-4984d9320b3a'),
  ('11111111-1111-4111-8111-111111111111', 'bassey', 'c0f53b94-3956-5755-8996-037fb0cd30c0'),
  ('11111111-1111-4111-8111-111111111111', 'baylor scheierman', '8b3cdcc2-efd8-5a08-96e2-9e2d79695b1b'),
  ('11111111-1111-4111-8111-111111111111', 'ben saraf', 'd92bd6e5-b687-55fa-97c6-d7090e491b3b'),
  ('11111111-1111-4111-8111-111111111111', 'ben sheppard', '6d87658b-3a52-587b-830e-5af6b8cfce8c'),
  ('11111111-1111-4111-8111-111111111111', 'bennedict mathurin', 'eec5ed64-5fb2-555b-aea1-d4d65b4113fe'),
  ('11111111-1111-4111-8111-111111111111', 'beringer', 'b22660dc-0186-5ad0-9a69-ea0a8b8b58e6'),
  ('11111111-1111-4111-8111-111111111111', 'bey', 'd2197b51-67c2-5495-a382-bf594bb9ff2e'),
  ('11111111-1111-4111-8111-111111111111', 'bilal coulibaly', '10fd7b7b-3767-53d4-89d4-549604a563b1'),
  ('11111111-1111-4111-8111-111111111111', 'bitadze', '4089d48e-fcc0-562f-ba08-c064bb8f28d9'),
  ('11111111-1111-4111-8111-111111111111', 'black', 'b376ef47-5da6-5b80-9f72-f3f6c2ff994a'),
  ('11111111-1111-4111-8111-111111111111', 'bobby portis', 'd92fd1bc-f428-52bf-8f0f-36311ea00ae5'),
  ('11111111-1111-4111-8111-111111111111', 'bogdan bogdanovic', '7d078a05-e9c6-5aa8-9def-7dbd10181084'),
  ('11111111-1111-4111-8111-111111111111', 'bogdanovic', '7d078a05-e9c6-5aa8-9def-7dbd10181084'),
  ('11111111-1111-4111-8111-111111111111', 'booker', '6e846446-7bac-53f7-93ce-a68f50ac3f8d'),
  ('11111111-1111-4111-8111-111111111111', 'bouyea', '7abc4497-3205-548a-9145-7db05b6ef0dd'),
  ('11111111-1111-4111-8111-111111111111', 'boyles', 'd4a34f3d-a331-5425-a5a1-9f9dc287060c'),
  ('11111111-1111-4111-8111-111111111111', 'brandin podziemski', 'd9b60fd2-599c-587a-9b4c-c0e5942e1fe1'),
  ('11111111-1111-4111-8111-111111111111', 'brandon ingram', 'fc39dd6c-ae65-57f8-b065-4ef193e7dd1c'),
  ('11111111-1111-4111-8111-111111111111', 'brandon miller', '22007959-fbed-59ec-a385-e0cb269fa660'),
  ('11111111-1111-4111-8111-111111111111', 'braun', 'e2e29ccd-c541-5597-b149-8a53eb798cc4'),
  ('11111111-1111-4111-8111-111111111111', 'brice sensabaugh', '1164eebb-2ce9-5dd6-b68e-454aaf3d13fb'),
  ('11111111-1111-4111-8111-111111111111', 'brook lopez', '1f94d999-b114-587d-9ecf-5f3b741c53a9'),
  ('11111111-1111-4111-8111-111111111111', 'brooks', 'd38ca593-05c8-5c6c-bf10-2e0f05f42e48'),
  ('11111111-1111-4111-8111-111111111111', 'brown', 'c27c2eaf-79b5-54e8-89d6-c10dbaa67ad2'),
  ('11111111-1111-4111-8111-111111111111', 'brunson', '99dfd60c-c6d6-5a96-8e0c-4766ca918088'),
  ('11111111-1111-4111-8111-111111111111', 'bryant', '7e793e39-95de-5ff5-bdda-e287c58d1bd8'),
  ('11111111-1111-4111-8111-111111111111', 'bub carrington', '66746971-4e63-5cd8-ae65-8dd6a32a2254'),
  ('11111111-1111-4111-8111-111111111111', 'buddy hield', 'f4fa9e08-1752-5689-946b-6344f5a03190'),
  ('11111111-1111-4111-8111-111111111111', 'butler', 'ceb8295e-3137-50c8-b6c5-41731dc448eb'),
  ('11111111-1111-4111-8111-111111111111', 'buzelis', '0b6da973-3637-542a-b739-cb49033d0dea'),
  ('11111111-1111-4111-8111-111111111111', 'cade cunningham', 'd5e7eef5-29a1-59c5-936c-768d57d87cce'),
  ('11111111-1111-4111-8111-111111111111', 'caleb martin', '65d68852-45ae-5a29-b4dc-ebdc3b15f3e8'),
  ('11111111-1111-4111-8111-111111111111', 'cam whitmore', '89bd81c9-a0e2-5d01-a6b7-a6cfd9aedc58'),
  ('11111111-1111-4111-8111-111111111111', 'camara', '61509eeb-9ca8-5c8b-a647-789e44d51590'),
  ('11111111-1111-4111-8111-111111111111', 'cameron johnson', '0158b5c5-ae59-5db0-a396-ce8f6e899190'),
  ('11111111-1111-4111-8111-111111111111', 'capela', '16001b4e-1469-5ab2-8843-2f55753b4ace'),
  ('11111111-1111-4111-8111-111111111111', 'cardwell', 'e7a09a7d-0a9b-5ac0-bc8f-6a6ac6197339'),
  ('11111111-1111-4111-8111-111111111111', 'caris levert', '8eb3e988-e167-55a0-a87d-e6981fe5dba6'),
  ('11111111-1111-4111-8111-111111111111', 'carrington', '66746971-4e63-5cd8-ae65-8dd6a32a2254'),
  ('11111111-1111-4111-8111-111111111111', 'carter bryant', '7e793e39-95de-5ff5-bdda-e287c58d1bd8'),
  ('11111111-1111-4111-8111-111111111111', 'caruso', 'decfeee4-4e9c-5244-8a7f-aae01fb1c845'),
  ('11111111-1111-4111-8111-111111111111', 'cason wallace', 'dd5976fe-1fa3-5fd5-a6bb-22236aa11d5e'),
  ('11111111-1111-4111-8111-111111111111', 'castle', 'b9ce6259-a96c-5aea-b4cf-c5285f698cf0'),
  ('11111111-1111-4111-8111-111111111111', 'cedric coward', '90410c57-7d67-56cb-89ef-e369f45dc704'),
  ('11111111-1111-4111-8111-111111111111', 'charles bassey', 'c0f53b94-3956-5755-8996-037fb0cd30c0'),
  ('11111111-1111-4111-8111-111111111111', 'chet holmgren', 'dd836cbd-0739-5cb4-9956-f22465d543e6'),
  ('11111111-1111-4111-8111-111111111111', 'christian braun', 'e2e29ccd-c541-5597-b149-8a53eb798cc4'),
  ('11111111-1111-4111-8111-111111111111', 'christie', '16cdfca1-344e-57a9-ab47-a69ef246a373'),
  ('11111111-1111-4111-8111-111111111111', 'cj', 'aa9d6e71-111f-5702-8fbd-858ae9004ab5'),
  ('11111111-1111-4111-8111-111111111111', 'cj mccollum', 'aa9d6e71-111f-5702-8fbd-858ae9004ab5'),
  ('11111111-1111-4111-8111-111111111111', 'clarkson', '11b504b1-6db9-54fb-bb1d-5a45c64f2246'),
  ('11111111-1111-4111-8111-111111111111', 'claxton', '0e63f09b-0d32-5e76-891b-35f2ab1ddf04'),
  ('11111111-1111-4111-8111-111111111111', 'clayton', 'c691dc77-d9c2-572a-9400-5d1e3ac86b55'),
  ('11111111-1111-4111-8111-111111111111', 'clifford', '98453afb-f1ef-5d13-bc43-6ccd8ebd71ab'),
  ('11111111-1111-4111-8111-111111111111', 'clingan', 'a934757e-f3c3-5a02-ac8e-8e910050845d'),
  ('11111111-1111-4111-8111-111111111111', 'clint capela', '16001b4e-1469-5ab2-8843-2f55753b4ace'),
  ('11111111-1111-4111-8111-111111111111', 'clowney', '80f1a319-b1f1-50f2-9fb3-31e353d75e56'),
  ('11111111-1111-4111-8111-111111111111', 'coby white', 'a996d29d-f3c1-5ce2-b391-ed1f193d3209'),
  ('11111111-1111-4111-8111-111111111111', 'cody williams', '77c2d13f-a465-5ea6-87ab-be1669ce016b'),
  ('11111111-1111-4111-8111-111111111111', 'collin murray boyles', 'd4a34f3d-a331-5425-a5a1-9f9dc287060c'),
  ('11111111-1111-4111-8111-111111111111', 'collin sexton', 'ee9c2600-494d-5759-ad27-5f60b93f5dcc'),
  ('11111111-1111-4111-8111-111111111111', 'cooper flagg', 'd39e4040-7ec8-5f81-aba8-03f58716b5fe'),
  ('11111111-1111-4111-8111-111111111111', 'corey kispert', '134f65f8-ae80-5e80-a9ec-b705547c171c'),
  ('11111111-1111-4111-8111-111111111111', 'coulibaly', '10fd7b7b-3767-53d4-89d4-549604a563b1'),
  ('11111111-1111-4111-8111-111111111111', 'coward', '90410c57-7d67-56cb-89ef-e369f45dc704'),
  ('11111111-1111-4111-8111-111111111111', 'craig porter', '94867cc7-6ad5-5878-a4dd-6c04784353a4'),
  ('11111111-1111-4111-8111-111111111111', 'craig porter jr', '94867cc7-6ad5-5878-a4dd-6c04784353a4'),
  ('11111111-1111-4111-8111-111111111111', 'cunningham', 'd5e7eef5-29a1-59c5-936c-768d57d87cce'),
  ('11111111-1111-4111-8111-111111111111', 'curry', '017e2b74-9722-5ff5-9273-4b183f8e4d83'),
  ('11111111-1111-4111-8111-111111111111', 'd angelo russell', '10fbff1b-0089-5d64-b267-2ad6516ac3a1'),
  ('11111111-1111-4111-8111-111111111111', 'd lo', '10fbff1b-0089-5d64-b267-2ad6516ac3a1'),
  ('11111111-1111-4111-8111-111111111111', 'dadiet', '07a9a727-71bd-55b5-a81d-17aca4ff88f3'),
  ('11111111-1111-4111-8111-111111111111', 'damian lillard', 'c7107fa5-2cca-5f17-a47b-ec88a9883c05'),
  ('11111111-1111-4111-8111-111111111111', 'daniel gafford', '97cb70d9-fc4d-5ac6-a739-7f6716e56c9e'),
  ('11111111-1111-4111-8111-111111111111', 'daniels', 'f9b30df5-c146-5411-b660-34de3299a224'),
  ('11111111-1111-4111-8111-111111111111', 'daniss jenkins', 'a07034e7-3522-5c2f-bf37-03505fb0abfc'),
  ('11111111-1111-4111-8111-111111111111', 'darius garland', '57968b69-cce3-5c42-b4ab-57842732c0cc'),
  ('11111111-1111-4111-8111-111111111111', 'daron holmes', '329b94df-0c19-5489-8a22-510713c04439'),
  ('11111111-1111-4111-8111-111111111111', 'daron holmes ii', '329b94df-0c19-5489-8a22-510713c04439'),
  ('11111111-1111-4111-8111-111111111111', 'davion mitchell', 'ea8688d2-a5d1-563a-b0fb-b46db006e873'),
  ('11111111-1111-4111-8111-111111111111', 'day ron sharpe', 'b7c40b68-5988-57c2-8a42-8b55eb00e9f6'),
  ('11111111-1111-4111-8111-111111111111', 'de aaron fox', 'e7ce22d5-3e34-5ac0-833a-5c1898414074'),
  ('11111111-1111-4111-8111-111111111111', 'de andre hunter', 'ada01b98-48de-5980-a28e-a769d6d000eb'),
  ('11111111-1111-4111-8111-111111111111', 'de anthony melton', '9436a5ac-69e8-5fcf-a2b7-b669da840aaa'),
  ('11111111-1111-4111-8111-111111111111', 'dean wade', 'f2ba6923-b485-5da7-8107-53976f63d516'),
  ('11111111-1111-4111-8111-111111111111', 'deandre ayton', '8a417e7a-d001-507d-8b89-a79d4fa51093'),
  ('11111111-1111-4111-8111-111111111111', 'dejounte murray', 'da7e1c38-2b9e-57f9-acb2-d099f15b4883'),
  ('11111111-1111-4111-8111-111111111111', 'demin', 'dec65b0b-c9bb-5845-88a5-10417cb6c5b2'),
  ('11111111-1111-4111-8111-111111111111', 'deni avdija', 'fa0e9dfc-937e-575c-b53b-b770989a3b24'),
  ('11111111-1111-4111-8111-111111111111', 'dennis schroder', '1a14b60c-8a93-5c8f-b251-9fa90870cd97'),
  ('11111111-1111-4111-8111-111111111111', 'dereck lively', '8134e5b8-caca-5078-99ec-c5e40ebd3476'),
  ('11111111-1111-4111-8111-111111111111', 'dereck lively ii', '8134e5b8-caca-5078-99ec-c5e40ebd3476'),
  ('11111111-1111-4111-8111-111111111111', 'derik queen', 'e9f6a6ff-20c4-59d1-8ec7-7ba286559e87'),
  ('11111111-1111-4111-8111-111111111111', 'derrick jones', 'f5587e83-beeb-5382-ad89-892b891e0495'),
  ('11111111-1111-4111-8111-111111111111', 'derrick jones jr', 'f5587e83-beeb-5382-ad89-892b891e0495'),
  ('11111111-1111-4111-8111-111111111111', 'derrick white', '7271416a-db22-5cf0-8d84-f462df57064b'),
  ('11111111-1111-4111-8111-111111111111', 'desmond bane', 'd6299e5f-2145-5338-b76d-a49eedac8dcc'),
  ('11111111-1111-4111-8111-111111111111', 'devin booker', '6e846446-7bac-53f7-93ce-a68f50ac3f8d'),
  ('11111111-1111-4111-8111-111111111111', 'devin carter', '6a78c79b-1d6b-545e-92c3-632f36e76713'),
  ('11111111-1111-4111-8111-111111111111', 'devin vassell', 'c1565d0a-8276-500f-9efb-117e04ac7920'),
  ('11111111-1111-4111-8111-111111111111', 'dick', '43930d19-7df3-510e-83d0-05b181f92e86'),
  ('11111111-1111-4111-8111-111111111111', 'dieng', '552db30e-38de-5a6a-83bc-f774d287dba2'),
  ('11111111-1111-4111-8111-111111111111', 'dillingham', '64cd3fcf-900d-589d-9b1b-d894d6a0a332'),
  ('11111111-1111-4111-8111-111111111111', 'dillon brooks', 'd38ca593-05c8-5c6c-bf10-2e0f05f42e48'),
  ('11111111-1111-4111-8111-111111111111', 'divincenzo', 'c0dfb2ab-afbe-5256-984c-47f10151bc04'),
  ('11111111-1111-4111-8111-111111111111', 'dlo', '10fbff1b-0089-5d64-b267-2ad6516ac3a1'),
  ('11111111-1111-4111-8111-111111111111', 'domantas sabonis', '603ca035-8a6d-5cdd-91de-5a18bfbdb4d1'),
  ('11111111-1111-4111-8111-111111111111', 'dominick barlow', '0582184b-d5cb-513a-a6ca-7432db9ac716'),
  ('11111111-1111-4111-8111-111111111111', 'doncic', 'b8934fdb-2951-5b51-9688-b7e73d652c67'),
  ('11111111-1111-4111-8111-111111111111', 'donovan clingan', 'a934757e-f3c3-5a02-ac8e-8e910050845d'),
  ('11111111-1111-4111-8111-111111111111', 'donovan mitchell', '634dca13-2944-5c6d-b6a4-b4999614970c'),
  ('11111111-1111-4111-8111-111111111111', 'donte divincenzo', 'c0dfb2ab-afbe-5256-984c-47f10151bc04'),
  ('11111111-1111-4111-8111-111111111111', 'dorian finney smith', '56d73a2c-a081-5cd8-8f62-957101dccc8b'),
  ('11111111-1111-4111-8111-111111111111', 'dort', '57e7fa44-9517-55e1-ab1e-15704e986bd5'),
  ('11111111-1111-4111-8111-111111111111', 'dosunmu', '15957e64-ac53-5363-aa00-4dd6462fc7f8'),
  ('11111111-1111-4111-8111-111111111111', 'drake powell', '09da131c-6bae-5d71-802e-75cbf17b664a'),
  ('11111111-1111-4111-8111-111111111111', 'draymond green', '41bdb75d-d74e-5f88-aff9-812b512d8983'),
  ('11111111-1111-4111-8111-111111111111', 'dru smith', '7ea4cc3a-f7aa-5125-9ab8-5365f1a784dd'),
  ('11111111-1111-4111-8111-111111111111', 'drummond', '4583cb67-12ec-5b2b-9674-3c1cd3b89156'),
  ('11111111-1111-4111-8111-111111111111', 'duncan robinson', '1fd606d4-e02c-5238-b317-4480e5570159'),
  ('11111111-1111-4111-8111-111111111111', 'durant', '7cb51125-f64a-5f25-bc28-3a1a2436cc73'),
  ('11111111-1111-4111-8111-111111111111', 'duren', '23c3b4d0-10f3-5b8d-b187-823ee903384b'),
  ('11111111-1111-4111-8111-111111111111', 'dylan cardwell', 'e7a09a7d-0a9b-5ac0-bc8f-6a6ac6197339'),
  ('11111111-1111-4111-8111-111111111111', 'dylan harper', '776eba14-dad1-515b-af3a-7f516e96600d'),
  ('11111111-1111-4111-8111-111111111111', 'dyson daniels', 'f9b30df5-c146-5411-b660-34de3299a224'),
  ('11111111-1111-4111-8111-111111111111', 'eason', 'c9da9edc-1c31-5b4d-898d-70c4a6e61403'),
  ('11111111-1111-4111-8111-111111111111', 'edey', '12e681de-cc8f-57d8-b72e-2138d2a8d4b6'),
  ('11111111-1111-4111-8111-111111111111', 'edgecombe', '97eb52f1-9db9-5fba-86ff-77b084b33be2'),
  ('11111111-1111-4111-8111-111111111111', 'egor demin', 'dec65b0b-c9bb-5845-88a5-10417cb6c5b2'),
  ('11111111-1111-4111-8111-111111111111', 'embiid', '85ac505d-60bc-5eaa-8387-9d6c704538ca'),
  ('11111111-1111-4111-8111-111111111111', 'evan mobley', '20c07e30-23fd-580f-8b73-e2730f6c99cb'),
  ('11111111-1111-4111-8111-111111111111', 'fears', 'eb27f503-0e5c-5866-a44e-174de9451697'),
  ('11111111-1111-4111-8111-111111111111', 'flagg', 'd39e4040-7ec8-5f81-aba8-03f58716b5fe'),
  ('11111111-1111-4111-8111-111111111111', 'fontecchio', '3dc7d455-7cbf-5160-8e21-502afe55bce0'),
  ('11111111-1111-4111-8111-111111111111', 'fox', 'e7ce22d5-3e34-5ac0-833a-5c1898414074'),
  ('11111111-1111-4111-8111-111111111111', 'franz wagner', 'ce1518d8-d703-5521-9225-741940a9d6b0'),
  ('11111111-1111-4111-8111-111111111111', 'fred vanvleet', 'e16c653e-80ef-54e2-8c36-2ae631561d9c'),
  ('11111111-1111-4111-8111-111111111111', 'gafford', '97cb70d9-fc4d-5ac6-a739-7f6716e56c9e'),
  ('11111111-1111-4111-8111-111111111111', 'garland', '57968b69-cce3-5c42-b4ab-57842732c0cc'),
  ('11111111-1111-4111-8111-111111111111', 'garza', 'bc072cbe-0e17-539b-b555-8847c0b6917f'),
  ('11111111-1111-4111-8111-111111111111', 'giannis', '47844cee-92cd-5d9c-b69f-593dbd46f4c6'),
  ('11111111-1111-4111-8111-111111111111', 'giannis antetokounmpo', '47844cee-92cd-5d9c-b69f-593dbd46f4c6'),
  ('11111111-1111-4111-8111-111111111111', 'giddey', '9f64a701-8882-5b74-889f-b75c18e13219'),
  ('11111111-1111-4111-8111-111111111111', 'gobert', '273bc52f-8c62-54e1-95e4-cf7cac272d72'),
  ('11111111-1111-4111-8111-111111111111', 'goga bitadze', '4089d48e-fcc0-562f-ba08-c064bb8f28d9'),
  ('11111111-1111-4111-8111-111111111111', 'gonzalez', '10d382ae-c89e-513d-aaeb-47db52bee24f'),
  ('11111111-1111-4111-8111-111111111111', 'gordon', 'e04e60c7-bf03-5afc-a928-0f0d1f376cad'),
  ('11111111-1111-4111-8111-111111111111', 'gradey dick', '43930d19-7df3-510e-83d0-05b181f92e86'),
  ('11111111-1111-4111-8111-111111111111', 'grant', '1ae1d4c7-baed-592e-a42b-f9da6c543f0b'),
  ('11111111-1111-4111-8111-111111111111', 'grant williams', '90b4a826-4701-5f10-b16c-bb116ba022f4'),
  ('11111111-1111-4111-8111-111111111111', 'grayson allen', 'f8ffd933-191f-5694-bba3-3b7fa8bfadee'),
  ('11111111-1111-4111-8111-111111111111', 'grimes', 'd20d6f32-b9c1-5185-9e7f-acea7fd24da8'),
  ('11111111-1111-4111-8111-111111111111', 'gui santos', 'b11a3015-c3dc-58c5-9de1-751077ec7616'),
  ('11111111-1111-4111-8111-111111111111', 'hachimura', '0247b6aa-b950-5275-9de8-c472db8ccfc8'),
  ('11111111-1111-4111-8111-111111111111', 'haliburton', '090d80c5-91b7-5557-b720-e0d017b160dc'),
  ('11111111-1111-4111-8111-111111111111', 'hansen', 'c521de08-34e1-5cda-a42c-3cb8d2da9852'),
  ('11111111-1111-4111-8111-111111111111', 'hardaway', '433feaa6-b514-54fa-9907-f228008cd4cf'),
  ('11111111-1111-4111-8111-111111111111', 'harden', 'e2d46caf-3409-577c-ac9f-324d1e254dfa'),
  ('11111111-1111-4111-8111-111111111111', 'harper', '776eba14-dad1-515b-af3a-7f516e96600d'),
  ('11111111-1111-4111-8111-111111111111', 'harris', '8a24582b-4340-5eb5-8c22-2db51fe5ad9e'),
  ('11111111-1111-4111-8111-111111111111', 'harrison barnes', 'c429e7cd-9761-523d-aae3-39084d6881df'),
  ('11111111-1111-4111-8111-111111111111', 'hart', '30167d9a-6cd1-5721-a357-0d85d879f2a3'),
  ('11111111-1111-4111-8111-111111111111', 'hartenstein', 'ca177d6d-9a1b-59ca-96df-2d260a78b715'),
  ('11111111-1111-4111-8111-111111111111', 'hauser', '7cfd8819-9fb0-5f05-b730-ee019e391fd0'),
  ('11111111-1111-4111-8111-111111111111', 'hawkins', 'abfb5901-50bc-5fde-badf-6e7658ef8939'),
  ('11111111-1111-4111-8111-111111111111', 'haywood highsmith', '5da63169-b70d-5aea-a443-067ce03d3508'),
  ('11111111-1111-4111-8111-111111111111', 'henderson', 'a4b466f6-52a9-5f4c-8293-8da9d2e24994'),
  ('11111111-1111-4111-8111-111111111111', 'hendricks', 'bf75e797-6101-5263-8b25-a8a239235bd7'),
  ('11111111-1111-4111-8111-111111111111', 'herbert jones', '0ce69187-f547-5c7f-b3ef-78153756a99f'),
  ('11111111-1111-4111-8111-111111111111', 'herro', '97dc4a23-7ffe-5487-86cb-1b0946fc0eaf'),
  ('11111111-1111-4111-8111-111111111111', 'hield', 'f4fa9e08-1752-5689-946b-6344f5a03190'),
  ('11111111-1111-4111-8111-111111111111', 'highsmith', '5da63169-b70d-5aea-a443-067ce03d3508'),
  ('11111111-1111-4111-8111-111111111111', 'holiday', '514deb19-47e7-5f23-b224-e865d17f67a1'),
  ('11111111-1111-4111-8111-111111111111', 'holland', 'a1116b7e-ec74-5376-915a-4eeb73045914'),
  ('11111111-1111-4111-8111-111111111111', 'holmes', '329b94df-0c19-5489-8a22-510713c04439'),
  ('11111111-1111-4111-8111-111111111111', 'holmgren', 'dd836cbd-0739-5cb4-9956-f22465d543e6'),
  ('11111111-1111-4111-8111-111111111111', 'horford', '46b593ab-6bbb-5808-9dfb-2b9102eadac9'),
  ('11111111-1111-4111-8111-111111111111', 'huerter', 'd5e4eda5-e056-5c6f-b467-05441872c588'),
  ('11111111-1111-4111-8111-111111111111', 'hugo gonzalez', '10d382ae-c89e-513d-aaeb-47db52bee24f'),
  ('11111111-1111-4111-8111-111111111111', 'hunter', 'ada01b98-48de-5980-a28e-a769d6d000eb'),
  ('11111111-1111-4111-8111-111111111111', 'immanuel quickley', '3d59c499-e973-53bf-beaf-b2a15b88e3e8'),
  ('11111111-1111-4111-8111-111111111111', 'ingram', 'fc39dd6c-ae65-57f8-b065-4ef193e7dd1c'),
  ('11111111-1111-4111-8111-111111111111', 'irving', '28d9cd4a-dd1b-5ed4-a417-ba07c4f0ac5e'),
  ('11111111-1111-4111-8111-111111111111', 'isaac', 'fa44d3ac-09ac-51e7-b3ec-67fef1abbae6'),
  ('11111111-1111-4111-8111-111111111111', 'isaac okoro', '8068bac5-c6c8-5b91-ab3b-03efbda3048c'),
  ('11111111-1111-4111-8111-111111111111', 'isaiah hartenstein', 'ca177d6d-9a1b-59ca-96df-2d260a78b715'),
  ('11111111-1111-4111-8111-111111111111', 'isaiah jackson', 'bff4f701-bd93-57b1-8315-8c99ddcc6a98'),
  ('11111111-1111-4111-8111-111111111111', 'isaiah joe', '98bb893b-59c3-57a4-bad0-63f6f92f6abf'),
  ('11111111-1111-4111-8111-111111111111', 'isaiah stewart', 'fa65d721-2dae-59ed-88c9-84f6a19a95ba'),
  ('11111111-1111-4111-8111-111111111111', 'ivica zubac', '26591069-ddf4-54be-9bce-ef51ff6141a7'),
  ('11111111-1111-4111-8111-111111111111', 'ja', '80885d00-5263-5ef1-bcd4-d8cf76c8ab59'),
  ('11111111-1111-4111-8111-111111111111', 'ja kobe walter', '35044446-d6ca-5305-95cc-12546afcb96e'),
  ('11111111-1111-4111-8111-111111111111', 'ja morant', '80885d00-5263-5ef1-bcd4-d8cf76c8ab59'),
  ('11111111-1111-4111-8111-111111111111', 'jabari smith', '73fa6bfc-df11-5cbe-b46b-fd55033ffeb9'),
  ('11111111-1111-4111-8111-111111111111', 'jabari smith jr', '73fa6bfc-df11-5cbe-b46b-fd55033ffeb9'),
  ('11111111-1111-4111-8111-111111111111', 'jabari walker', '099068c0-e05a-56f7-9603-6ad0759b1675'),
  ('11111111-1111-4111-8111-111111111111', 'jaden mcdaniels', 'c334b171-623e-57f1-8c40-622af07854db'),
  ('11111111-1111-4111-8111-111111111111', 'jaime jaquez', '92d976c1-d8cf-538a-88f5-63319e8346af'),
  ('11111111-1111-4111-8111-111111111111', 'jaime jaquez jr', '92d976c1-d8cf-538a-88f5-63319e8346af'),
  ('11111111-1111-4111-8111-111111111111', 'jake laravia', '14f84547-a14a-5e42-acba-1dc8ae82bbba'),
  ('11111111-1111-4111-8111-111111111111', 'jakob poeltl', 'a9b1c75a-13be-57b4-a47f-4573ceb73b3d'),
  ('11111111-1111-4111-8111-111111111111', 'jalen brunson', '99dfd60c-c6d6-5a96-8e0c-4766ca918088'),
  ('11111111-1111-4111-8111-111111111111', 'jalen duren', '23c3b4d0-10f3-5b8d-b187-823ee903384b'),
  ('11111111-1111-4111-8111-111111111111', 'jalen green', 'b02c870f-0c72-5ec8-9374-9afecd9743b2'),
  ('11111111-1111-4111-8111-111111111111', 'jalen johnson', '094f78f0-48d3-57c9-ab37-96e33d168a59'),
  ('11111111-1111-4111-8111-111111111111', 'jalen pickett', '3dfdd039-1434-5bd8-b7f3-3f35307e2c95'),
  ('11111111-1111-4111-8111-111111111111', 'jalen smith', '373e582f-14ea-5643-8e3a-42eac246deb7'),
  ('11111111-1111-4111-8111-111111111111', 'jalen suggs', '0e6f5075-947a-5fdc-972d-bb132000435c'),
  ('11111111-1111-4111-8111-111111111111', 'jalen williams', '9fd5a1b5-5a42-5275-b519-03ca1030c75c'),
  ('11111111-1111-4111-8111-111111111111', 'jamal murray', '2af0cd37-ca0a-5a43-b134-4d5a887b50fa'),
  ('11111111-1111-4111-8111-111111111111', 'jamal shead', '48f12232-8c2b-52df-bfe3-a8991b2a050e'),
  ('11111111-1111-4111-8111-111111111111', 'jamaree bouyea', '7abc4497-3205-548a-9145-7db05b6ef0dd'),
  ('11111111-1111-4111-8111-111111111111', 'james', '945db8e7-ebf3-5c3d-935e-41a03de5c3b0'),
  ('11111111-1111-4111-8111-111111111111', 'james harden', 'e2d46caf-3409-577c-ac9f-324d1e254dfa'),
  ('11111111-1111-4111-8111-111111111111', 'jaquez', '92d976c1-d8cf-538a-88f5-63319e8346af'),
  ('11111111-1111-4111-8111-111111111111', 'jarace walker', '8fff2b90-7818-5250-bfed-bf6829021bdb'),
  ('11111111-1111-4111-8111-111111111111', 'jaren jackson', 'ff5688b0-86d6-596e-b69d-d5c2f8beb7af'),
  ('11111111-1111-4111-8111-111111111111', 'jaren jackson jr', 'ff5688b0-86d6-596e-b69d-d5c2f8beb7af'),
  ('11111111-1111-4111-8111-111111111111', 'jarred vanderbilt', 'c3f544f8-6788-5425-890b-57dd965f9b84'),
  ('11111111-1111-4111-8111-111111111111', 'jarrett allen', 'bc06a675-014f-5c30-af59-15bef9d089a5'),
  ('11111111-1111-4111-8111-111111111111', 'jaylen brown', 'c27c2eaf-79b5-54e8-89d6-c10dbaa67ad2'),
  ('11111111-1111-4111-8111-111111111111', 'jaylin williams', '7fed5859-76a4-5b46-8bcb-44d98f359cca'),
  ('11111111-1111-4111-8111-111111111111', 'jaylon tyson', '7581ae92-b2d1-501e-ac6c-34ed65f36507'),
  ('11111111-1111-4111-8111-111111111111', 'jayson tatum', '2ed1f667-c655-57fa-9abc-d1e78934dcaf'),
  ('11111111-1111-4111-8111-111111111111', 'jenkins', 'a07034e7-3522-5c2f-bf37-03505fb0abfc'),
  ('11111111-1111-4111-8111-111111111111', 'jerami grant', '1ae1d4c7-baed-592e-a42b-f9da6c543f0b'),
  ('11111111-1111-4111-8111-111111111111', 'jeremiah fears', 'eb27f503-0e5c-5866-a44e-174de9451697'),
  ('11111111-1111-4111-8111-111111111111', 'jerome', 'f1391f99-5608-55d4-84b5-e9f327a541f0'),
  ('11111111-1111-4111-8111-111111111111', 'jimmy butler', 'ceb8295e-3137-50c8-b6c5-41731dc448eb'),
  ('11111111-1111-4111-8111-111111111111', 'jimmy butler iii', 'ceb8295e-3137-50c8-b6c5-41731dc448eb'),
  ('11111111-1111-4111-8111-111111111111', 'joan beringer', 'b22660dc-0186-5ad0-9a69-ea0a8b8b58e6'),
  ('11111111-1111-4111-8111-111111111111', 'joe', '98bb893b-59c3-57a4-bad0-63f6f92f6abf'),
  ('11111111-1111-4111-8111-111111111111', 'joel embiid', '85ac505d-60bc-5eaa-8387-9d6c704538ca'),
  ('11111111-1111-4111-8111-111111111111', 'john collins', '17e01665-d2d0-5d29-9b53-b637cb1b530f'),
  ('11111111-1111-4111-8111-111111111111', 'john konchar', '46377008-2406-5517-aaeb-6139fc3ef047'),
  ('11111111-1111-4111-8111-111111111111', 'joker', 'a0e96675-37b6-571a-b77b-4a67fb33ee40'),
  ('11111111-1111-4111-8111-111111111111', 'jokic', 'a0e96675-37b6-571a-b77b-4a67fb33ee40'),
  ('11111111-1111-4111-8111-111111111111', 'jonathan isaac', 'fa44d3ac-09ac-51e7-b3ec-67fef1abbae6'),
  ('11111111-1111-4111-8111-111111111111', 'jonathan mogbo', '69624737-72f3-5b56-a4c8-1b2eb00f5e0d'),
  ('11111111-1111-4111-8111-111111111111', 'jordan clarkson', '11b504b1-6db9-54fb-bb1d-5a45c64f2246'),
  ('11111111-1111-4111-8111-111111111111', 'jordan hawkins', 'abfb5901-50bc-5fde-badf-6e7658ef8939'),
  ('11111111-1111-4111-8111-111111111111', 'jordan miller', '445686f0-a416-5cec-a6ab-e064d2a2b32f'),
  ('11111111-1111-4111-8111-111111111111', 'jordan poole', '64895673-ae53-5f91-b9fd-06622b389787'),
  ('11111111-1111-4111-8111-111111111111', 'jose alvarado', '874794d6-b9c1-5911-a718-615e16482920'),
  ('11111111-1111-4111-8111-111111111111', 'josh giddey', '9f64a701-8882-5b74-889f-b75c18e13219'),
  ('11111111-1111-4111-8111-111111111111', 'josh green', 'ad01f4bf-4b05-5a2c-a1bd-269facf4522b'),
  ('11111111-1111-4111-8111-111111111111', 'josh hart', '30167d9a-6cd1-5721-a357-0d85d879f2a3'),
  ('11111111-1111-4111-8111-111111111111', 'josh okogie', '8858665f-c7ac-5bcb-abe9-ce36c2534f28'),
  ('11111111-1111-4111-8111-111111111111', 'jovic', '7965d54a-8ad8-55f0-8b04-480967e91d9e'),
  ('11111111-1111-4111-8111-111111111111', 'jrue holiday', '514deb19-47e7-5f23-b224-e865d17f67a1'),
  ('11111111-1111-4111-8111-111111111111', 'julian strawther', '4798330c-49d1-5473-ba4a-4872bf31d8de'),
  ('11111111-1111-4111-8111-111111111111', 'julius randle', '6c930ad7-a5c9-523c-a0b1-f206c3f1e4af'),
  ('11111111-1111-4111-8111-111111111111', 'justin edwards', 'df3eec0d-7cba-543f-b17e-3e708ae6e12a'),
  ('11111111-1111-4111-8111-111111111111', 'jusuf nurkic', '64bd2a34-4a50-57f5-bc8f-9bf5f34718f7'),
  ('11111111-1111-4111-8111-111111111111', 'karl anthony towns', '3acc64ae-773e-5d44-b340-921d6f488e83'),
  ('11111111-1111-4111-8111-111111111111', 'kat', '3acc64ae-773e-5d44-b340-921d6f488e83'),
  ('11111111-1111-4111-8111-111111111111', 'kawhi leonard', '9d98c82e-cc41-5301-b116-8cc1c99e5678'),
  ('11111111-1111-4111-8111-111111111111', 'kcp', 'e5a965a1-4988-586a-b6d2-8ce4d5b21df5'),
  ('11111111-1111-4111-8111-111111111111', 'keegan murray', '2360403e-0517-55ca-9b5c-5c9c52050c31'),
  ('11111111-1111-4111-8111-111111111111', 'kel el ware', '018dbbf4-862f-51f8-a34b-0a694f89fdf0'),
  ('11111111-1111-4111-8111-111111111111', 'keldon johnson', '2d1a076e-6594-50a0-b54b-7410f2ce9060'),
  ('11111111-1111-4111-8111-111111111111', 'kelly oubre', 'c9924641-2472-5fae-b969-6efdac063dc8'),
  ('11111111-1111-4111-8111-111111111111', 'kelly oubre jr', 'c9924641-2472-5fae-b969-6efdac063dc8'),
  ('11111111-1111-4111-8111-111111111111', 'kennard', 'e1796c1d-0e70-5da4-aedf-20ab29a56eb6'),
  ('11111111-1111-4111-8111-111111111111', 'kenrich williams', 'cb9f350c-0d63-53b5-a628-96898d600ee7'),
  ('11111111-1111-4111-8111-111111111111', 'kentavious caldwell pope', 'e5a965a1-4988-586a-b6d2-8ce4d5b21df5'),
  ('11111111-1111-4111-8111-111111111111', 'kessler', '33beff5c-4e4a-57f4-8c31-48886becbe1b'),
  ('11111111-1111-4111-8111-111111111111', 'kevin durant', '7cb51125-f64a-5f25-bc28-3a1a2436cc73'),
  ('11111111-1111-4111-8111-111111111111', 'kevin huerter', 'd5e4eda5-e056-5c6f-b467-05441872c588'),
  ('11111111-1111-4111-8111-111111111111', 'kevin porter', '1320a938-f24f-58f5-8413-9aef81e53233'),
  ('11111111-1111-4111-8111-111111111111', 'kevin porter jr', '1320a938-f24f-58f5-8413-9aef81e53233'),
  ('11111111-1111-4111-8111-111111111111', 'kevon looney', 'de0c421f-ad96-5a10-9426-ef4a18da5982'),
  ('11111111-1111-4111-8111-111111111111', 'keyonte george', '5c9a4bce-43c0-58ee-b47b-b3dbfdeca358'),
  ('11111111-1111-4111-8111-111111111111', 'khaman maluach', '5116d09a-720f-584e-8f8c-cfd400dcc1ab'),
  ('11111111-1111-4111-8111-111111111111', 'khris middleton', '4de7acb2-0ac6-502d-9951-85a0e89f652c'),
  ('11111111-1111-4111-8111-111111111111', 'kispert', '134f65f8-ae80-5e80-a9ec-b705547c171c'),
  ('11111111-1111-4111-8111-111111111111', 'klay thompson', 'af83c7cd-af3b-5c97-93aa-bb4bd783c81e'),
  ('11111111-1111-4111-8111-111111111111', 'knueppel', '8594243b-e38b-53c2-95dc-598634a20bac'),
  ('11111111-1111-4111-8111-111111111111', 'kon knueppel', '8594243b-e38b-53c2-95dc-598634a20bac'),
  ('11111111-1111-4111-8111-111111111111', 'konchar', '46377008-2406-5517-aaeb-6139fc3ef047'),
  ('11111111-1111-4111-8111-111111111111', 'kornet', '63f02dd1-8d88-5e05-ad6d-e25036acaa68'),
  ('11111111-1111-4111-8111-111111111111', 'kris dunn', '4cfe62fd-a5e2-5f1c-a9f7-78eddc1b4550'),
  ('11111111-1111-4111-8111-111111111111', 'kris murray', 'f0ee5085-3529-5391-ac26-7ef370c80039'),
  ('11111111-1111-4111-8111-111111111111', 'kristaps porzingis', 'fe550f73-41c7-56bb-b6dc-25ae0ee99bee'),
  ('11111111-1111-4111-8111-111111111111', 'kuzma', '59424fc9-8445-51ba-847c-e825a459fd7d'),
  ('11111111-1111-4111-8111-111111111111', 'kyle kuzma', '59424fc9-8445-51ba-847c-e825a459fd7d'),
  ('11111111-1111-4111-8111-111111111111', 'kyrie irving', '28d9cd4a-dd1b-5ed4-a417-ba07c4f0ac5e'),
  ('11111111-1111-4111-8111-111111111111', 'lamelo ball', 'f3663088-c877-5038-b3a0-e704a54c4c36'),
  ('11111111-1111-4111-8111-111111111111', 'laravia', '14f84547-a14a-5e42-acba-1dc8ae82bbba'),
  ('11111111-1111-4111-8111-111111111111', 'larsson', 'bbcd3da4-ae66-5fcd-b959-8644320f8e39'),
  ('11111111-1111-4111-8111-111111111111', 'lauri markkanen', '5a22d921-b530-595b-bd68-163ff2023609'),
  ('11111111-1111-4111-8111-111111111111', 'lavine', 'd1b70f9e-57f9-5906-a4bf-79b59c004dd2'),
  ('11111111-1111-4111-8111-111111111111', 'lebron james', '945db8e7-ebf3-5c3d-935e-41a03de5c3b0'),
  ('11111111-1111-4111-8111-111111111111', 'leonard', '9d98c82e-cc41-5301-b116-8cc1c99e5678'),
  ('11111111-1111-4111-8111-111111111111', 'levert', '8eb3e988-e167-55a0-a87d-e6981fe5dba6'),
  ('11111111-1111-4111-8111-111111111111', 'lillard', 'c7107fa5-2cca-5f17-a47b-ec88a9883c05'),
  ('11111111-1111-4111-8111-111111111111', 'lively', '8134e5b8-caca-5078-99ec-c5e40ebd3476'),
  ('11111111-1111-4111-8111-111111111111', 'looney', 'de0c421f-ad96-5a10-9426-ef4a18da5982'),
  ('11111111-1111-4111-8111-111111111111', 'lopez', '1f94d999-b114-587d-9ecf-5f3b741c53a9'),
  ('11111111-1111-4111-8111-111111111111', 'luguentz dort', '57e7fa44-9517-55e1-ab1e-15704e986bd5'),
  ('11111111-1111-4111-8111-111111111111', 'luka doncic', 'b8934fdb-2951-5b51-9688-b7e73d652c67'),
  ('11111111-1111-4111-8111-111111111111', 'luka garza', 'bc072cbe-0e17-539b-b555-8847c0b6917f'),
  ('11111111-1111-4111-8111-111111111111', 'luke kennard', 'e1796c1d-0e70-5da4-aedf-20ab29a56eb6'),
  ('11111111-1111-4111-8111-111111111111', 'luke kornet', '63f02dd1-8d88-5e05-ad6d-e25036acaa68'),
  ('11111111-1111-4111-8111-111111111111', 'lyles', '4e5c7b43-fbcf-5ac2-bebe-9f6739f34433'),
  ('11111111-1111-4111-8111-111111111111', 'malik monk', '16a5216f-31d4-5aa8-98e3-0a5a5b0e1484'),
  ('11111111-1111-4111-8111-111111111111', 'maluach', '5116d09a-720f-584e-8f8c-cfd400dcc1ab'),
  ('11111111-1111-4111-8111-111111111111', 'mark williams', '53820af2-e3ba-5e6a-8cba-6a36d8c3e93c'),
  ('11111111-1111-4111-8111-111111111111', 'markkanen', '5a22d921-b530-595b-bd68-163ff2023609'),
  ('11111111-1111-4111-8111-111111111111', 'marshall', '52b860ad-037c-5817-a47a-0c54099d261a'),
  ('11111111-1111-4111-8111-111111111111', 'martin', '65d68852-45ae-5a29-b4dc-ebdc3b15f3e8'),
  ('11111111-1111-4111-8111-111111111111', 'matas buzelis', '0b6da973-3637-542a-b739-cb49033d0dea'),
  ('11111111-1111-4111-8111-111111111111', 'mathurin', 'eec5ed64-5fb2-555b-aea1-d4d65b4113fe'),
  ('11111111-1111-4111-8111-111111111111', 'max christie', '16cdfca1-344e-57a9-ab47-a69ef246a373'),
  ('11111111-1111-4111-8111-111111111111', 'max strus', 'f2174ac7-03ea-5f66-b2fb-e018f4f40f4a'),
  ('11111111-1111-4111-8111-111111111111', 'maxey', 'bed68fc6-c365-5ffd-8755-8c47a7d1886c'),
  ('11111111-1111-4111-8111-111111111111', 'maxime raynaud', '9dcf6dd8-8f51-5950-aab0-8afb21e6f404'),
  ('11111111-1111-4111-8111-111111111111', 'mcbride', 'a2bd7774-3de1-560b-900a-2de57e942a94'),
  ('11111111-1111-4111-8111-111111111111', 'mccollum', 'aa9d6e71-111f-5702-8fbd-858ae9004ab5'),
  ('11111111-1111-4111-8111-111111111111', 'mcconnell', '57931dbd-4127-550a-b820-3b567b519f7a'),
  ('11111111-1111-4111-8111-111111111111', 'mcdaniels', 'c334b171-623e-57f1-8c40-622af07854db'),
  ('11111111-1111-4111-8111-111111111111', 'melton', '9436a5ac-69e8-5fcf-a2b7-b669da840aaa'),
  ('11111111-1111-4111-8111-111111111111', 'merrill', 'f976799e-033c-5aa2-9f81-82d910371c10'),
  ('11111111-1111-4111-8111-111111111111', 'michael porter', '1f9cbeb7-697e-5b70-b7bd-1f6cc4da7a0c'),
  ('11111111-1111-4111-8111-111111111111', 'michael porter jr', '1f9cbeb7-697e-5b70-b7bd-1f6cc4da7a0c'),
  ('11111111-1111-4111-8111-111111111111', 'middleton', '4de7acb2-0ac6-502d-9951-85a0e89f652c'),
  ('11111111-1111-4111-8111-111111111111', 'mikal bridges', 'b892ebcd-86b4-538e-b559-7be8c4684ca4'),
  ('11111111-1111-4111-8111-111111111111', 'miles bridges', '3284994c-24a6-5625-8d11-775654e44dcd'),
  ('11111111-1111-4111-8111-111111111111', 'miles mcbride', 'a2bd7774-3de1-560b-900a-2de57e942a94'),
  ('11111111-1111-4111-8111-111111111111', 'missi', '924a94fa-a123-5acb-a902-488fc86ecb77'),
  ('11111111-1111-4111-8111-111111111111', 'mitchell robinson', 'a02847cb-848b-5e11-86f0-ec829ac5eefd'),
  ('11111111-1111-4111-8111-111111111111', 'mobley', '20c07e30-23fd-580f-8b73-e2730f6c99cb'),
  ('11111111-1111-4111-8111-111111111111', 'mogbo', '69624737-72f3-5b56-a4c8-1b2eb00f5e0d'),
  ('11111111-1111-4111-8111-111111111111', 'monk', '16a5216f-31d4-5aa8-98e3-0a5a5b0e1484'),
  ('11111111-1111-4111-8111-111111111111', 'moody', '0fa500d9-dccc-5414-af08-dfd6aa4d0761'),
  ('11111111-1111-4111-8111-111111111111', 'morant', '80885d00-5263-5ef1-bcd4-d8cf76c8ab59'),
  ('11111111-1111-4111-8111-111111111111', 'moritz wagner', 'd3cf8c12-060f-5ffe-924b-50e36c7d252a'),
  ('11111111-1111-4111-8111-111111111111', 'moses moody', '0fa500d9-dccc-5414-af08-dfd6aa4d0761'),
  ('11111111-1111-4111-8111-111111111111', 'mpj', '1f9cbeb7-697e-5b70-b7bd-1f6cc4da7a0c'),
  ('11111111-1111-4111-8111-111111111111', 'murphy', 'ad05cab8-e0e1-5fd1-97fd-df8c8eea3c74'),
  ('11111111-1111-4111-8111-111111111111', 'mykhailiuk', 'bd9650ef-e9b1-5f65-a10a-918c23a0bc7e'),
  ('11111111-1111-4111-8111-111111111111', 'myles turner', '6700264a-257d-5dc7-94f4-f503a920b686'),
  ('11111111-1111-4111-8111-111111111111', 'nae qwan tomlin', '70956387-260b-5099-a6de-a1919884bf23'),
  ('11111111-1111-4111-8111-111111111111', 'naji marshall', '52b860ad-037c-5817-a47a-0c54099d261a'),
  ('11111111-1111-4111-8111-111111111111', 'naw', '9e12a870-ef63-5d8f-a285-0778af66f94b'),
  ('11111111-1111-4111-8111-111111111111', 'naz reid', '468c9c50-f56b-5fce-9fb6-6a2724a66e10'),
  ('11111111-1111-4111-8111-111111111111', 'neale', '7488bb47-7583-5e72-9f08-9acb6ecac136'),
  ('11111111-1111-4111-8111-111111111111', 'neemias queta', 'd6e695a3-fb5f-5610-9c71-f29abb117d87'),
  ('11111111-1111-4111-8111-111111111111', 'nembhard', '8daf632e-aee1-5271-9590-5e1db5c55375'),
  ('11111111-1111-4111-8111-111111111111', 'nesmith', '76a9ef17-ee46-586d-82e4-5f4ec56d312d'),
  ('11111111-1111-4111-8111-111111111111', 'nic claxton', '0e63f09b-0d32-5e76-891b-35f2ab1ddf04'),
  ('11111111-1111-4111-8111-111111111111', 'nickeil alexander walker', '9e12a870-ef63-5d8f-a285-0778af66f94b'),
  ('11111111-1111-4111-8111-111111111111', 'niederhauser', '9ef5b8f0-29db-5191-bd20-edc179fe16c7'),
  ('11111111-1111-4111-8111-111111111111', 'nikola jokic', 'a0e96675-37b6-571a-b77b-4a67fb33ee40'),
  ('11111111-1111-4111-8111-111111111111', 'nikola jovic', '7965d54a-8ad8-55f0-8b04-480967e91d9e'),
  ('11111111-1111-4111-8111-111111111111', 'nikola topic', '704f6bfc-c57e-52fb-acbd-970714770cf6'),
  ('11111111-1111-4111-8111-111111111111', 'nikola vucevic', 'c1f742b5-eebf-50cc-886f-251b0e9a80e5'),
  ('11111111-1111-4111-8111-111111111111', 'nique clifford', '98453afb-f1ef-5d13-bc43-6ccd8ebd71ab'),
  ('11111111-1111-4111-8111-111111111111', 'nnaji', '19e8aa91-5447-5c8a-a84b-5982cff3819c'),
  ('11111111-1111-4111-8111-111111111111', 'noah clowney', '80f1a319-b1f1-50f2-9fb3-31e353d75e56'),
  ('11111111-1111-4111-8111-111111111111', 'nolan traore', '82231779-15b2-56dc-b7e5-d0fe83138317'),
  ('11111111-1111-4111-8111-111111111111', 'norman powell', '618b4f9b-c1fb-5664-a486-07a276811d86'),
  ('11111111-1111-4111-8111-111111111111', 'nurkic', '64bd2a34-4a50-57f5-bc8f-9bf5f34718f7'),
  ('11111111-1111-4111-8111-111111111111', 'obi toppin', '9e6031ff-5ddb-5498-aee3-c8f8607afbef'),
  ('11111111-1111-4111-8111-111111111111', 'og', '408d42de-a85f-58b1-ac25-dae42029dde2'),
  ('11111111-1111-4111-8111-111111111111', 'og anunoby', '408d42de-a85f-58b1-ac25-dae42029dde2'),
  ('11111111-1111-4111-8111-111111111111', 'okogie', '8858665f-c7ac-5bcb-abe9-ce36c2534f28'),
  ('11111111-1111-4111-8111-111111111111', 'okongwu', '26e63941-66a7-5a15-9299-68f11cfc9574'),
  ('11111111-1111-4111-8111-111111111111', 'okoro', '8068bac5-c6c8-5b91-ab3b-03efbda3048c'),
  ('11111111-1111-4111-8111-111111111111', 'onyeka okongwu', '26e63941-66a7-5a15-9299-68f11cfc9574'),
  ('11111111-1111-4111-8111-111111111111', 'oubre', 'c9924641-2472-5fae-b969-6efdac063dc8'),
  ('11111111-1111-4111-8111-111111111111', 'ousmane dieng', '552db30e-38de-5a6a-83bc-f774d287dba2'),
  ('11111111-1111-4111-8111-111111111111', 'p j washington', 'aba007c8-ae04-5714-b167-de9200025f29'),
  ('11111111-1111-4111-8111-111111111111', 'pacome dadiet', '07a9a727-71bd-55b5-a81d-17aca4ff88f3'),
  ('11111111-1111-4111-8111-111111111111', 'paolo banchero', '2c7ef32a-9a1c-52bd-9f94-daf54fce10e6'),
  ('11111111-1111-4111-8111-111111111111', 'pascal siakam', '8f7f0ade-bdd3-5461-bd2a-47518e2b7b40'),
  ('11111111-1111-4111-8111-111111111111', 'patrick williams', '3a4035d9-1a74-5dc8-8e88-4d83d977dc16'),
  ('11111111-1111-4111-8111-111111111111', 'paul george', '2c1a1f99-725d-53d0-95a3-8d4a6c6d5f3f'),
  ('11111111-1111-4111-8111-111111111111', 'paul reed', 'c3426c5b-c0ea-5a1d-b4c6-8ce49a427955'),
  ('11111111-1111-4111-8111-111111111111', 'payton pritchard', '01676dc1-b40f-53f9-a2b7-61381f9fdbe6'),
  ('11111111-1111-4111-8111-111111111111', 'pelle larsson', 'bbcd3da4-ae66-5fcd-b959-8644320f8e39'),
  ('11111111-1111-4111-8111-111111111111', 'peyton watson', '3ad2cf7f-aa18-5c42-9702-08af45a55029'),
  ('11111111-1111-4111-8111-111111111111', 'pg 13', '2c1a1f99-725d-53d0-95a3-8d4a6c6d5f3f'),
  ('11111111-1111-4111-8111-111111111111', 'pg13', '2c1a1f99-725d-53d0-95a3-8d4a6c6d5f3f'),
  ('11111111-1111-4111-8111-111111111111', 'pickett', '3dfdd039-1434-5bd8-b7f3-3f35307e2c95'),
  ('11111111-1111-4111-8111-111111111111', 'podziemski', 'd9b60fd2-599c-587a-9b4c-c0e5942e1fe1'),
  ('11111111-1111-4111-8111-111111111111', 'poeltl', 'a9b1c75a-13be-57b4-a47f-4573ceb73b3d'),
  ('11111111-1111-4111-8111-111111111111', 'poole', '64895673-ae53-5f91-b9fd-06622b389787'),
  ('11111111-1111-4111-8111-111111111111', 'pope', 'e5a965a1-4988-586a-b6d2-8ce4d5b21df5'),
  ('11111111-1111-4111-8111-111111111111', 'portis', 'd92fd1bc-f428-52bf-8f0f-36311ea00ae5'),
  ('11111111-1111-4111-8111-111111111111', 'porzingis', 'fe550f73-41c7-56bb-b6dc-25ae0ee99bee'),
  ('11111111-1111-4111-8111-111111111111', 'precious achiuwa', '61cafa45-05a1-55b7-abbc-68f757bae14d'),
  ('11111111-1111-4111-8111-111111111111', 'pritchard', '01676dc1-b40f-53f9-a2b7-61381f9fdbe6'),
  ('11111111-1111-4111-8111-111111111111', 'queen', 'e9f6a6ff-20c4-59d1-8ec7-7ba286559e87'),
  ('11111111-1111-4111-8111-111111111111', 'quentin grimes', 'd20d6f32-b9c1-5185-9e7f-acea7fd24da8'),
  ('11111111-1111-4111-8111-111111111111', 'queta', 'd6e695a3-fb5f-5610-9c71-f29abb117d87'),
  ('11111111-1111-4111-8111-111111111111', 'quickley', '3d59c499-e973-53bf-beaf-b2a15b88e3e8'),
  ('11111111-1111-4111-8111-111111111111', 'randle', '6c930ad7-a5c9-523c-a0b1-f206c3f1e4af'),
  ('11111111-1111-4111-8111-111111111111', 'raynaud', '9dcf6dd8-8f51-5950-aab0-8afb21e6f404'),
  ('11111111-1111-4111-8111-111111111111', 'reaves', 'dff96553-9113-5967-a004-22136e92da6c'),
  ('11111111-1111-4111-8111-111111111111', 'reed', 'c3426c5b-c0ea-5a1d-b4c6-8ce49a427955'),
  ('11111111-1111-4111-8111-111111111111', 'reed sheppard', '8e8ae5ef-1730-5d0b-b630-02793f1d7b79'),
  ('11111111-1111-4111-8111-111111111111', 'reid', '468c9c50-f56b-5fce-9fb6-6a2724a66e10'),
  ('11111111-1111-4111-8111-111111111111', 'riley', '7e26312a-a39c-5a3f-9fe7-fbf77377c797'),
  ('11111111-1111-4111-8111-111111111111', 'risacher', '4dfed4f0-17d8-5d81-94f7-060933e62f6b'),
  ('11111111-1111-4111-8111-111111111111', 'rj barrett', 'fd983ec3-55a1-577a-bab1-4984d9320b3a'),
  ('11111111-1111-4111-8111-111111111111', 'rob dillingham', '64cd3fcf-900d-589d-9b1b-d894d6a0a332'),
  ('11111111-1111-4111-8111-111111111111', 'robert williams', '2c49f36d-f3f1-5ae7-ae74-86e6768bacb1'),
  ('11111111-1111-4111-8111-111111111111', 'robert williams iii', '2c49f36d-f3f1-5ae7-ae74-86e6768bacb1'),
  ('11111111-1111-4111-8111-111111111111', 'rollins', 'aa908742-b121-5735-9195-c1de3eebb68e'),
  ('11111111-1111-4111-8111-111111111111', 'ronald holland', 'a1116b7e-ec74-5376-915a-4eeb73045914'),
  ('11111111-1111-4111-8111-111111111111', 'ronald holland ii', 'a1116b7e-ec74-5376-915a-4eeb73045914'),
  ('11111111-1111-4111-8111-111111111111', 'royce o neale', '7488bb47-7583-5e72-9f08-9acb6ecac136'),
  ('11111111-1111-4111-8111-111111111111', 'rudy gobert', '273bc52f-8c62-54e1-95e4-cf7cac272d72'),
  ('11111111-1111-4111-8111-111111111111', 'rui hachimura', '0247b6aa-b950-5275-9de8-c472db8ccfc8'),
  ('11111111-1111-4111-8111-111111111111', 'russell', '10fbff1b-0089-5d64-b267-2ad6516ac3a1'),
  ('11111111-1111-4111-8111-111111111111', 'ryan dunn', '5a3618e5-1dd0-5fe4-ba32-50b2bd00389c'),
  ('11111111-1111-4111-8111-111111111111', 'ryan rollins', 'aa908742-b121-5735-9195-c1de3eebb68e'),
  ('11111111-1111-4111-8111-111111111111', 'sabonis', '603ca035-8a6d-5cdd-91de-5a18bfbdb4d1'),
  ('11111111-1111-4111-8111-111111111111', 'saddiq bey', 'd2197b51-67c2-5495-a382-bf594bb9ff2e'),
  ('11111111-1111-4111-8111-111111111111', 'salaun', '9b74f32f-85a4-57a6-8b28-488167eba2e3'),
  ('11111111-1111-4111-8111-111111111111', 'sam hauser', '7cfd8819-9fb0-5f05-b730-ee019e391fd0'),
  ('11111111-1111-4111-8111-111111111111', 'sam merrill', 'f976799e-033c-5aa2-9f81-82d910371c10'),
  ('11111111-1111-4111-8111-111111111111', 'santi aldama', '757dbf65-4b87-5614-9b45-b4e5db8e1caf'),
  ('11111111-1111-4111-8111-111111111111', 'santos', 'b11a3015-c3dc-58c5-9de1-751077ec7616'),
  ('11111111-1111-4111-8111-111111111111', 'saraf', 'd92bd6e5-b687-55fa-97c6-d7090e491b3b'),
  ('11111111-1111-4111-8111-111111111111', 'sarr', '8e808dc4-b6cf-57b0-918c-8b0bcb46b893'),
  ('11111111-1111-4111-8111-111111111111', 'scheierman', '8b3cdcc2-efd8-5a08-96e2-9e2d79695b1b'),
  ('11111111-1111-4111-8111-111111111111', 'schroder', '1a14b60c-8a93-5c8f-b251-9fa90870cd97'),
  ('11111111-1111-4111-8111-111111111111', 'scoot henderson', 'a4b466f6-52a9-5f4c-8293-8da9d2e24994'),
  ('11111111-1111-4111-8111-111111111111', 'scottie barnes', 'ecfd3d09-2b9a-5bcb-aa8d-a9357685f279'),
  ('11111111-1111-4111-8111-111111111111', 'sengun', '180327f4-70f7-5ce4-848a-265319749781'),
  ('11111111-1111-4111-8111-111111111111', 'sensabaugh', '1164eebb-2ce9-5dd6-b68e-454aaf3d13fb'),
  ('11111111-1111-4111-8111-111111111111', 'sexton', 'ee9c2600-494d-5759-ad27-5f60b93f5dcc'),
  ('11111111-1111-4111-8111-111111111111', 'sga', '8d57a7a4-082c-50c8-ba77-44c06af486ce'),
  ('11111111-1111-4111-8111-111111111111', 'shaedon sharpe', 'fa8117cb-69cc-5074-88d9-d6c0702aadd6'),
  ('11111111-1111-4111-8111-111111111111', 'shai gilgeous alexander', '8d57a7a4-082c-50c8-ba77-44c06af486ce'),
  ('11111111-1111-4111-8111-111111111111', 'shannon', '30695469-2c11-5cdb-930c-9a3345c8f3ed'),
  ('11111111-1111-4111-8111-111111111111', 'shead', '48f12232-8c2b-52df-bfe3-a8991b2a050e'),
  ('11111111-1111-4111-8111-111111111111', 'siakam', '8f7f0ade-bdd3-5461-bd2a-47518e2b7b40'),
  ('11111111-1111-4111-8111-111111111111', 'silva', '2b44aeac-22c6-5190-ac6d-cb52cf8227f9'),
  ('11111111-1111-4111-8111-111111111111', 'simone fontecchio', '3dc7d455-7cbf-5160-8e21-502afe55bce0'),
  ('11111111-1111-4111-8111-111111111111', 'simons', 'dc093170-f828-58f9-8826-7d010b05b6f9'),
  ('11111111-1111-4111-8111-111111111111', 'steph', '017e2b74-9722-5ff5-9273-4b183f8e4d83'),
  ('11111111-1111-4111-8111-111111111111', 'stephen curry', '017e2b74-9722-5ff5-9273-4b183f8e4d83'),
  ('11111111-1111-4111-8111-111111111111', 'stephon castle', 'b9ce6259-a96c-5aea-b4cf-c5285f698cf0'),
  ('11111111-1111-4111-8111-111111111111', 'steven adams', 'c176fe28-5127-5ea3-a3f0-3ae4b1ebb7d9'),
  ('11111111-1111-4111-8111-111111111111', 'stewart', 'fa65d721-2dae-59ed-88c9-84f6a19a95ba'),
  ('11111111-1111-4111-8111-111111111111', 'strawther', '4798330c-49d1-5473-ba4a-4872bf31d8de'),
  ('11111111-1111-4111-8111-111111111111', 'strus', 'f2174ac7-03ea-5f66-b2fb-e018f4f40f4a'),
  ('11111111-1111-4111-8111-111111111111', 'suggs', '0e6f5075-947a-5fdc-972d-bb132000435c'),
  ('11111111-1111-4111-8111-111111111111', 'svi mykhailiuk', 'bd9650ef-e9b1-5f65-a10a-918c23a0bc7e'),
  ('11111111-1111-4111-8111-111111111111', 't j mcconnell', '57931dbd-4127-550a-b820-3b567b519f7a'),
  ('11111111-1111-4111-8111-111111111111', 'tari eason', 'c9da9edc-1c31-5b4d-898d-70c4a6e61403'),
  ('11111111-1111-4111-8111-111111111111', 'tatum', '2ed1f667-c655-57fa-9abc-d1e78934dcaf'),
  ('11111111-1111-4111-8111-111111111111', 'taylor hendricks', 'bf75e797-6101-5263-8b25-a8a239235bd7'),
  ('11111111-1111-4111-8111-111111111111', 'terance mann', '1fbdd360-6745-5c64-9ebb-1da8cc6aa52c'),
  ('11111111-1111-4111-8111-111111111111', 'terrence shannon', '30695469-2c11-5cdb-930c-9a3345c8f3ed'),
  ('11111111-1111-4111-8111-111111111111', 'terrence shannon jr', '30695469-2c11-5cdb-930c-9a3345c8f3ed'),
  ('11111111-1111-4111-8111-111111111111', 'tidjane salaun', '9b74f32f-85a4-57a6-8b28-488167eba2e3'),
  ('11111111-1111-4111-8111-111111111111', 'tim hardaway', '433feaa6-b514-54fa-9907-f228008cd4cf'),
  ('11111111-1111-4111-8111-111111111111', 'tim hardaway jr', '433feaa6-b514-54fa-9907-f228008cd4cf'),
  ('11111111-1111-4111-8111-111111111111', 'tobias harris', '8a24582b-4340-5eb5-8c22-2db51fe5ad9e'),
  ('11111111-1111-4111-8111-111111111111', 'tomlin', '70956387-260b-5099-a6de-a1919884bf23'),
  ('11111111-1111-4111-8111-111111111111', 'topic', '704f6bfc-c57e-52fb-acbd-970714770cf6'),
  ('11111111-1111-4111-8111-111111111111', 'toppin', '9e6031ff-5ddb-5498-aee3-c8f8607afbef'),
  ('11111111-1111-4111-8111-111111111111', 'toumani camara', '61509eeb-9ca8-5c8b-a647-789e44d51590'),
  ('11111111-1111-4111-8111-111111111111', 'towns', '3acc64ae-773e-5d44-b340-921d6f488e83'),
  ('11111111-1111-4111-8111-111111111111', 'trae', 'bc8b2a68-e23f-569f-81c3-72e0fa4daedd'),
  ('11111111-1111-4111-8111-111111111111', 'trae young', 'bc8b2a68-e23f-569f-81c3-72e0fa4daedd'),
  ('11111111-1111-4111-8111-111111111111', 'traore', '82231779-15b2-56dc-b7e5-d0fe83138317'),
  ('11111111-1111-4111-8111-111111111111', 'trayce jackson davis', '9c682405-9c51-5931-abd8-44b8ab18fb8d'),
  ('11111111-1111-4111-8111-111111111111', 'tre johnson', '0106f743-6466-5ed2-aaa8-44a084b39d65'),
  ('11111111-1111-4111-8111-111111111111', 'tre jones', 'c674bb54-3222-5f78-832b-76eeee3fd2c6'),
  ('11111111-1111-4111-8111-111111111111', 'tre mann', '24b76b75-e99d-5ada-b7e0-e375f83aeb55'),
  ('11111111-1111-4111-8111-111111111111', 'trendon watford', '0f8d7a91-cb25-56ea-acc7-8b45e0caf640'),
  ('11111111-1111-4111-8111-111111111111', 'trey lyles', '4e5c7b43-fbcf-5ac2-bebe-9f6739f34433'),
  ('11111111-1111-4111-8111-111111111111', 'trey murphy', 'ad05cab8-e0e1-5fd1-97fd-df8c8eea3c74'),
  ('11111111-1111-4111-8111-111111111111', 'trey murphy iii', 'ad05cab8-e0e1-5fd1-97fd-df8c8eea3c74'),
  ('11111111-1111-4111-8111-111111111111', 'tristan da silva', '2b44aeac-22c6-5190-ac6d-cb52cf8227f9'),
  ('11111111-1111-4111-8111-111111111111', 'turner', '6700264a-257d-5dc7-94f4-f503a920b686'),
  ('11111111-1111-4111-8111-111111111111', 'ty jerome', 'f1391f99-5608-55d4-84b5-e9f327a541f0'),
  ('11111111-1111-4111-8111-111111111111', 'tyler herro', '97dc4a23-7ffe-5487-86cb-1b0946fc0eaf'),
  ('11111111-1111-4111-8111-111111111111', 'tyrese haliburton', '090d80c5-91b7-5557-b720-e0d017b160dc'),
  ('11111111-1111-4111-8111-111111111111', 'tyrese maxey', 'bed68fc6-c365-5ffd-8755-8c47a7d1886c'),
  ('11111111-1111-4111-8111-111111111111', 'tyson', '7581ae92-b2d1-501e-ac6c-34ed65f36507'),
  ('11111111-1111-4111-8111-111111111111', 'vanderbilt', 'c3f544f8-6788-5425-890b-57dd965f9b84'),
  ('11111111-1111-4111-8111-111111111111', 'vanvleet', 'e16c653e-80ef-54e2-8c36-2ae631561d9c'),
  ('11111111-1111-4111-8111-111111111111', 'vassell', 'c1565d0a-8276-500f-9efb-117e04ac7920'),
  ('11111111-1111-4111-8111-111111111111', 'victor wembanyama', '33095356-b2c3-5050-ab17-3410ccca9a97'),
  ('11111111-1111-4111-8111-111111111111', 'vj edgecombe', '97eb52f1-9db9-5fba-86ff-77b084b33be2'),
  ('11111111-1111-4111-8111-111111111111', 'vucevic', 'c1f742b5-eebf-50cc-886f-251b0e9a80e5'),
  ('11111111-1111-4111-8111-111111111111', 'wade', 'f2ba6923-b485-5da7-8107-53976f63d516'),
  ('11111111-1111-4111-8111-111111111111', 'walker kessler', '33beff5c-4e4a-57f4-8c31-48886becbe1b'),
  ('11111111-1111-4111-8111-111111111111', 'wallace', 'dd5976fe-1fa3-5fd5-a6bb-22236aa11d5e'),
  ('11111111-1111-4111-8111-111111111111', 'walter', '35044446-d6ca-5305-95cc-12546afcb96e'),
  ('11111111-1111-4111-8111-111111111111', 'walter clayton', 'c691dc77-d9c2-572a-9400-5d1e3ac86b55'),
  ('11111111-1111-4111-8111-111111111111', 'walter clayton jr', 'c691dc77-d9c2-572a-9400-5d1e3ac86b55'),
  ('11111111-1111-4111-8111-111111111111', 'ware', '018dbbf4-862f-51f8-a34b-0a694f89fdf0'),
  ('11111111-1111-4111-8111-111111111111', 'washington', 'aba007c8-ae04-5714-b167-de9200025f29'),
  ('11111111-1111-4111-8111-111111111111', 'watford', '0f8d7a91-cb25-56ea-acc7-8b45e0caf640'),
  ('11111111-1111-4111-8111-111111111111', 'watson', '3ad2cf7f-aa18-5c42-9702-08af45a55029'),
  ('11111111-1111-4111-8111-111111111111', 'wembanyama', '33095356-b2c3-5050-ab17-3410ccca9a97'),
  ('11111111-1111-4111-8111-111111111111', 'wemby', '33095356-b2c3-5050-ab17-3410ccca9a97'),
  ('11111111-1111-4111-8111-111111111111', 'wendell carter', '43334b42-1fba-59df-8b4b-0561eab4efeb'),
  ('11111111-1111-4111-8111-111111111111', 'wendell carter jr', '43334b42-1fba-59df-8b4b-0561eab4efeb'),
  ('11111111-1111-4111-8111-111111111111', 'whitmore', '89bd81c9-a0e2-5d01-a6b7-a6cfd9aedc58'),
  ('11111111-1111-4111-8111-111111111111', 'will riley', '7e26312a-a39c-5a3f-9fe7-fbf77377c797'),
  ('11111111-1111-4111-8111-111111111111', 'williamson', 'd1f207e5-1b45-5b13-8672-2291f682bdd9'),
  ('11111111-1111-4111-8111-111111111111', 'yang hansen', 'c521de08-34e1-5cda-a42c-3cb8d2da9852'),
  ('11111111-1111-4111-8111-111111111111', 'yanic konan niederhauser', '9ef5b8f0-29db-5191-bd20-edc179fe16c7'),
  ('11111111-1111-4111-8111-111111111111', 'young', 'bc8b2a68-e23f-569f-81c3-72e0fa4daedd'),
  ('11111111-1111-4111-8111-111111111111', 'yves missi', '924a94fa-a123-5acb-a902-488fc86ecb77'),
  ('11111111-1111-4111-8111-111111111111', 'zaccharie risacher', '4dfed4f0-17d8-5d81-94f7-060933e62f6b'),
  ('11111111-1111-4111-8111-111111111111', 'zach collins', 'eb695ebf-d3d4-599d-9b64-844466388c89'),
  ('11111111-1111-4111-8111-111111111111', 'zach edey', '12e681de-cc8f-57d8-b72e-2138d2a8d4b6'),
  ('11111111-1111-4111-8111-111111111111', 'zach lavine', 'd1b70f9e-57f9-5906-a4bf-79b59c004dd2'),
  ('11111111-1111-4111-8111-111111111111', 'zeke nnaji', '19e8aa91-5447-5c8a-a84b-5982cff3819c'),
  ('11111111-1111-4111-8111-111111111111', 'ziaire williams', 'c79a45b2-a541-5986-8d85-81674671709f'),
  ('11111111-1111-4111-8111-111111111111', 'zion williamson', 'd1f207e5-1b45-5b13-8672-2291f682bdd9'),
  ('11111111-1111-4111-8111-111111111111', 'zubac', '26591069-ddf4-54be-9bce-ef51ff6141a7');

insert into public.daily_challenges (id, challenge_date, category_version_id, is_active)
values ('22222222-2222-4222-8222-222222222222', '2026-07-17'::date, '11111111-1111-4111-8111-111111111111', true);
-- END GENERATED NBA SEED
