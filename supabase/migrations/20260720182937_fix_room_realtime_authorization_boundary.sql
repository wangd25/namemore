drop policy "room members receive private player activity" on realtime.messages;
drop policy "room members publish only their own player activity" on realtime.messages;

create or replace function public.room_realtime_authorized(
  p_topic text,
  p_write boolean
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when auth.uid() is null
      or p_topic is null
      or p_topic !~ '^room:[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}:player:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then false
    else exists (
      select 1
      from public.rooms as room
      join public.room_players as member
        on member.room_id = room.id
       and member.user_id = auth.uid()
      join public.room_players as topic_player
        on topic_player.room_id = room.id
       and topic_player.id = split_part(p_topic, ':', 4)::uuid
      where room.public_code = split_part(p_topic, ':', 2)
        and (not p_write or topic_player.user_id = auth.uid())
    )
  end;
$$;

create policy "room members receive private player activity"
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension in ('broadcast', 'presence')
  and public.room_realtime_authorized((select realtime.topic()), false)
);

create policy "room members publish only their own player activity"
on realtime.messages
for insert
to authenticated
with check (
  realtime.messages.extension in ('broadcast', 'presence')
  and public.room_realtime_authorized((select realtime.topic()), true)
);

revoke all on function public.room_realtime_authorized(text, boolean) from public, anon, authenticated;
grant execute on function public.room_realtime_authorized(text, boolean) to authenticated;

revoke all on function private.room_realtime_authorized(text, uuid, boolean) from public, anon, authenticated;
drop function private.room_realtime_authorized(text, uuid, boolean);
