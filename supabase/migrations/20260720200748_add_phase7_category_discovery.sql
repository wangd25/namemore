create table private.category_discovery_items (
  slug text primary key check (slug ~ '^[a-z0-9-]+$'),
  category_version_id uuid unique references private.category_versions(id) on delete restrict,
  title text not null check (char_length(title) between 2 and 120),
  prompt text not null check (
    char_length(prompt) between 4 and 160
    and prompt = regexp_replace(btrim(prompt), '[[:space:]]+', ' ', 'g')
    and prompt !~ '[[:cntrl:]]'
  ),
  summary text not null check (char_length(summary) between 8 and 240),
  review_status text not null check (review_status in ('reviewed', 'in-review')),
  availability text not null check (availability in ('daily', 'practice-planned')),
  competitive_eligible boolean not null default false,
  source_label text not null check (char_length(source_label) between 3 and 160),
  coverage_note text not null check (char_length(coverage_note) between 8 and 300),
  sort_order integer not null check (sort_order >= 0),
  created_at timestamptz not null default statement_timestamp(),
  unique (sort_order),
  check (
    (review_status = 'reviewed' and category_version_id is not null)
    or (review_status = 'in-review' and category_version_id is null and not competitive_eligible)
  ),
  check (availability <> 'daily' or (review_status = 'reviewed' and competitive_eligible))
);

create table private.category_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  prompt text not null check (
    char_length(prompt) between 4 and 160
    and prompt = regexp_replace(btrim(prompt), '[[:space:]]+', ' ', 'g')
    and prompt !~ '[[:cntrl:]]'
  ),
  source_notes text not null check (
    char_length(source_notes) between 8 and 500
    and source_notes = regexp_replace(btrim(source_notes), '[[:space:]]+', ' ', 'g')
    and source_notes !~ '[[:cntrl:]]'
  ),
  coverage_notes text not null check (
    char_length(coverage_notes) between 8 and 500
    and coverage_notes = regexp_replace(btrim(coverage_notes), '[[:space:]]+', ' ', 'g')
    and coverage_notes !~ '[[:cntrl:]]'
  ),
  status text not null default 'draft' check (status = 'draft'),
  review_status text not null default 'unreviewed' check (review_status = 'unreviewed'),
  competitive_eligible boolean not null default false check (not competitive_eligible),
  created_at timestamptz not null default statement_timestamp()
);

create index category_drafts_user_created_idx
  on private.category_drafts (user_id, created_at desc);

alter table private.category_discovery_items enable row level security;
alter table private.category_drafts enable row level security;

revoke all on table private.category_discovery_items from public, anon, authenticated;
revoke all on table private.category_drafts from public, anon, authenticated;

insert into private.category_discovery_items (
  slug,
  category_version_id,
  title,
  prompt,
  summary,
  review_status,
  availability,
  competitive_eligible,
  source_label,
  coverage_note,
  sort_order
)
values
  (
    'current-nba-players',
    '11111111-1111-4111-8111-111111111111',
    'Current NBA players',
    'How many NBA players can you name?',
    'A versioned snapshot of active NBA rosters for the trusted daily game.',
    'reviewed',
    'daily',
    true,
    'Repository-curated NBA roster snapshot dated 2026-07-15',
    'Ten players per team across all 30 teams; the snapshot is versioned rather than presented as a live roster feed.',
    0
  ),
  (
    'countries-in-europe',
    null,
    'Countries in Europe',
    'How many countries in Europe can you name?',
    'A geographic recall prompt whose borders and inclusion rules must be explicit.',
    'in-review',
    'practice-planned',
    false,
    'Planned review against the United Nations M49 geographic regions',
    'The answer bank is not published until transcontinental states and disputed recognition are documented.',
    1
  ),
  (
    'chemical-elements',
    null,
    'Chemical elements',
    'How many chemical elements can you name?',
    'A finite science category planned around the official periodic table.',
    'in-review',
    'practice-planned',
    false,
    'Planned review against the IUPAC periodic table',
    'Element names, symbols, spellings, and aliases require a versioned bank before public practice.',
    2
  );

create or replace function public.category_discover(p_query text default '')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  v_now timestamptz := statement_timestamp();
  normalized_query text;
  current_challenge_id uuid;
  current_category_title text;
  categories_payload jsonb;
  today_best_payload jsonb;
  popular_category_payload jsonb;
  live_rooms_payload jsonb;
begin
  if current_user_id is null then
    raise insufficient_privilege using message = 'Authentication required.';
  end if;

  if p_query is null or p_query ~ '[[:cntrl:]]' then
    raise invalid_parameter_value using message = 'Invalid category query.';
  end if;

  normalized_query := regexp_replace(btrim(p_query), '[[:space:]]+', ' ', 'g');
  if char_length(normalized_query) > 80 then
    raise invalid_parameter_value using message = 'Invalid category query.';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'slug', item.slug,
        'version', category.version,
        'title', item.title,
        'prompt', item.prompt,
        'summary', item.summary,
        'reviewStatus', item.review_status,
        'availability', item.availability,
        'competitiveEligible', item.competitive_eligible,
        'answerCount', case
          when item.category_version_id is null then null
          else (
            select count(*)::integer
            from private.category_answers as answer
            where answer.category_version_id = item.category_version_id
          )
        end,
        'sourceLabel', item.source_label,
        'coverageNote', item.coverage_note
      )
      order by item.sort_order
    ),
    '[]'::jsonb
  )
    into categories_payload
  from private.category_discovery_items as item
  left join private.category_versions as category
    on category.id = item.category_version_id
  where normalized_query = ''
    or strpos(lower(item.title || ' ' || item.prompt), lower(normalized_query)) > 0;

  select challenge.id, item.title
    into current_challenge_id, current_category_title
  from public.daily_challenges as challenge
  join private.category_discovery_items as item
    on item.category_version_id = challenge.category_version_id
  where challenge.challenge_date = timezone('UTC', v_now)::date
    and challenge.is_active
  limit 1;

  if current_challenge_id is not null then
    select jsonb_build_object(
      'score', best_attempt.verified_score,
      'categoryTitle', current_category_title
    )
      into today_best_payload
    from public.daily_attempts as best_attempt
    where best_attempt.challenge_id = current_challenge_id
      and best_attempt.status in ('completed', 'expired')
      and best_attempt.display_name is not null
    order by
      best_attempt.verified_score desc,
      best_attempt.completed_at asc,
      best_attempt.created_at asc,
      best_attempt.id asc
    limit 1;
  end if;

  select jsonb_build_object(
    'categoryTitle', popular.title,
    'verifiedRoundCount', popular.round_count
  )
    into popular_category_payload
  from (
    select item.title, count(*)::integer as round_count, item.sort_order
    from public.daily_attempts as attempt
    join public.daily_challenges as challenge
      on challenge.id = attempt.challenge_id
    join private.category_discovery_items as item
      on item.category_version_id = challenge.category_version_id
    where attempt.status in ('completed', 'expired')
      and attempt.display_name is not null
    group by item.title, item.sort_order
    having count(*) >= 3
    order by count(*) desc, item.sort_order
    limit 1
  ) as popular;

  select case when count(*) = 0 then null else jsonb_build_object('roomCount', count(*)::integer) end
    into live_rooms_payload
  from public.rooms as room
  where (
      room.status = 'waiting'
      and room.created_at > v_now - interval '2 hours'
    )
    or (
      room.status = 'active'
      and room.deadline_at > v_now
    );

  return jsonb_build_object(
    'serverNow', v_now,
    'categories', categories_payload,
    'ambient', jsonb_build_object(
      'todayBest', today_best_payload,
      'popularCategory', popular_category_payload,
      'liveRooms', live_rooms_payload
    )
  );
end;
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
    coverage_notes
  )
  values (
    current_user_id,
    normalized_prompt,
    normalized_source_notes,
    normalized_coverage_notes
  )
  returning * into created_draft;

  return jsonb_build_object(
    'id', created_draft.id,
    'status', created_draft.status,
    'reviewStatus', created_draft.review_status,
    'competitiveEligible', created_draft.competitive_eligible,
    'createdAt', created_draft.created_at
  );
end;
$$;

revoke all on function public.category_discover(text) from public, anon, authenticated;
revoke all on function public.category_create_draft(text, text, text) from public, anon, authenticated;

grant execute on function public.category_discover(text) to authenticated;
grant execute on function public.category_create_draft(text, text, text) to authenticated;
