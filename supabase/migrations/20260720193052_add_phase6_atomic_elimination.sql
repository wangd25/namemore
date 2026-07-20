alter table public.rooms
  drop constraint if exists rooms_mode_check;

alter table public.rooms
  add constraint rooms_mode_check
  check (mode in ('private_race', 'elimination'));

create table public.room_answer_claims (
  room_id uuid not null references public.rooms(id) on delete cascade,
  answer_id uuid not null references private.category_answers(id) on delete restrict,
  player_id uuid not null,
  claimed_at timestamptz not null default statement_timestamp(),
  primary key (room_id, answer_id),
  foreign key (player_id, room_id)
    references public.room_players(id, room_id)
    on delete cascade
);

create index room_answer_claims_player_room_idx
  on public.room_answer_claims (player_id, room_id);

create index room_answer_claims_answer_idx
  on public.room_answer_claims (answer_id);

alter table public.room_answer_claims enable row level security;
revoke all on table public.room_answer_claims from public, anon, authenticated;

create or replace function public.room_create(
  p_display_name text,
  p_mode text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  v_now timestamptz := statement_timestamp();
  normalized_mode text := replace(lower(btrim(p_mode)), '-', '_');
  created_payload jsonb;
  created_room_id uuid;
begin
  if current_user_id is null then
    raise insufficient_privilege using message = 'Authentication required.';
  end if;
  if normalized_mode not in ('private_race', 'elimination') then
    raise invalid_parameter_value using message = 'Invalid room mode.';
  end if;

  created_payload := public.room_create(p_display_name);

  if normalized_mode = 'private_race' then
    return created_payload;
  end if;

  select room.id
    into created_room_id
  from public.rooms as room
  join public.room_players as host
    on host.id = room.host_player_id
   and host.room_id = room.id
  where room.public_code = created_payload #>> '{room,code}'
    and host.user_id = current_user_id
  for update of room;

  if created_room_id is null then
    raise object_not_in_prerequisite_state using message = 'Room unavailable.';
  end if;

  update public.rooms as room
  set mode = normalized_mode
  where room.id = created_room_id;

  return private.room_payload(created_room_id, current_user_id, v_now);
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
  claim_inserted_count integer := 0;
  claim_owner_id uuid;
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

  if selected_room.mode = 'elimination' then
    insert into public.room_answer_claims (room_id, answer_id, player_id, claimed_at)
    values (selected_room.id, matched_answer.id, current_player.id, v_now)
    on conflict (room_id, answer_id) do nothing;

    get diagnostics claim_inserted_count = row_count;

    if claim_inserted_count = 0 then
      select claim.player_id
        into claim_owner_id
      from public.room_answer_claims as claim
      where claim.room_id = selected_room.id
        and claim.answer_id = matched_answer.id;

      if claim_owner_id is distinct from current_player.id then
        return jsonb_build_object('status', 'already-taken', 'serverNow', v_now);
      end if;
    end if;
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

revoke all on function public.room_create(text, text) from public, anon, authenticated;
revoke all on function public.room_submit_answer(text, text) from public, anon, authenticated;

grant execute on function public.room_create(text, text) to authenticated;
grant execute on function public.room_submit_answer(text, text) to authenticated;
