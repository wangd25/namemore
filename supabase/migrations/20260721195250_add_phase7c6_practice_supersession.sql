create table private.category_publication_correction_requests (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null unique
    references private.category_answer_bank_publications(id) on delete restrict,
  requested_by_user_id uuid not null references auth.users(id) on delete restrict,
  reason_snapshot text not null check (
    char_length(reason_snapshot) between 12 and 1000
    and reason_snapshot = regexp_replace(btrim(reason_snapshot), '[[:space:]]+', ' ', 'g')
    and reason_snapshot !~ '[[:cntrl:]]'
  ),
  requested_at timestamptz not null default statement_timestamp(),
  competitive_eligible boolean not null default false check (not competitive_eligible)
);

alter table private.category_answer_bank_versions
  add column publication_correction_request_id uuid
    references private.category_publication_correction_requests(id) on delete restrict;

alter table private.category_answer_bank_publications
  drop constraint category_answer_bank_publications_category_draft_id_key,
  drop constraint category_answer_bank_publications_slug_key,
  add column supersedes_publication_id uuid unique
    references private.category_answer_bank_publications(id) on delete restrict,
  add column correction_request_id uuid unique
    references private.category_publication_correction_requests(id) on delete restrict,
  add constraint category_answer_bank_publications_supersession_check check (
    (supersedes_publication_id is null and correction_request_id is null)
    or (supersedes_publication_id is not null and correction_request_id is not null)
  );

create index category_publication_correction_requests_requester_idx
  on private.category_publication_correction_requests (requested_by_user_id, requested_at desc);
create index category_answer_bank_versions_correction_request_idx
  on private.category_answer_bank_versions (publication_correction_request_id)
  where publication_correction_request_id is not null;
create index category_answer_bank_publications_draft_time_idx
  on private.category_answer_bank_publications (category_draft_id, published_at desc);
create index category_answer_bank_publications_slug_time_idx
  on private.category_answer_bank_publications (slug, published_at desc);

alter table private.category_publication_correction_requests enable row level security;
revoke all on table private.category_publication_correction_requests from public, anon, authenticated;

create function private.category_publication_payload(p_publication_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'publicationId', publication.id,
    'draftId', publication.category_draft_id,
    'bankRevision', bank.revision,
    'slug', publication.slug,
    'title', publication.title_snapshot,
    'prompt', draft.prompt,
    'summary', publication.summary_snapshot,
    'coverageNote', publication.coverage_note_snapshot,
    'categoryVersion', category.version,
    'snapshotDate', category.snapshot_date,
    'timeLimitSeconds', category.time_limit_seconds,
    'sourceLabel', bank.source_label,
    'sourceUrl', bank.source_url,
    'versionNote', bank.version_note,
    'answerCount', jsonb_array_length(publication.answers_snapshot),
    'acceptedNameCount', coalesce((
      select sum(1 + jsonb_array_length(answer.value -> 'aliases'))::integer
      from jsonb_array_elements(publication.answers_snapshot) as answer(value)
    ), 0),
    'publishedAt', publication.published_at,
    'current', exists (
      select 1
      from private.category_discovery_items as item
      where item.slug = publication.slug
        and item.category_version_id = publication.category_version_id
    ),
    'supersedesPublicationId', publication.supersedes_publication_id,
    'supersededByPublicationId', successor.id,
    'availability', publication.availability,
    'competitiveEligible', publication.competitive_eligible,
    'correctionRequest', case when correction.id is null then null else jsonb_build_object(
      'requestId', correction.id,
      'reason', correction.reason_snapshot,
      'requestedAt', correction.requested_at,
      'revisionStarted', exists (
        select 1
        from private.category_answer_bank_versions as correction_version
        where correction_version.publication_correction_request_id = correction.id
      ),
      'successorPublished', successor.id is not null
    ) end
  )
  from private.category_answer_bank_publications as publication
  join private.category_drafts as draft on draft.id = publication.category_draft_id
  join private.category_answer_bank_versions as bank on bank.id = publication.bank_version_id
  join private.category_versions as category on category.id = publication.category_version_id
  left join private.category_publication_correction_requests as correction
    on correction.publication_id = publication.id
  left join private.category_answer_bank_publications as successor
    on successor.supersedes_publication_id = publication.id
  where publication.id = p_publication_id;
$$;

create or replace function public.category_publication_queue()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  v_now timestamptz := statement_timestamp();
  queue_payload jsonb;
  releases_payload jsonb;
begin
  if current_user_id is null then
    raise insufficient_privilege using message = 'Authentication required.';
  end if;
  if not exists (
    select 1 from private.category_publishers as publisher
    where publisher.user_id = current_user_id and publisher.active
  ) then
    raise insufficient_privilege using message = 'Publisher authorization required.';
  end if;

  select coalesce(
    jsonb_agg(private.category_bank_payload(queued.id) order by queued.updated_at asc, queued.id asc),
    '[]'::jsonb
  ) into queue_payload
  from (
    select version.id, version.updated_at
    from private.category_answer_bank_versions as version
    join private.category_drafts as draft on draft.id = version.category_draft_id
    join private.category_answer_bank_reviews as review on review.bank_version_id = version.id
    left join private.category_answer_bank_publications as publication on publication.bank_version_id = version.id
    where version.status = 'review-ready'
      and version.bank_review_status = 'approved'
      and review.decision = 'approve'
      and publication.id is null
      and draft.user_id <> current_user_id
      and version.editor_user_id <> current_user_id
      and review.reviewer_user_id <> current_user_id
    order by version.updated_at asc, version.id asc
    limit 50
  ) as queued;

  select coalesce(
    jsonb_agg(private.category_publication_payload(publication.id)
      order by (item.category_version_id = publication.category_version_id) desc,
        publication.published_at desc, publication.id desc),
    '[]'::jsonb
  ) into releases_payload
  from private.category_answer_bank_publications as publication
  left join private.category_discovery_items as item on item.slug = publication.slug;

  return jsonb_build_object(
    'serverNow', v_now,
    'authorized', true,
    'banks', queue_payload,
    'releases', releases_payload
  );
end;
$$;

create function public.category_publication_request_correction(
  p_publication_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  v_now timestamptz := statement_timestamp();
  normalized_reason text;
  selected_publication private.category_answer_bank_publications%rowtype;
  selected_draft private.category_drafts%rowtype;
  selected_bank private.category_answer_bank_versions%rowtype;
  selected_review private.category_answer_bank_reviews%rowtype;
begin
  if current_user_id is null then
    raise insufficient_privilege using message = 'Authentication required.';
  end if;
  if not exists (
    select 1 from private.category_publishers as publisher
    where publisher.user_id = current_user_id and publisher.active
  ) then
    raise insufficient_privilege using message = 'Publisher authorization required.';
  end if;
  if p_publication_id is null or p_reason is null or p_reason ~ '[[:cntrl:]]' then
    raise invalid_parameter_value using message = 'Invalid publication correction request.';
  end if;
  normalized_reason := regexp_replace(btrim(p_reason), '[[:space:]]+', ' ', 'g');
  if char_length(normalized_reason) not between 12 and 1000 then
    raise invalid_parameter_value using message = 'Invalid publication correction request.';
  end if;

  select publication.* into selected_publication
  from private.category_answer_bank_publications as publication
  join private.category_discovery_items as item
    on item.slug = publication.slug and item.category_version_id = publication.category_version_id
  where publication.id = p_publication_id
  for update of publication;
  if selected_publication.id is null then
    raise object_not_in_prerequisite_state using message = 'Only the current practice release can receive a correction request.';
  end if;

  select draft.* into selected_draft
  from private.category_drafts as draft
  where draft.id = selected_publication.category_draft_id;
  select bank.* into selected_bank
  from private.category_answer_bank_versions as bank
  where bank.id = selected_publication.bank_version_id;
  select review.* into selected_review
  from private.category_answer_bank_reviews as review
  where review.bank_version_id = selected_publication.bank_version_id;
  if selected_draft.user_id = current_user_id
    or selected_bank.editor_user_id = current_user_id
    or selected_review.reviewer_user_id = current_user_id
  then
    raise insufficient_privilege using message = 'Independent publisher authority required.';
  end if;
  if exists (
    select 1 from private.category_publication_correction_requests as correction
    where correction.publication_id = selected_publication.id
  ) or exists (
    select 1 from private.category_answer_bank_publications as successor
    where successor.supersedes_publication_id = selected_publication.id
  ) then
    raise object_not_in_prerequisite_state using message = 'A correction already exists for this release.';
  end if;

  insert into private.category_publication_correction_requests (
    publication_id, requested_by_user_id, reason_snapshot, requested_at
  ) values (
    selected_publication.id, current_user_id, normalized_reason, v_now
  );
  return private.category_publication_payload(selected_publication.id);
end;
$$;

create or replace function public.category_bank_queue()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  v_now timestamptz := statement_timestamp();
  queue_payload jsonb;
begin
  if current_user_id is null then raise insufficient_privilege using message = 'Authentication required.'; end if;
  if not exists (
    select 1 from private.category_reviewers as reviewer
    where reviewer.user_id = current_user_id and reviewer.active
  ) then raise insufficient_privilege using message = 'Reviewer authorization required.'; end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'draftId', queued.id,
      'prompt', queued.prompt,
      'sourceNotes', queued.source_notes,
      'coverageNotes', queued.coverage_notes,
      'revision', coalesce(queued.revision, 0),
      'status', coalesce(queued.bank_status, 'not-started'),
      'available', case
        when queued.version_id is null then true
        when queued.bank_status = 'editing' then queued.editor_user_id = current_user_id
        when queued.bank_review_status = 'changes-requested' then queued.editor_user_id = current_user_id
        when queued.bank_review_status = 'approved' and queued.correction_request_id is not null
          then queued.editor_user_id = current_user_id and queued.successor_id is null
        else false
      end,
      'publicationCorrection', case when queued.correction_request_id is null then null else jsonb_build_object(
        'requestId', queued.correction_request_id,
        'publicationId', queued.publication_id,
        'slug', queued.publication_slug,
        'categoryVersion', queued.category_version,
        'reason', queued.correction_reason,
        'requestedAt', queued.correction_requested_at
      ) end,
      'bank', case
        when queued.version_id is not null
          and (queued.bank_status = 'review-ready' or queued.editor_user_id = current_user_id)
        then private.category_bank_payload(queued.version_id)
        else null
      end
    ) order by queued.prompt, queued.id
  ), '[]'::jsonb) into queue_payload
  from (
    select
      draft.*,
      latest.id as version_id,
      latest.revision,
      latest.status as bank_status,
      latest.bank_review_status,
      latest.editor_user_id,
      publication.id as publication_id,
      publication.slug as publication_slug,
      category.version as category_version,
      correction.id as correction_request_id,
      correction.reason_snapshot as correction_reason,
      correction.requested_at as correction_requested_at,
      successor.id as successor_id
    from private.category_drafts as draft
    left join lateral (
      select version.*
      from private.category_answer_bank_versions as version
      where version.category_draft_id = draft.id
      order by version.revision desc
      limit 1
    ) as latest on true
    left join private.category_answer_bank_publications as publication
      on publication.category_draft_id = draft.id
    left join private.category_discovery_items as item
      on item.slug = publication.slug and item.category_version_id = publication.category_version_id
    left join private.category_versions as category on category.id = publication.category_version_id
    left join private.category_publication_correction_requests as correction
      on correction.publication_id = publication.id
    left join private.category_answer_bank_publications as successor
      on successor.supersedes_publication_id = publication.id
    where draft.status = 'review-complete'
      and draft.review_status = 'scope-approved'
      and draft.user_id <> current_user_id
      and (publication.id is null or item.category_version_id is not null)
    order by draft.prompt, draft.id
    limit 50
  ) as queued;

  return jsonb_build_object('serverNow', v_now, 'authorized', true, 'drafts', queue_payload);
end;
$$;

create or replace function public.category_bank_start_revision(p_draft_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  source_version private.category_answer_bank_versions%rowtype;
  next_version private.category_answer_bank_versions%rowtype;
  correction_request_id uuid;
begin
  if current_user_id is null then raise insufficient_privilege using message = 'Authentication required.'; end if;
  if not exists (
    select 1 from private.category_reviewers as reviewer
    where reviewer.user_id = current_user_id and reviewer.active
  ) then raise insufficient_privilege using message = 'Reviewer authorization required.'; end if;
  select version.* into source_version
  from private.category_answer_bank_versions as version
  join private.category_drafts as draft on draft.id = version.category_draft_id
  where version.category_draft_id = p_draft_id and draft.user_id <> current_user_id
  order by version.revision desc
  limit 1
  for update of version;
  if source_version.id is null then raise invalid_parameter_value using message = 'Invalid category bank.'; end if;

  if source_version.status = 'review-ready'
    and source_version.bank_review_status = 'changes-requested'
    and source_version.editor_user_id = current_user_id
  then
    correction_request_id := source_version.publication_correction_request_id;
  elsif source_version.status = 'review-ready'
    and source_version.bank_review_status = 'approved'
    and source_version.editor_user_id = current_user_id
  then
    select correction.id into correction_request_id
    from private.category_answer_bank_publications as publication
    join private.category_discovery_items as item
      on item.slug = publication.slug and item.category_version_id = publication.category_version_id
    join private.category_publication_correction_requests as correction
      on correction.publication_id = publication.id
    left join private.category_answer_bank_publications as successor
      on successor.supersedes_publication_id = publication.id
    where publication.bank_version_id = source_version.id and successor.id is null
    for share of correction;
    if correction_request_id is null then
      raise object_not_in_prerequisite_state using message = 'A correction revision is not available.';
    end if;
  else
    raise object_not_in_prerequisite_state using message = 'A correction revision is not available.';
  end if;

  insert into private.category_answer_bank_versions (
    category_draft_id, revision, editor_user_id, snapshot_date, time_limit_seconds,
    source_label, source_url, version_note, publication_correction_request_id
  ) values (
    source_version.category_draft_id, source_version.revision + 1, current_user_id,
    source_version.snapshot_date, source_version.time_limit_seconds,
    source_version.source_label, source_version.source_url, source_version.version_note,
    correction_request_id
  ) returning * into next_version;

  insert into private.category_answer_bank_answers (
    id, bank_version_id, stable_id, canonical_text, normalized_text, sort_order
  ) select gen_random_uuid(), next_version.id, answer.stable_id, answer.canonical_text,
      answer.normalized_text, answer.sort_order
    from private.category_answer_bank_answers as answer
    where answer.bank_version_id = source_version.id;

  insert into private.category_answer_bank_aliases (
    bank_version_id, answer_id, alias_text, normalized_alias
  ) select next_version.id, next_answer.id, alias.alias_text, alias.normalized_alias
    from private.category_answer_bank_aliases as alias
    join private.category_answer_bank_answers as source_answer
      on source_answer.bank_version_id = source_version.id and source_answer.id = alias.answer_id
    join private.category_answer_bank_answers as next_answer
      on next_answer.bank_version_id = next_version.id and next_answer.stable_id = source_answer.stable_id;

  return private.category_bank_payload(next_version.id);
end;
$$;

create or replace function public.category_publish_approved_bank(
  p_draft_id uuid,
  p_slug text,
  p_title text,
  p_summary text,
  p_coverage_note text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  v_now timestamptz := statement_timestamp();
  normalized_slug text;
  normalized_title text;
  normalized_summary text;
  normalized_coverage_note text;
  selected_draft private.category_drafts%rowtype;
  selected_version private.category_answer_bank_versions%rowtype;
  selected_review private.category_answer_bank_reviews%rowtype;
  current_publication private.category_answer_bank_publications%rowtype;
  current_category private.category_versions%rowtype;
  correction_request private.category_publication_correction_requests%rowtype;
  created_category_version_id uuid := gen_random_uuid();
  created_publication_id uuid;
  next_sort_order integer;
  next_category_version integer;
  answer_count integer;
  accepted_name_count integer;
begin
  if current_user_id is null then raise insufficient_privilege using message = 'Authentication required.'; end if;
  if not exists (
    select 1 from private.category_publishers as publisher
    where publisher.user_id = current_user_id and publisher.active
  ) then raise insufficient_privilege using message = 'Publisher authorization required.'; end if;
  if p_draft_id is null or p_slug is null or p_title is null or p_summary is null or p_coverage_note is null
    or p_slug ~ '[[:cntrl:]]' or p_title ~ '[[:cntrl:]]'
    or p_summary ~ '[[:cntrl:]]' or p_coverage_note ~ '[[:cntrl:]]'
  then raise invalid_parameter_value using message = 'Invalid category publication.'; end if;

  normalized_slug := lower(btrim(p_slug));
  normalized_title := regexp_replace(btrim(p_title), '[[:space:]]+', ' ', 'g');
  normalized_summary := regexp_replace(btrim(p_summary), '[[:space:]]+', ' ', 'g');
  normalized_coverage_note := regexp_replace(btrim(p_coverage_note), '[[:space:]]+', ' ', 'g');
  if char_length(normalized_slug) not between 3 and 80
    or normalized_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    or char_length(normalized_title) not between 2 and 120
    or char_length(normalized_summary) not between 8 and 240
    or char_length(normalized_coverage_note) not between 8 and 300
  then raise invalid_parameter_value using message = 'Invalid category publication.'; end if;

  select draft.* into selected_draft
  from private.category_drafts as draft
  where draft.id = p_draft_id
  for update;
  if selected_draft.id is null then raise invalid_parameter_value using message = 'Invalid category publication.'; end if;

  select version.* into selected_version
  from private.category_answer_bank_versions as version
  where version.category_draft_id = selected_draft.id
  order by version.revision desc
  limit 1
  for update;
  if selected_version.id is null
    or selected_version.status <> 'review-ready'
    or selected_version.bank_review_status <> 'approved'
    or selected_draft.user_id = current_user_id
    or selected_version.editor_user_id = current_user_id
  then raise object_not_in_prerequisite_state using message = 'Approved bank is not publishable.'; end if;

  select review.* into selected_review
  from private.category_answer_bank_reviews as review
  where review.bank_version_id = selected_version.id
  for share;
  if selected_review.id is null or selected_review.decision <> 'approve'
    or selected_review.reviewer_user_id = current_user_id
  then raise object_not_in_prerequisite_state using message = 'Approved bank is not independently publishable.'; end if;
  if exists (
    select 1 from private.category_answer_bank_publications as publication
    where publication.bank_version_id = selected_version.id
  ) then raise object_not_in_prerequisite_state using message = 'Category bank is already published.'; end if;

  select publication.* into current_publication
  from private.category_answer_bank_publications as publication
  join private.category_discovery_items as item
    on item.slug = publication.slug and item.category_version_id = publication.category_version_id
  where publication.category_draft_id = selected_draft.id
  for update of publication;

  if current_publication.id is null then
    if selected_version.publication_correction_request_id is not null or exists (
      select 1 from private.category_answer_bank_publications as publication
      where publication.category_draft_id = selected_draft.id
    ) then raise object_not_in_prerequisite_state using message = 'Published history cannot be replaced.'; end if;
    lock table private.category_discovery_items in share row exclusive mode;
    if exists (
      select 1 from private.category_versions as category where category.slug = normalized_slug
    ) or exists (
      select 1 from private.category_discovery_items as item where item.slug = normalized_slug
    ) then raise unique_violation using message = 'Category slug is already in use.'; end if;
    select coalesce(max(item.sort_order), -1) + 1 into next_sort_order
    from private.category_discovery_items as item;
    next_category_version := 1;
  else
    if normalized_slug <> current_publication.slug
      or selected_version.publication_correction_request_id is null
    then raise object_not_in_prerequisite_state using message = 'Published corrections must preserve the practice URL.'; end if;
    select correction.* into correction_request
    from private.category_publication_correction_requests as correction
    where correction.id = selected_version.publication_correction_request_id
      and correction.publication_id = current_publication.id
    for share;
    if correction_request.id is null or exists (
      select 1 from private.category_answer_bank_publications as successor
      where successor.supersedes_publication_id = current_publication.id
    ) then raise object_not_in_prerequisite_state using message = 'Approved correction is not publishable.'; end if;
    select category.* into current_category
    from private.category_versions as category
    where category.id = current_publication.category_version_id
    for share;
    next_category_version := current_category.version + 1;
  end if;

  select count(*)::integer into answer_count
  from private.category_answer_bank_answers as answer
  where answer.bank_version_id = selected_version.id;
  select answer_count + count(*)::integer into accepted_name_count
  from private.category_answer_bank_aliases as alias
  where alias.bank_version_id = selected_version.id;
  if answer_count < 2 then raise object_not_in_prerequisite_state using message = 'Approved bank has no publishable answers.'; end if;

  insert into private.category_versions (
    id, slug, version, snapshot_date, title, prompt, time_limit_seconds
  ) values (
    created_category_version_id, normalized_slug, next_category_version, selected_version.snapshot_date,
    normalized_title, selected_draft.prompt, selected_version.time_limit_seconds
  );

  insert into private.category_answers (
    id, category_version_id, stable_id, canonical_text, team_code, sort_order, visual_label, group_ids
  ) select gen_random_uuid(), created_category_version_id, answer.stable_id,
      answer.canonical_text, null, answer.sort_order, null, '{}'::text[]
    from private.category_answer_bank_answers as answer
    where answer.bank_version_id = selected_version.id
    order by answer.sort_order;

  insert into private.category_answer_aliases (category_version_id, normalized_alias, answer_id)
  select created_category_version_id, bank_answer.normalized_text, published_answer.id
  from private.category_answer_bank_answers as bank_answer
  join private.category_answers as published_answer
    on published_answer.category_version_id = created_category_version_id
    and published_answer.stable_id = bank_answer.stable_id
  where bank_answer.bank_version_id = selected_version.id;

  insert into private.category_answer_aliases (category_version_id, normalized_alias, answer_id)
  select created_category_version_id, bank_alias.normalized_alias, published_answer.id
  from private.category_answer_bank_aliases as bank_alias
  join private.category_answer_bank_answers as bank_answer
    on bank_answer.bank_version_id = bank_alias.bank_version_id and bank_answer.id = bank_alias.answer_id
  join private.category_answers as published_answer
    on published_answer.category_version_id = created_category_version_id
    and published_answer.stable_id = bank_answer.stable_id
  where bank_alias.bank_version_id = selected_version.id;

  if current_publication.id is null then
    insert into private.category_discovery_items (
      slug, category_version_id, title, prompt, summary, review_status, availability,
      competitive_eligible, source_label, coverage_note, sort_order
    ) values (
      normalized_slug, created_category_version_id, normalized_title, selected_draft.prompt,
      normalized_summary, 'reviewed', 'practice', false, selected_version.source_label,
      normalized_coverage_note, next_sort_order
    );
  else
    update private.category_discovery_items as item set
      category_version_id = created_category_version_id,
      title = normalized_title,
      prompt = selected_draft.prompt,
      summary = normalized_summary,
      review_status = 'reviewed',
      availability = 'practice',
      competitive_eligible = false,
      source_label = selected_version.source_label,
      coverage_note = normalized_coverage_note
    where item.slug = current_publication.slug
      and item.category_version_id = current_publication.category_version_id;
    if not found then raise object_not_in_prerequisite_state using message = 'Current practice release changed.'; end if;
  end if;

  insert into private.category_answer_bank_publications (
    category_draft_id, bank_version_id, category_version_id, publisher_user_id,
    slug, title_snapshot, summary_snapshot, coverage_note_snapshot, answers_snapshot,
    published_at, supersedes_publication_id, correction_request_id
  ) values (
    selected_draft.id, selected_version.id, created_category_version_id, current_user_id,
    normalized_slug, normalized_title, normalized_summary, normalized_coverage_note,
    private.category_bank_payload(selected_version.id) -> 'answers', v_now,
    current_publication.id, correction_request.id
  ) returning id into created_publication_id;

  return jsonb_build_object(
    'publicationId', created_publication_id,
    'draftId', selected_draft.id,
    'bankRevision', selected_version.revision,
    'slug', normalized_slug,
    'categoryVersion', next_category_version,
    'answerCount', answer_count,
    'acceptedNameCount', accepted_name_count,
    'publishedAt', v_now,
    'supersededPublicationId', current_publication.id,
    'availability', 'practice',
    'competitiveEligible', false
  );
end;
$$;

revoke all on function private.category_publication_payload(uuid) from public, anon, authenticated;
revoke all on function public.category_publication_request_correction(uuid, text) from public, anon, authenticated;
revoke all on function public.category_publication_queue() from public, anon, authenticated;
revoke all on function public.category_bank_queue() from public, anon, authenticated;
revoke all on function public.category_bank_start_revision(uuid) from public, anon, authenticated;
revoke all on function public.category_publish_approved_bank(uuid, text, text, text, text) from public, anon, authenticated;

grant execute on function public.category_publication_request_correction(uuid, text) to authenticated;
grant execute on function public.category_publication_queue() to authenticated;
grant execute on function public.category_bank_queue() to authenticated;
grant execute on function public.category_bank_start_revision(uuid) to authenticated;
grant execute on function public.category_publish_approved_bank(uuid, text, text, text, text) to authenticated;
