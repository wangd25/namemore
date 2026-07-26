insert into private.category_versions (
  id,
  slug,
  version,
  snapshot_date,
  title,
  prompt,
  time_limit_seconds
)
values (
  '44444444-4444-4444-8444-444444444444',
  'us-states',
  1,
  '2026-07-25'::date,
  'U.S. states',
  'How many U.S. states can you name?',
  90
);

create temporary table phase9_us_states (
  sort_order integer primary key,
  canonical_text text not null unique,
  postal_code text not null unique check (postal_code ~ '^[A-Z]{2}$'),
  census_region text not null check (
    census_region in ('northeast', 'midwest', 'south', 'west')
  )
) on commit drop;

insert into phase9_us_states (
  sort_order,
  canonical_text,
  postal_code,
  census_region
)
values
  (0, 'Alabama', 'AL', 'south'),
  (1, 'Alaska', 'AK', 'west'),
  (2, 'Arizona', 'AZ', 'west'),
  (3, 'Arkansas', 'AR', 'south'),
  (4, 'California', 'CA', 'west'),
  (5, 'Colorado', 'CO', 'west'),
  (6, 'Connecticut', 'CT', 'northeast'),
  (7, 'Delaware', 'DE', 'south'),
  (8, 'Florida', 'FL', 'south'),
  (9, 'Georgia', 'GA', 'south'),
  (10, 'Hawaii', 'HI', 'west'),
  (11, 'Idaho', 'ID', 'west'),
  (12, 'Illinois', 'IL', 'midwest'),
  (13, 'Indiana', 'IN', 'midwest'),
  (14, 'Iowa', 'IA', 'midwest'),
  (15, 'Kansas', 'KS', 'midwest'),
  (16, 'Kentucky', 'KY', 'south'),
  (17, 'Louisiana', 'LA', 'south'),
  (18, 'Maine', 'ME', 'northeast'),
  (19, 'Maryland', 'MD', 'south'),
  (20, 'Massachusetts', 'MA', 'northeast'),
  (21, 'Michigan', 'MI', 'midwest'),
  (22, 'Minnesota', 'MN', 'midwest'),
  (23, 'Mississippi', 'MS', 'south'),
  (24, 'Missouri', 'MO', 'midwest'),
  (25, 'Montana', 'MT', 'west'),
  (26, 'Nebraska', 'NE', 'midwest'),
  (27, 'Nevada', 'NV', 'west'),
  (28, 'New Hampshire', 'NH', 'northeast'),
  (29, 'New Jersey', 'NJ', 'northeast'),
  (30, 'New Mexico', 'NM', 'west'),
  (31, 'New York', 'NY', 'northeast'),
  (32, 'North Carolina', 'NC', 'south'),
  (33, 'North Dakota', 'ND', 'midwest'),
  (34, 'Ohio', 'OH', 'midwest'),
  (35, 'Oklahoma', 'OK', 'south'),
  (36, 'Oregon', 'OR', 'west'),
  (37, 'Pennsylvania', 'PA', 'northeast'),
  (38, 'Rhode Island', 'RI', 'northeast'),
  (39, 'South Carolina', 'SC', 'south'),
  (40, 'South Dakota', 'SD', 'midwest'),
  (41, 'Tennessee', 'TN', 'south'),
  (42, 'Texas', 'TX', 'south'),
  (43, 'Utah', 'UT', 'west'),
  (44, 'Vermont', 'VT', 'northeast'),
  (45, 'Virginia', 'VA', 'south'),
  (46, 'Washington', 'WA', 'west'),
  (47, 'West Virginia', 'WV', 'south'),
  (48, 'Wisconsin', 'WI', 'midwest'),
  (49, 'Wyoming', 'WY', 'west');

insert into private.category_answers (
  id,
  category_version_id,
  stable_id,
  canonical_text,
  team_code,
  sort_order,
  visual_label,
  group_ids
)
select
  md5('us-states:1:' || lower(state.canonical_text))::uuid,
  '44444444-4444-4444-8444-444444444444',
  'us-state-' || replace(lower(state.canonical_text), ' ', '-'),
  state.canonical_text,
  null,
  state.sort_order,
  state.postal_code,
  array[state.census_region]
from phase9_us_states as state
order by state.sort_order;

insert into private.category_answer_aliases (
  category_version_id,
  normalized_alias,
  answer_id
)
select
  '44444444-4444-4444-8444-444444444444',
  lower(state.canonical_text),
  md5('us-states:1:' || lower(state.canonical_text))::uuid
from phase9_us_states as state
order by state.sort_order;

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
values (
  'us-states',
  '44444444-4444-4444-8444-444444444444',
  'U.S. states',
  'How many U.S. states can you name?',
  'A reviewed local-practice bank covering the 50 U.S. states.',
  'reviewed',
  'practice',
  false,
  'U.S. Census Bureau regions and divisions, reviewed 2026-07-25',
  'Exactly 50 states are included. Washington, D.C., Puerto Rico, and other U.S. territories are excluded; postal abbreviations are shown but not accepted as answers.',
  3
);

do $$
begin
  if (
    select count(*)
    from private.category_answers as answer
    where answer.category_version_id = '44444444-4444-4444-8444-444444444444'
  ) <> 50 then
    raise exception 'Expected 50 U.S. states.';
  end if;

  if (
    select count(*)
    from private.category_answer_aliases as alias
    where alias.category_version_id = '44444444-4444-4444-8444-444444444444'
  ) <> 50 then
    raise exception 'Expected 50 canonical U.S. state aliases.';
  end if;
end;
$$;
