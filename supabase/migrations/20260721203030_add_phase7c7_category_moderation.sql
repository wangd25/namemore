create table private.category_moderators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active boolean not null default true,
  granted_at timestamptz not null default statement_timestamp()
);

create table private.category_reports (
  id uuid primary key default gen_random_uuid(),
  category_version_id uuid not null references private.category_versions(id) on delete restrict,
  reporter_user_id uuid not null references auth.users(id) on delete cascade,
  category_slug_snapshot text not null check (
    char_length(category_slug_snapshot) between 3 and 80
    and category_slug_snapshot ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  category_title_snapshot text not null check (
    char_length(category_title_snapshot) between 2 and 120
    and category_title_snapshot = regexp_replace(btrim(category_title_snapshot), '[[:space:]]+', ' ', 'g')
    and category_title_snapshot !~ '[[:cntrl:]]'
  ),
  category_version_snapshot integer not null check (category_version_snapshot > 0),
  availability_snapshot text not null check (availability_snapshot in ('daily', 'practice')),
  reason text not null check (
    reason in (
      'answer-bank-accuracy',
      'coverage-or-wording',
      'provenance-or-copyright',
      'offensive-or-unsafe',
      'other'
    )
  ),
  detail_snapshot text not null check (
    char_length(detail_snapshot) between 20 and 800
    and detail_snapshot = regexp_replace(btrim(detail_snapshot), '[[:space:]]+', ' ', 'g')
    and detail_snapshot !~ '[[:cntrl:]]'
  ),
  status text not null default 'pending' check (
    status in ('pending', 'dismissed', 'publisher-review')
  ),
  reported_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  check (updated_at >= reported_at)
);

create table private.category_report_moderation_decisions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null unique references private.category_reports(id) on delete cascade,
  moderator_user_id uuid not null references auth.users(id) on delete restrict,
  outcome text not null check (outcome in ('dismiss', 'publisher-review')),
  decision_note text not null check (
    char_length(decision_note) between 12 and 600
    and decision_note = regexp_replace(btrim(decision_note), '[[:space:]]+', ' ', 'g')
    and decision_note !~ '[[:cntrl:]]'
  ),
  decided_at timestamptz not null default statement_timestamp()
);

create unique index category_reports_one_pending_per_reporter_version_idx
  on private.category_reports (reporter_user_id, category_version_id)
  where status = 'pending';
create index category_reports_reporter_time_idx
  on private.category_reports (reporter_user_id, reported_at desc);
create index category_reports_moderation_queue_idx
  on private.category_reports (status, reported_at asc, id asc);
create index category_reports_category_version_idx
  on private.category_reports (category_version_id, reported_at desc);
create index category_report_decisions_moderator_time_idx
  on private.category_report_moderation_decisions (moderator_user_id, decided_at desc);

alter table private.category_moderators enable row level security;
alter table private.category_reports enable row level security;
alter table private.category_report_moderation_decisions enable row level security;

revoke all on table private.category_moderators from public, anon, authenticated;
revoke all on table private.category_reports from public, anon, authenticated;
revoke all on table private.category_report_moderation_decisions from public, anon, authenticated;

create function private.category_moderation_report_payload(p_report_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'reportId', report.id,
    'categorySlug', report.category_slug_snapshot,
    'categoryTitle', report.category_title_snapshot,
    'categoryVersion', report.category_version_snapshot,
    'availability', report.availability_snapshot,
    'reason', report.reason,
    'detail', report.detail_snapshot,
    'reportedAt', report.reported_at,
    'status', report.status,
    'decision', case when decision.id is null then null else jsonb_build_object(
      'outcome', decision.outcome,
      'note', decision.decision_note,
      'decidedAt', decision.decided_at
    ) end
  )
  from private.category_reports as report
  left join private.category_report_moderation_decisions as decision
    on decision.report_id = report.id
  where report.id = p_report_id;
$$;

create function public.category_moderator_status()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  v_now timestamptz := statement_timestamp();
begin
  if current_user_id is null then
    raise insufficient_privilege using message = 'Authentication required.';
  end if;

  return jsonb_build_object(
    'serverNow', v_now,
    'authorized', exists (
      select 1
      from private.category_moderators as moderator
      where moderator.user_id = current_user_id and moderator.active
    )
  );
end;
$$;

create function public.category_report_create(
  p_slug text,
  p_reason text,
  p_detail text
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
  normalized_detail text;
  selected_item private.category_discovery_items%rowtype;
  selected_category private.category_versions%rowtype;
  created_report private.category_reports%rowtype;
begin
  if current_user_id is null then
    raise insufficient_privilege using message = 'Authentication required.';
  end if;

  normalized_slug := lower(btrim(coalesce(p_slug, '')));
  normalized_detail := regexp_replace(btrim(coalesce(p_detail, '')), '[[:space:]]+', ' ', 'g');

  if normalized_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    or char_length(normalized_slug) not between 3 and 80
    or p_reason is null
    or p_reason not in (
      'answer-bank-accuracy',
      'coverage-or-wording',
      'provenance-or-copyright',
      'offensive-or-unsafe',
      'other'
    )
    or p_detail is null
    or p_detail ~ '[[:cntrl:]]'
    or char_length(normalized_detail) not between 20 and 800
  then
    raise invalid_parameter_value using message = 'Invalid category report.';
  end if;

  select item.* into selected_item
  from private.category_discovery_items as item
  where item.slug = normalized_slug
    and item.review_status = 'reviewed'
    and item.category_version_id is not null
    and item.availability in ('daily', 'practice');
  if not found then
    raise invalid_parameter_value using message = 'Reviewed category not found.';
  end if;

  select category.* into selected_category
  from private.category_versions as category
  where category.id = selected_item.category_version_id;
  if not found then
    raise object_not_in_prerequisite_state using message = 'Category version unavailable.';
  end if;

  if (
    select count(*)
    from private.category_reports as recent_report
    where recent_report.reporter_user_id = current_user_id
      and recent_report.reported_at > v_now - interval '24 hours'
  ) >= 5 then
    raise program_limit_exceeded using message = 'Category report limit reached.';
  end if;

  if exists (
    select 1
    from private.category_reports as pending_report
    where pending_report.reporter_user_id = current_user_id
      and pending_report.category_version_id = selected_item.category_version_id
      and pending_report.status = 'pending'
  ) then
    raise unique_violation using message = 'A report is already pending for this category version.';
  end if;

  insert into private.category_reports (
    category_version_id,
    reporter_user_id,
    category_slug_snapshot,
    category_title_snapshot,
    category_version_snapshot,
    availability_snapshot,
    reason,
    detail_snapshot,
    reported_at,
    updated_at
  ) values (
    selected_item.category_version_id,
    current_user_id,
    selected_item.slug,
    selected_item.title,
    selected_category.version,
    selected_item.availability,
    p_reason,
    normalized_detail,
    v_now,
    v_now
  ) returning * into created_report;

  return jsonb_build_object(
    'reportId', created_report.id,
    'categorySlug', created_report.category_slug_snapshot,
    'categoryTitle', created_report.category_title_snapshot,
    'categoryVersion', created_report.category_version_snapshot,
    'status', created_report.status,
    'submittedAt', created_report.reported_at
  );
end;
$$;

create function public.category_moderation_queue()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  v_now timestamptz := statement_timestamp();
  reports_payload jsonb;
begin
  if current_user_id is null then
    raise insufficient_privilege using message = 'Authentication required.';
  end if;
  if not exists (
    select 1
    from private.category_moderators as moderator
    where moderator.user_id = current_user_id and moderator.active
  ) then
    raise insufficient_privilege using message = 'Moderator authorization required.';
  end if;

  select coalesce(
    jsonb_agg(
      private.category_moderation_report_payload(queued.id)
      order by case when queued.status = 'pending' then 0 else 1 end,
        case when queued.status = 'pending' then queued.reported_at end asc,
        queued.updated_at desc,
        queued.id asc
    ),
    '[]'::jsonb
  ) into reports_payload
  from (
    select report.id, report.status, report.reported_at, report.updated_at
    from private.category_reports as report
    where report.reporter_user_id <> current_user_id
    order by case when report.status = 'pending' then 0 else 1 end,
      case when report.status = 'pending' then report.reported_at end asc,
      report.updated_at desc,
      report.id asc
    limit 100
  ) as queued;

  return jsonb_build_object(
    'serverNow', v_now,
    'authorized', true,
    'reports', reports_payload
  );
end;
$$;

create function public.category_moderation_decide(
  p_report_id uuid,
  p_outcome text,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  v_now timestamptz := statement_timestamp();
  normalized_note text;
  selected_report private.category_reports%rowtype;
  next_status text;
begin
  if current_user_id is null then
    raise insufficient_privilege using message = 'Authentication required.';
  end if;
  if not exists (
    select 1
    from private.category_moderators as moderator
    where moderator.user_id = current_user_id and moderator.active
  ) then
    raise insufficient_privilege using message = 'Moderator authorization required.';
  end if;

  normalized_note := regexp_replace(btrim(coalesce(p_note, '')), '[[:space:]]+', ' ', 'g');
  if p_report_id is null
    or p_outcome is null
    or p_outcome not in ('dismiss', 'publisher-review')
    or p_note is null
    or p_note ~ '[[:cntrl:]]'
    or char_length(normalized_note) not between 12 and 600
  then
    raise invalid_parameter_value using message = 'Invalid moderation decision.';
  end if;

  select report.* into selected_report
  from private.category_reports as report
  where report.id = p_report_id
  for update;
  if not found then
    raise invalid_parameter_value using message = 'Category report not found.';
  end if;
  if selected_report.reporter_user_id = current_user_id then
    raise invalid_parameter_value using message = 'Moderators cannot decide their own reports.';
  end if;
  if selected_report.status <> 'pending' then
    raise object_not_in_prerequisite_state using message = 'Category report already reviewed.';
  end if;

  next_status := case when p_outcome = 'dismiss' then 'dismissed' else 'publisher-review' end;

  insert into private.category_report_moderation_decisions (
    report_id,
    moderator_user_id,
    outcome,
    decision_note,
    decided_at
  ) values (
    selected_report.id,
    current_user_id,
    p_outcome,
    normalized_note,
    v_now
  );

  update private.category_reports
  set status = next_status, updated_at = v_now
  where id = selected_report.id;

  return jsonb_build_object(
    'reportId', selected_report.id,
    'status', next_status,
    'outcome', p_outcome,
    'decidedAt', v_now
  );
end;
$$;

create or replace function private.category_publication_payload(p_publication_id uuid)
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
    ) end,
    'moderationEscalation', (
      select jsonb_build_object(
        'reportId', report.id,
        'reason', report.reason,
        'summary', decision.decision_note,
        'decidedAt', decision.decided_at
      )
      from private.category_reports as report
      join private.category_report_moderation_decisions as decision
        on decision.report_id = report.id
      where report.category_version_id = publication.category_version_id
        and report.status = 'publisher-review'
        and decision.outcome = 'publisher-review'
      order by decision.decided_at desc, report.id asc
      limit 1
    )
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

revoke all on function private.category_moderation_report_payload(uuid) from public, anon, authenticated;
revoke all on function private.category_publication_payload(uuid) from public, anon, authenticated;
revoke all on function public.category_moderator_status() from public, anon, authenticated;
revoke all on function public.category_report_create(text, text, text) from public, anon, authenticated;
revoke all on function public.category_moderation_queue() from public, anon, authenticated;
revoke all on function public.category_moderation_decide(uuid, text, text) from public, anon, authenticated;

grant execute on function public.category_moderator_status() to authenticated;
grant execute on function public.category_report_create(text, text, text) to authenticated;
grant execute on function public.category_moderation_queue() to authenticated;
grant execute on function public.category_moderation_decide(uuid, text, text) to authenticated;
