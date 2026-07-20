alter table private.category_answers
  alter column team_code drop not null,
  add column visual_label text check (
    visual_label is null or (
      char_length(visual_label) between 1 and 12
      and visual_label = btrim(visual_label)
      and visual_label !~ '[[:cntrl:]]'
    )
  ),
  add column group_ids text[] not null default '{}'::text[] check (
    cardinality(group_ids) <= 8
    and array_position(group_ids, null) is null
  );

update private.category_answers
set
  visual_label = team_code,
  group_ids = array[team_code]
where team_code is not null;

alter table private.category_discovery_items
  drop constraint category_discovery_items_availability_check,
  add constraint category_discovery_items_availability_check
    check (availability in ('daily', 'practice', 'practice-planned'));

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
  '33333333-3333-4333-8333-333333333333',
  'chemical-elements',
  1,
  '2022-05-04'::date,
  'Chemical elements',
  'How many chemical elements can you name?',
  90
);

create temporary table phase7b_elements (
  atomic_number integer primary key,
  symbol text not null unique,
  canonical_text text not null unique,
  period integer not null check (period between 1 and 7),
  alternate_names text[] not null
) on commit drop;

insert into phase7b_elements (
  atomic_number,
  symbol,
  canonical_text,
  period,
  alternate_names
)
values
  (1, 'H', 'Hydrogen', 1, array[]::text[]),
  (2, 'He', 'Helium', 1, array[]::text[]),
  (3, 'Li', 'Lithium', 2, array[]::text[]),
  (4, 'Be', 'Beryllium', 2, array[]::text[]),
  (5, 'B', 'Boron', 2, array[]::text[]),
  (6, 'C', 'Carbon', 2, array[]::text[]),
  (7, 'N', 'Nitrogen', 2, array[]::text[]),
  (8, 'O', 'Oxygen', 2, array[]::text[]),
  (9, 'F', 'Fluorine', 2, array[]::text[]),
  (10, 'Ne', 'Neon', 2, array[]::text[]),
  (11, 'Na', 'Sodium', 3, array[]::text[]),
  (12, 'Mg', 'Magnesium', 3, array[]::text[]),
  (13, 'Al', 'Aluminium', 3, array['Aluminum']::text[]),
  (14, 'Si', 'Silicon', 3, array[]::text[]),
  (15, 'P', 'Phosphorus', 3, array[]::text[]),
  (16, 'S', 'Sulfur', 3, array['Sulphur']::text[]),
  (17, 'Cl', 'Chlorine', 3, array[]::text[]),
  (18, 'Ar', 'Argon', 3, array[]::text[]),
  (19, 'K', 'Potassium', 4, array[]::text[]),
  (20, 'Ca', 'Calcium', 4, array[]::text[]),
  (21, 'Sc', 'Scandium', 4, array[]::text[]),
  (22, 'Ti', 'Titanium', 4, array[]::text[]),
  (23, 'V', 'Vanadium', 4, array[]::text[]),
  (24, 'Cr', 'Chromium', 4, array[]::text[]),
  (25, 'Mn', 'Manganese', 4, array[]::text[]),
  (26, 'Fe', 'Iron', 4, array[]::text[]),
  (27, 'Co', 'Cobalt', 4, array[]::text[]),
  (28, 'Ni', 'Nickel', 4, array[]::text[]),
  (29, 'Cu', 'Copper', 4, array[]::text[]),
  (30, 'Zn', 'Zinc', 4, array[]::text[]),
  (31, 'Ga', 'Gallium', 4, array[]::text[]),
  (32, 'Ge', 'Germanium', 4, array[]::text[]),
  (33, 'As', 'Arsenic', 4, array[]::text[]),
  (34, 'Se', 'Selenium', 4, array[]::text[]),
  (35, 'Br', 'Bromine', 4, array[]::text[]),
  (36, 'Kr', 'Krypton', 4, array[]::text[]),
  (37, 'Rb', 'Rubidium', 5, array[]::text[]),
  (38, 'Sr', 'Strontium', 5, array[]::text[]),
  (39, 'Y', 'Yttrium', 5, array[]::text[]),
  (40, 'Zr', 'Zirconium', 5, array[]::text[]),
  (41, 'Nb', 'Niobium', 5, array[]::text[]),
  (42, 'Mo', 'Molybdenum', 5, array[]::text[]),
  (43, 'Tc', 'Technetium', 5, array[]::text[]),
  (44, 'Ru', 'Ruthenium', 5, array[]::text[]),
  (45, 'Rh', 'Rhodium', 5, array[]::text[]),
  (46, 'Pd', 'Palladium', 5, array[]::text[]),
  (47, 'Ag', 'Silver', 5, array[]::text[]),
  (48, 'Cd', 'Cadmium', 5, array[]::text[]),
  (49, 'In', 'Indium', 5, array[]::text[]),
  (50, 'Sn', 'Tin', 5, array[]::text[]),
  (51, 'Sb', 'Antimony', 5, array[]::text[]),
  (52, 'Te', 'Tellurium', 5, array[]::text[]),
  (53, 'I', 'Iodine', 5, array[]::text[]),
  (54, 'Xe', 'Xenon', 5, array[]::text[]),
  (55, 'Cs', 'Caesium', 6, array['Cesium']::text[]),
  (56, 'Ba', 'Barium', 6, array[]::text[]),
  (57, 'La', 'Lanthanum', 6, array[]::text[]),
  (58, 'Ce', 'Cerium', 6, array[]::text[]),
  (59, 'Pr', 'Praseodymium', 6, array[]::text[]),
  (60, 'Nd', 'Neodymium', 6, array[]::text[]),
  (61, 'Pm', 'Promethium', 6, array[]::text[]),
  (62, 'Sm', 'Samarium', 6, array[]::text[]),
  (63, 'Eu', 'Europium', 6, array[]::text[]),
  (64, 'Gd', 'Gadolinium', 6, array[]::text[]),
  (65, 'Tb', 'Terbium', 6, array[]::text[]),
  (66, 'Dy', 'Dysprosium', 6, array[]::text[]),
  (67, 'Ho', 'Holmium', 6, array[]::text[]),
  (68, 'Er', 'Erbium', 6, array[]::text[]),
  (69, 'Tm', 'Thulium', 6, array[]::text[]),
  (70, 'Yb', 'Ytterbium', 6, array[]::text[]),
  (71, 'Lu', 'Lutetium', 6, array[]::text[]),
  (72, 'Hf', 'Hafnium', 6, array[]::text[]),
  (73, 'Ta', 'Tantalum', 6, array[]::text[]),
  (74, 'W', 'Tungsten', 6, array['Wolfram']::text[]),
  (75, 'Re', 'Rhenium', 6, array[]::text[]),
  (76, 'Os', 'Osmium', 6, array[]::text[]),
  (77, 'Ir', 'Iridium', 6, array[]::text[]),
  (78, 'Pt', 'Platinum', 6, array[]::text[]),
  (79, 'Au', 'Gold', 6, array[]::text[]),
  (80, 'Hg', 'Mercury', 6, array[]::text[]),
  (81, 'Tl', 'Thallium', 6, array[]::text[]),
  (82, 'Pb', 'Lead', 6, array[]::text[]),
  (83, 'Bi', 'Bismuth', 6, array[]::text[]),
  (84, 'Po', 'Polonium', 6, array[]::text[]),
  (85, 'At', 'Astatine', 6, array[]::text[]),
  (86, 'Rn', 'Radon', 6, array[]::text[]),
  (87, 'Fr', 'Francium', 7, array[]::text[]),
  (88, 'Ra', 'Radium', 7, array[]::text[]),
  (89, 'Ac', 'Actinium', 7, array[]::text[]),
  (90, 'Th', 'Thorium', 7, array[]::text[]),
  (91, 'Pa', 'Protactinium', 7, array[]::text[]),
  (92, 'U', 'Uranium', 7, array[]::text[]),
  (93, 'Np', 'Neptunium', 7, array[]::text[]),
  (94, 'Pu', 'Plutonium', 7, array[]::text[]),
  (95, 'Am', 'Americium', 7, array[]::text[]),
  (96, 'Cm', 'Curium', 7, array[]::text[]),
  (97, 'Bk', 'Berkelium', 7, array[]::text[]),
  (98, 'Cf', 'Californium', 7, array[]::text[]),
  (99, 'Es', 'Einsteinium', 7, array[]::text[]),
  (100, 'Fm', 'Fermium', 7, array[]::text[]),
  (101, 'Md', 'Mendelevium', 7, array[]::text[]),
  (102, 'No', 'Nobelium', 7, array[]::text[]),
  (103, 'Lr', 'Lawrencium', 7, array[]::text[]),
  (104, 'Rf', 'Rutherfordium', 7, array[]::text[]),
  (105, 'Db', 'Dubnium', 7, array[]::text[]),
  (106, 'Sg', 'Seaborgium', 7, array[]::text[]),
  (107, 'Bh', 'Bohrium', 7, array[]::text[]),
  (108, 'Hs', 'Hassium', 7, array[]::text[]),
  (109, 'Mt', 'Meitnerium', 7, array[]::text[]),
  (110, 'Ds', 'Darmstadtium', 7, array[]::text[]),
  (111, 'Rg', 'Roentgenium', 7, array[]::text[]),
  (112, 'Cn', 'Copernicium', 7, array[]::text[]),
  (113, 'Nh', 'Nihonium', 7, array[]::text[]),
  (114, 'Fl', 'Flerovium', 7, array[]::text[]),
  (115, 'Mc', 'Moscovium', 7, array[]::text[]),
  (116, 'Lv', 'Livermorium', 7, array[]::text[]),
  (117, 'Ts', 'Tennessine', 7, array[]::text[]),
  (118, 'Og', 'Oganesson', 7, array[]::text[]);

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
  md5('chemical-elements:1:' || lower(element.canonical_text))::uuid,
  '33333333-3333-4333-8333-333333333333',
  'element-' || lower(element.canonical_text),
  element.canonical_text,
  null,
  element.atomic_number - 1,
  element.symbol,
  array['period-' || element.period::text]
from phase7b_elements as element
order by element.atomic_number;

insert into private.category_answer_aliases (
  category_version_id,
  normalized_alias,
  answer_id
)
select
  '33333333-3333-4333-8333-333333333333',
  lower(alias.value),
  md5('chemical-elements:1:' || lower(element.canonical_text))::uuid
from phase7b_elements as element
cross join lateral unnest(
  array[element.canonical_text, element.symbol] || element.alternate_names
) as alias(value)
order by element.atomic_number, alias.value;

update private.category_discovery_items
set
  category_version_id = '33333333-3333-4333-8333-333333333333',
  summary = 'A reviewed local-practice bank covering every officially named chemical element.',
  review_status = 'reviewed',
  availability = 'practice',
  competitive_eligible = false,
  source_label = 'IUPAC periodic table release dated 2022-05-04',
  coverage_note = 'All 118 named elements are included; symbols plus documented aluminium, caesium, sulfur, and tungsten spelling aliases are accepted.'
where slug = 'chemical-elements';

do $$
begin
  if (
    select count(*)
    from private.category_answers as answer
    where answer.category_version_id = '33333333-3333-4333-8333-333333333333'
  ) <> 118 then
    raise exception 'Expected 118 chemical elements.';
  end if;

  if (
    select count(*)
    from private.category_answer_aliases as alias
    where alias.category_version_id = '33333333-3333-4333-8333-333333333333'
  ) <> 240 then
    raise exception 'Expected 240 chemical element aliases.';
  end if;
end;
$$;
