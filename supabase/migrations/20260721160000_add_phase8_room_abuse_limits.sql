create table private.anonymous_action_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in ('room-create', 'room-join')),
  occurred_at timestamptz not null default statement_timestamp()
);

create index anonymous_action_events_user_action_time_idx
  on private.anonymous_action_events (user_id, action, occurred_at desc);

create index anonymous_action_events_time_idx
  on private.anonymous_action_events (occurred_at);

alter table private.anonymous_action_events enable row level security;
revoke all on table private.anonymous_action_events from public, anon, authenticated;
revoke all on sequence private.anonymous_action_events_id_seq from public, anon, authenticated;

comment on table private.anonymous_action_events is
  'Short-lived server-owned events used to bound anonymous room creation and join requests.';

create or replace function private.consume_anonymous_action_budget(
  p_user_id uuid,
  p_action text,
  p_now timestamptz,
  p_window interval,
  p_maximum integer
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  recent_count integer;
begin
  if p_user_id is null
    or p_action not in ('room-create', 'room-join')
    or p_now is null
    or p_window <= interval '0 seconds'
    or p_maximum < 1
  then
    raise invalid_parameter_value using message = 'Invalid anonymous action budget.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text || ':' || p_action, 0)
  );

  delete from private.anonymous_action_events as event
  where event.occurred_at < p_now - interval '24 hours';

  select count(*)::integer
    into recent_count
  from private.anonymous_action_events as event
  where event.user_id = p_user_id
    and event.action = p_action
    and event.occurred_at > p_now - p_window;

  if recent_count >= p_maximum then
    return false;
  end if;

  insert into private.anonymous_action_events (user_id, action, occurred_at)
  values (p_user_id, p_action, p_now);

  return true;
end;
$$;

create or replace function private.room_error_payload(p_code text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object('_roomError', p_code);
$$;

create or replace function public.room_create(p_display_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  v_now timestamptz := statement_timestamp();
  normalized_display_name text := private.normalize_daily_display_name(p_display_name);
  new_room_id uuid := gen_random_uuid();
  new_player_id uuid := gen_random_uuid();
  selected_category_id uuid;
  generated_code text;
  attempt_number integer;
begin
  if current_user_id is null then
    raise insufficient_privilege using message = 'Authentication required.';
  end if;
  if normalized_display_name is null then
    raise invalid_parameter_value using message = 'Invalid display name.';
  end if;
  if not private.consume_anonymous_action_budget(
    current_user_id,
    'room-create',
    v_now,
    interval '1 hour',
    5
  ) then
    return private.room_error_payload('rate-limited');
  end if;

  select category.id
    into selected_category_id
  from private.category_versions as category
  where category.slug = 'current-nba-players'
    and category.version = 1;

  if selected_category_id is null then
    raise object_not_in_prerequisite_state using message = 'Room category unavailable.';
  end if;

  for attempt_number in 1..10 loop
    generated_code := private.generate_room_code();
    begin
      insert into public.rooms (
        id,
        public_code,
        category_version_id,
        mode,
        status,
        host_player_id,
        created_at
      ) values (
        new_room_id,
        generated_code,
        selected_category_id,
        'private_race',
        'waiting',
        new_player_id,
        v_now
      );
      exit;
    exception when unique_violation then
      if attempt_number = 10 then
        raise program_limit_exceeded using message = 'Room code unavailable.';
      end if;
    end;
  end loop;

  insert into public.room_players (
    id,
    room_id,
    user_id,
    display_name,
    is_host,
    joined_at,
    last_seen_at
  ) values (
    new_player_id,
    new_room_id,
    current_user_id,
    normalized_display_name,
    true,
    v_now,
    v_now
  );

  return private.room_payload(new_room_id, current_user_id, v_now);
end;
$$;

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
  if created_payload ? '_roomError' then
    return created_payload;
  end if;

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

create or replace function public.room_join(
  p_room_code text,
  p_display_name text
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
  normalized_display_name text := private.normalize_daily_display_name(p_display_name);
  selected_room record;
  existing_member record;
  player_count integer;
begin
  if current_user_id is null then
    raise insufficient_privilege using message = 'Authentication required.';
  end if;
  if normalized_code is null or normalized_display_name is null then
    raise invalid_parameter_value using message = 'Invalid room request.';
  end if;
  if not private.consume_anonymous_action_budget(
    current_user_id,
    'room-join',
    v_now,
    interval '10 minutes',
    30
  ) then
    return private.room_error_payload('rate-limited');
  end if;

  select room.*
    into selected_room
  from public.rooms as room
  where room.public_code = normalized_code
  for update;

  if not found then
    return private.room_error_payload('not-found');
  end if;

  select player.*
    into existing_member
  from public.room_players as player
  where player.room_id = selected_room.id
    and player.user_id = current_user_id;

  if found then
    if existing_member.display_name is distinct from normalized_display_name then
      return private.room_error_payload('membership-unavailable');
    end if;
    update public.room_players as player
    set last_seen_at = greatest(player.last_seen_at, v_now)
    where player.id = existing_member.id;
    return private.room_payload(selected_room.id, current_user_id, v_now);
  end if;

  if selected_room.status <> 'waiting' then
    return private.room_error_payload('locked');
  end if;

  select count(*)::integer
    into player_count
  from public.room_players as player
  where player.room_id = selected_room.id;

  if player_count >= 8 then
    return private.room_error_payload('full');
  end if;

  insert into public.room_players (
    room_id,
    user_id,
    display_name,
    is_host,
    joined_at,
    last_seen_at
  ) values (
    selected_room.id,
    current_user_id,
    normalized_display_name,
    false,
    v_now,
    v_now
  );

  return private.room_payload(selected_room.id, current_user_id, v_now);
end;
$$;

revoke all on function private.consume_anonymous_action_budget(uuid, text, timestamptz, interval, integer)
  from public, anon, authenticated;
revoke all on function private.room_error_payload(text) from public, anon, authenticated;
revoke all on function public.room_create(text) from public, anon, authenticated;
revoke all on function public.room_create(text, text) from public, anon, authenticated;
revoke all on function public.room_join(text, text) from public, anon, authenticated;

grant execute on function public.room_create(text) to authenticated;
grant execute on function public.room_create(text, text) to authenticated;
grant execute on function public.room_join(text, text) to authenticated;
