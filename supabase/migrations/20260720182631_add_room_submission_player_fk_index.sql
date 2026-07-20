create index room_submissions_player_room_idx
  on public.room_submissions (player_id, room_id);
