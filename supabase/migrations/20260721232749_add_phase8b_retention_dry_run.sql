create or replace function private.retention_dry_run(
  p_now timestamptz default statement_timestamp()
)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with
  expired_active_rooms as (
    select room.id
    from public.rooms as room
    where room.status = 'active'
      and room.deadline_at < p_now - interval '15 minutes'
  ),
  abandoned_waiting_rooms as (
    select room.id
    from public.rooms as room
    where room.status = 'waiting'
      and room.created_at < p_now - interval '24 hours'
  ),
  finished_rooms as (
    select room.id
    from public.rooms as room
    where room.status in ('completed', 'cancelled')
      and room.ended_at < p_now - interval '30 days'
  ),
  orphan_anonymous_users as (
    select app_user.id
    from auth.users as app_user
    where app_user.is_anonymous is true
      and app_user.created_at < p_now - interval '30 days'
      and not exists (
        select 1
        from public.daily_attempts as attempt
        where attempt.user_id = app_user.id
      )
      and not exists (
        select 1
        from public.room_players as player
        where player.user_id = app_user.id
      )
      and not exists (
        select 1
        from private.anonymous_action_events as event
        where event.user_id = app_user.id
      )
      and not exists (
        select 1
        from private.category_drafts as draft
        where draft.user_id = app_user.id
      )
      and not exists (
        select 1
        from private.category_draft_reviews as review
        where review.reviewer_user_id = app_user.id
      )
      and not exists (
        select 1
        from private.category_reviewers as reviewer
        where reviewer.user_id = app_user.id
      )
      and not exists (
        select 1
        from private.category_answer_bank_versions as bank
        where bank.editor_user_id = app_user.id
      )
      and not exists (
        select 1
        from private.category_answer_bank_reviews as review
        where review.reviewer_user_id = app_user.id
      )
      and not exists (
        select 1
        from private.category_publishers as publisher
        where publisher.user_id = app_user.id
      )
      and not exists (
        select 1
        from private.category_answer_bank_publications as publication
        where publication.publisher_user_id = app_user.id
      )
      and not exists (
        select 1
        from private.category_publication_correction_requests as correction
        where correction.requested_by_user_id = app_user.id
      )
      and not exists (
        select 1
        from private.category_moderators as moderator
        where moderator.user_id = app_user.id
      )
      and not exists (
        select 1
        from private.category_reports as report
        where report.reporter_user_id = app_user.id
      )
      and not exists (
        select 1
        from private.category_report_moderation_decisions as decision
        where decision.moderator_user_id = app_user.id
      )
  )
  select jsonb_build_object(
    'schemaVersion', 1,
    'mode', 'dry-run',
    'asOf', p_now,
    'policies', jsonb_build_object(
      'expiredActiveRoomFinalizationGrace', '15 minutes',
      'abandonedWaitingRoomAge', '24 hours',
      'finishedRoomAge', '30 days',
      'anonymousActionEventAge', '24 hours',
      'orphanAnonymousUserAge', '30 days'
    ),
    'candidateCounts', jsonb_build_object(
      'expiredActiveRoomsToFinalize', (select count(*) from expired_active_rooms),
      'abandonedWaitingRooms', (select count(*) from abandoned_waiting_rooms),
      'abandonedWaitingRoomPlayers', (
        select count(*)
        from public.room_players as player
        where player.room_id in (select room.id from abandoned_waiting_rooms as room)
      ),
      'finishedRooms', (select count(*) from finished_rooms),
      'finishedRoomPlayers', (
        select count(*)
        from public.room_players as player
        where player.room_id in (select room.id from finished_rooms as room)
      ),
      'finishedRoomSubmissions', (
        select count(*)
        from public.room_submissions as submission
        where submission.room_id in (select room.id from finished_rooms as room)
      ),
      'finishedRoomClaims', (
        select count(*)
        from public.room_answer_claims as claim
        where claim.room_id in (select room.id from finished_rooms as room)
      ),
      'anonymousActionEvents', (
        select count(*)
        from private.anonymous_action_events as event
        where event.occurred_at < p_now - interval '24 hours'
      ),
      'orphanAnonymousUsers', (select count(*) from orphan_anonymous_users)
    ),
    'preservedCounts', jsonb_build_object(
      'dailyAttempts', (select count(*) from public.daily_attempts),
      'categoryVersions', (select count(*) from private.category_versions),
      'publishedAnswerBanks', (select count(*) from private.category_answer_bank_publications)
    )
  );
$$;

comment on function private.retention_dry_run(timestamptz) is
  'Returns aggregate Phase 8 retention candidates without exposing identifiers or changing data.';

revoke all on function private.retention_dry_run(timestamptz)
  from public, anon, authenticated;
