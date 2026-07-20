create table public.room_submissions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  player_id uuid not null,
  answer_id uuid not null references private.category_answers(id) on delete restrict,
  submitted_at timestamptz not null default statement_timestamp(),
  foreign key (player_id, room_id)
    references public.room_players(id, room_id)
    on delete cascade,
  unique (player_id, answer_id)
);

create index room_submissions_room_player_time_idx
  on public.room_submissions (room_id, player_id, submitted_at, id);

create index room_submissions_answer_idx
  on public.room_submissions (answer_id);

alter table public.room_players
  add column submission_window_started_at timestamptz,
  add column submission_window_count integer not null default 0
    check (submission_window_count between 0 and 40);

alter table public.room_submissions enable row level security;
revoke all on table public.room_submissions from public, anon, authenticated;

create or replace function private.room_game_payload(
  p_room_id uuid,
  p_user_id uuid,
  p_now timestamptz
)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'serverNow', p_now,
    'game', jsonb_build_object(
      'code', room.public_code,
      'status', room.status,
      'mode', replace(room.mode, '_', '-'),
      'startedAt', room.started_at,
      'deadlineAt', room.deadline_at,
      'endedAt', room.ended_at,
      'category', jsonb_build_object(
        'slug', category.slug,
        'version', category.version,
        'title', category.title,
        'prompt', category.prompt,
        'timeLimitSeconds', category.time_limit_seconds
      ),
      'membership', jsonb_build_object(
        'playerId', member.id,
        'displayName', member.display_name,
        'isHost', member.is_host
      ),
      'players', coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id', ranked.id,
              'displayName', ranked.display_name,
              'isHost', ranked.is_host,
              'joinedAt', ranked.joined_at,
              'connected', ranked.last_seen_at > p_now - interval '20 seconds',
              'score', ranked.score,
              'rank', ranked.rank,
              'isTied', ranked.is_tied,
              'answers', case
                when ranked.id = member.id or room.status = 'completed' then coalesce(
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
                    from public.room_submissions as submission
                    join private.category_answers as answer
                      on answer.id = submission.answer_id
                    where submission.player_id = ranked.id
                  ),
                  '[]'::jsonb
                )
                else null
              end
            )
            order by ranked.rank
          )
          from (
            select
              scored.*,
              row_number() over (
                order by scored.score desc, scored.is_host desc, scored.joined_at, scored.id
              )::integer as rank,
              (count(*) over (partition by scored.score) > 1) as is_tied
            from (
              select
                player.id,
                player.display_name,
                player.is_host,
                player.joined_at,
                player.last_seen_at,
                count(submission.id)::integer as score
              from public.room_players as player
              left join public.room_submissions as submission
                on submission.player_id = player.id
              where player.room_id = room.id
              group by player.id
            ) as scored
          ) as ranked
        ),
        '[]'::jsonb
      )
    )
  )
  from public.rooms as room
  join private.category_versions as category
    on category.id = room.category_version_id
  join public.room_players as member
    on member.room_id = room.id
   and member.user_id = p_user_id
  where room.id = p_room_id;
$$;

create or replace function private.complete_room_if_expired(
  p_room_id uuid,
  p_now timestamptz
)
returns void
language sql
volatile
set search_path = ''
as $$
  update public.rooms as room
  set status = 'completed',
      ended_at = room.deadline_at
  where room.id = p_room_id
    and room.status = 'active'
    and room.deadline_at <= p_now;
$$;

create or replace function private.room_realtime_authorized(
  p_topic text,
  p_user_id uuid,
  p_write boolean
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_topic is null
      or p_user_id is null
      or p_topic !~ '^room:[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}:player:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then false
    else exists (
      select 1
      from public.rooms as room
      join public.room_players as member
        on member.room_id = room.id
       and member.user_id = p_user_id
      join public.room_players as topic_player
        on topic_player.room_id = room.id
       and topic_player.id = split_part(p_topic, ':', 4)::uuid
      where room.public_code = split_part(p_topic, ':', 2)
        and (not p_write or topic_player.user_id = p_user_id)
    )
  end;
$$;

create or replace function public.room_get_game(p_room_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  v_now timestamptz := statement_timestamp();
  normalized_code text := private.normalize_room_code(p_room_code);
  selected_room record;
  current_player_id uuid;
begin
  if current_user_id is null then
    raise insufficient_privilege using message = 'Authentication required.';
  end if;
  if normalized_code is null then
    raise invalid_parameter_value using message = 'Invalid room code.';
  end if;

  select room.*
    into selected_room
  from public.rooms as room
  where room.public_code = normalized_code
  for update;

  if not found then
    raise no_data_found using message = 'Room not found.';
  end if;

  select player.id
    into current_player_id
  from public.room_players as player
  where player.room_id = selected_room.id
    and player.user_id = current_user_id;

  if current_player_id is null then
    raise insufficient_privilege using message = 'Room membership required.';
  end if;
  if selected_room.status = 'waiting' then
    raise object_not_in_prerequisite_state using message = 'Room has not started.';
  end if;
  if selected_room.status = 'cancelled' then
    raise object_not_in_prerequisite_state using message = 'Room unavailable.';
  end if;

  perform private.complete_room_if_expired(selected_room.id, v_now);

  update public.room_players as player
  set last_seen_at = greatest(player.last_seen_at, v_now)
  where player.id = current_player_id;

  return private.room_game_payload(selected_room.id, current_user_id, v_now);
end;
$$;

create or replace function public.room_submit_answer(
  p_room_code text,
  p_normalized_answer text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  v_now timestamptz := statement_timestamp();
  normalized_code text := private.normalize_room_code(p_room_code);
  selected_room record;
  current_player record;
  matched_answer record;
  inserted_count integer := 0;
  current_score integer := 0;
  accepted_time timestamptz;
begin
  if current_user_id is null then
    raise insufficient_privilege using message = 'Authentication required.';
  end if;
  if normalized_code is null then
    raise invalid_parameter_value using message = 'Invalid room code.';
  end if;

  select room.*
    into selected_room
  from public.rooms as room
  where room.public_code = normalized_code
  for update;

  if not found then
    raise no_data_found using message = 'Room not found.';
  end if;

  select player.*
    into current_player
  from public.room_players as player
  where player.room_id = selected_room.id
    and player.user_id = current_user_id
  for update;

  if not found then
    raise insufficient_privilege using message = 'Room membership required.';
  end if;

  perform private.complete_room_if_expired(selected_room.id, v_now);

  if selected_room.status <> 'active' or selected_room.deadline_at <= v_now then
    return jsonb_build_object(
      'status', 'round-ended',
      'serverNow', v_now,
      'game', private.room_game_payload(selected_room.id, current_user_id, v_now)->'game'
    );
  end if;

  if current_player.submission_window_started_at is null
    or current_player.submission_window_started_at <= v_now - interval '10 seconds'
  then
    update public.room_players as player
    set submission_window_started_at = v_now,
        submission_window_count = 1,
        last_seen_at = greatest(player.last_seen_at, v_now)
    where player.id = current_player.id;
  elsif current_player.submission_window_count >= 40 then
    return jsonb_build_object('status', 'rate-limited', 'serverNow', v_now);
  else
    update public.room_players as player
    set submission_window_count = player.submission_window_count + 1,
        last_seen_at = greatest(player.last_seen_at, v_now)
    where player.id = current_player.id;
  end if;

  if p_normalized_answer is null
    or char_length(p_normalized_answer) not between 1 and 80
    or p_normalized_answer <> btrim(p_normalized_answer)
    or p_normalized_answer ~ '[[:cntrl:]]'
  then
    return jsonb_build_object('status', 'invalid', 'serverNow', v_now);
  end if;

  select answer.id, answer.stable_id, answer.canonical_text, answer.team_code
    into matched_answer
  from private.category_answer_aliases as alias
  join private.category_answers as answer
    on answer.id = alias.answer_id
  where alias.category_version_id = selected_room.category_version_id
    and alias.normalized_alias = p_normalized_answer
  limit 1;

  if not found then
    return jsonb_build_object('status', 'invalid', 'serverNow', v_now);
  end if;

  insert into public.room_submissions (room_id, player_id, answer_id, submitted_at)
  values (selected_room.id, current_player.id, matched_answer.id, v_now)
  on conflict (player_id, answer_id) do nothing;

  get diagnostics inserted_count = row_count;

  select count(*)::integer
    into current_score
  from public.room_submissions as submission
  where submission.player_id = current_player.id;

  select submission.submitted_at
    into accepted_time
  from public.room_submissions as submission
  where submission.player_id = current_player.id
    and submission.answer_id = matched_answer.id;

  if inserted_count = 1 then
    perform realtime.send(
      '{}'::jsonb,
      'board_changed',
      'room:' || normalized_code || ':player:' || current_player.id::text,
      true
    );
  end if;

  return jsonb_build_object(
    'status', case when inserted_count = 1 then 'accepted' else 'duplicate' end,
    'serverNow', v_now,
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

create policy "room members receive private player activity"
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension in ('broadcast', 'presence')
  and private.room_realtime_authorized(
    (select realtime.topic()),
    (select auth.uid()),
    false
  )
);

create policy "room members publish only their own player activity"
on realtime.messages
for insert
to authenticated
with check (
  realtime.messages.extension in ('broadcast', 'presence')
  and private.room_realtime_authorized(
    (select realtime.topic()),
    (select auth.uid()),
    true
  )
);

revoke all on function private.room_game_payload(uuid, uuid, timestamptz) from public, anon, authenticated;
revoke all on function private.complete_room_if_expired(uuid, timestamptz) from public, anon, authenticated;
revoke all on function private.room_realtime_authorized(text, uuid, boolean) from public, anon, authenticated;
revoke all on function public.room_get_game(text) from public, anon, authenticated;
revoke all on function public.room_submit_answer(text, text) from public, anon, authenticated;

grant execute on function private.room_realtime_authorized(text, uuid, boolean) to authenticated;
grant execute on function public.room_get_game(text) to authenticated;
grant execute on function public.room_submit_answer(text, text) to authenticated;
