create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  public_code text not null unique check (public_code ~ '^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$'),
  category_version_id uuid not null references private.category_versions(id) on delete restrict,
  mode text not null default 'private_race' check (mode in ('private_race')),
  status text not null default 'waiting' check (status in ('waiting', 'active', 'completed', 'cancelled')),
  host_player_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  started_at timestamptz,
  deadline_at timestamptz,
  ended_at timestamptz,
  check (deadline_at is null or (started_at is not null and deadline_at > started_at)),
  check (
    (status = 'waiting' and started_at is null and deadline_at is null and ended_at is null)
    or (status = 'active' and started_at is not null and deadline_at is not null and ended_at is null)
    or (status = 'completed' and started_at is not null and deadline_at is not null and ended_at is not null)
    or (status = 'cancelled' and ended_at is not null)
  )
);

create index rooms_category_version_idx
  on public.rooms (category_version_id);

create table public.room_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (
    char_length(display_name) between 2 and 24
    and display_name = regexp_replace(btrim(display_name), '[[:space:]]+', ' ', 'g')
    and display_name !~ '[[:cntrl:]]'
    and display_name ~ '^[[:alnum:]][[:alnum:] .''’-]*$'
  ),
  is_host boolean not null default false,
  joined_at timestamptz not null default statement_timestamp(),
  last_seen_at timestamptz not null default statement_timestamp(),
  unique (room_id, user_id),
  unique (id, room_id),
  check (last_seen_at >= joined_at)
);

create unique index room_players_one_host_idx
  on public.room_players (room_id)
  where is_host;

create index room_players_user_idx
  on public.room_players (user_id, joined_at desc);

create index room_players_room_joined_idx
  on public.room_players (room_id, joined_at, id);

alter table public.rooms
  add constraint rooms_host_player_fk
  foreign key (host_player_id, id)
  references public.room_players(id, room_id)
  on delete restrict
  deferrable initially deferred;

alter table public.rooms enable row level security;
alter table public.room_players enable row level security;

revoke all on table public.rooms from public, anon, authenticated;
revoke all on table public.room_players from public, anon, authenticated;

create or replace function private.normalize_room_code(p_room_code text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  normalized_code text;
begin
  if p_room_code is null then
    return null;
  end if;

  normalized_code := upper(btrim(p_room_code));
  if normalized_code !~ '^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$' then
    return null;
  end if;

  return normalized_code;
end;
$$;

create or replace function private.generate_room_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  random_bytes bytea := uuid_send(gen_random_uuid());
  generated_code text := '';
  position integer;
begin
  for position in 0..7 loop
    generated_code := generated_code
      || substr(alphabet, (get_byte(random_bytes, position) % char_length(alphabet)) + 1, 1);
  end loop;
  return generated_code;
end;
$$;

create or replace function private.room_payload(
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
    'room', jsonb_build_object(
      'code', room.public_code,
      'status', room.status,
      'mode', replace(room.mode, '_', '-'),
      'capacity', 8,
      'playerCount', (
        select count(*)::integer
        from public.room_players as counted_player
        where counted_player.room_id = room.id
      ),
      'createdAt', room.created_at,
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
      'membership', case
        when member.id is null then null
        else jsonb_build_object(
          'playerId', member.id,
          'displayName', member.display_name,
          'isHost', member.is_host
        )
      end,
      'participants', case
        when member.id is null then '[]'::jsonb
        else coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id', participant.id,
                'displayName', participant.display_name,
                'isHost', participant.is_host,
                'joinedAt', participant.joined_at,
                'connected', participant.last_seen_at > p_now - interval '20 seconds'
              )
              order by participant.is_host desc, participant.joined_at, participant.id
            )
            from public.room_players as participant
            where participant.room_id = room.id
          ),
          '[]'::jsonb
        )
      end
    )
  )
  from public.rooms as room
  join private.category_versions as category
    on category.id = room.category_version_id
  left join public.room_players as member
    on member.room_id = room.id
   and member.user_id = p_user_id
  where room.id = p_room_id;
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

create or replace function public.room_get_status(p_room_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  v_now timestamptz := statement_timestamp();
  normalized_code text := private.normalize_room_code(p_room_code);
  selected_room_id uuid;
begin
  if current_user_id is null then
    raise insufficient_privilege using message = 'Authentication required.';
  end if;
  if normalized_code is null then
    raise invalid_parameter_value using message = 'Invalid room code.';
  end if;

  select room.id
    into selected_room_id
  from public.rooms as room
  where room.public_code = normalized_code;

  if selected_room_id is null then
    raise no_data_found using message = 'Room not found.';
  end if;

  update public.room_players as player
  set last_seen_at = greatest(player.last_seen_at, v_now)
  where player.room_id = selected_room_id
    and player.user_id = current_user_id;

  return private.room_payload(selected_room_id, current_user_id, v_now);
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

  select room.*
    into selected_room
  from public.rooms as room
  where room.public_code = normalized_code
  for update;

  if not found then
    raise no_data_found using message = 'Room not found.';
  end if;

  select player.*
    into existing_member
  from public.room_players as player
  where player.room_id = selected_room.id
    and player.user_id = current_user_id;

  if found then
    if existing_member.display_name is distinct from normalized_display_name then
      raise insufficient_privilege using message = 'Room membership unavailable.';
    end if;
    update public.room_players as player
    set last_seen_at = greatest(player.last_seen_at, v_now)
    where player.id = existing_member.id;
    return private.room_payload(selected_room.id, current_user_id, v_now);
  end if;

  if selected_room.status <> 'waiting' then
    raise object_not_in_prerequisite_state using message = 'Room already started.';
  end if;

  select count(*)::integer
    into player_count
  from public.room_players as player
  where player.room_id = selected_room.id;

  if player_count >= 8 then
    raise program_limit_exceeded using message = 'Room is full.';
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

create or replace function public.room_start(p_room_code text)
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
  current_member record;
  room_time_limit integer;
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
    into current_member
  from public.room_players as player
  where player.room_id = selected_room.id
    and player.user_id = current_user_id;

  if not found
    or not current_member.is_host
    or current_member.id <> selected_room.host_player_id
  then
    raise insufficient_privilege using message = 'Only the room host can start.';
  end if;

  if selected_room.status = 'active' then
    update public.room_players as player
    set last_seen_at = greatest(player.last_seen_at, v_now)
    where player.id = current_member.id;
    return private.room_payload(selected_room.id, current_user_id, v_now);
  end if;
  if selected_room.status <> 'waiting' then
    raise object_not_in_prerequisite_state using message = 'Room cannot start.';
  end if;

  select category.time_limit_seconds
    into room_time_limit
  from private.category_versions as category
  where category.id = selected_room.category_version_id;

  update public.rooms as room
  set status = 'active',
      started_at = v_now,
      deadline_at = v_now + make_interval(secs => room_time_limit)
  where room.id = selected_room.id;

  update public.room_players as player
  set last_seen_at = greatest(player.last_seen_at, v_now)
  where player.id = current_member.id;

  return private.room_payload(selected_room.id, current_user_id, v_now);
end;
$$;

revoke all on function private.normalize_room_code(text) from public, anon, authenticated;
revoke all on function private.generate_room_code() from public, anon, authenticated;
revoke all on function private.room_payload(uuid, uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.room_create(text) from public, anon, authenticated;
revoke all on function public.room_get_status(text) from public, anon, authenticated;
revoke all on function public.room_join(text, text) from public, anon, authenticated;
revoke all on function public.room_start(text) from public, anon, authenticated;

grant execute on function public.room_create(text) to authenticated;
grant execute on function public.room_get_status(text) to authenticated;
grant execute on function public.room_join(text, text) to authenticated;
grant execute on function public.room_start(text) to authenticated;
