import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260717221931_create_server_authoritative_daily.sql"),
  "utf8",
);
const scheduleMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260718011326_schedule_phase2_daily_challenges.sql"),
  "utf8",
);
const rpcFixMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260718011616_fix_daily_rpc_time_variable.sql"),
  "utf8",
);
const indexMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260718011806_add_daily_foreign_key_indexes.sql"),
  "utf8",
);
const leaderboardMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260718020151_add_phase3_daily_leaderboard.sql"),
  "utf8",
);
const displayNameControlFixMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260718022352_reject_display_name_control_characters.sql"),
  "utf8",
);
const roomLobbyMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260720040822_add_phase4_secure_room_lobby.sql"),
  "utf8",
);
const roomHostIndexMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260720052757_add_room_host_foreign_key_index.sql"),
  "utf8",
);
const roomGameMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260720181046_add_phase5_live_private_race.sql"),
  "utf8",
);
const roomSubmissionIndexMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260720182631_add_room_submission_player_fk_index.sql"),
  "utf8",
);
const roomRealtimeFixMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260720182937_fix_room_realtime_authorization_boundary.sql"),
  "utf8",
);
const eliminationMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260720193052_add_phase6_atomic_elimination.sql"),
  "utf8",
);

describe("server-authoritative daily migration", () => {
  it("keeps the answer bank private and exposes only narrow RPCs", () => {
    expect(migration).toContain("create schema if not exists private");
    expect(migration).toContain("revoke all on schema private from public, anon, authenticated");
    expect(migration).toContain("revoke all on table private.category_answers from public, anon, authenticated");
    expect(migration).toContain("alter table public.daily_attempts enable row level security");
    expect(migration).toContain("security definer\nset search_path = ''");
    expect(migration).toContain("grant execute on function public.daily_submit_answer(uuid, text) to authenticated");
    expect(migration).toContain("grant usage on schema public to authenticated");
    expect(migration).not.toMatch(/grant\s+select\s+on\s+table\s+private\./i);
  });

  it("binds every attempt operation to auth.uid and derives the score", () => {
    expect(migration.match(/auth\.uid\(\)/g)?.length).toBeGreaterThanOrEqual(4);
    expect(migration).toContain("attempt.user_id = current_user_id");
    expect(migration).toContain("unique (attempt_id, answer_id)");
    expect(migration).toContain("select count(*)::integer");
    expect(migration).toContain("where score_submission.attempt_id = attempt.id");
    expect(migration).toContain("'acceptedAt', accepted_time");
  });

  it("seeds one immutable 300-answer category and deterministic challenges", () => {
    const answerSection = migration.match(/insert into private\.category_answers[\s\S]*?;\n\ninsert into private\.category_answer_aliases/)?.[0] ?? "";
    expect(answerSection.match(/'nba-[a-z0-9-]+'/g)).toHaveLength(300);
    expect(migration).toContain("'2026-07-17'::date");
    expect(migration.match(/insert into private\.category_versions/g)).toHaveLength(1);
    expect(migration.match(/insert into public\.daily_challenges/g)).toHaveLength(1);
    expect(scheduleMigration).toContain("'2026-07-18'::date");
    expect(scheduleMigration).toContain("'2026-08-16'::date");
    expect(scheduleMigration).toContain("on conflict (challenge_date) do nothing");
  });

  it("uses unambiguous database timestamps in every corrected RPC", () => {
    expect(rpcFixMigration.match(/create or replace function public\.daily_/g)).toHaveLength(4);
    expect(rpcFixMigration.match(/v_now timestamptz := statement_timestamp\(\)/g)).toHaveLength(4);
    expect(rpcFixMigration).not.toContain("timezone('UTC', current_time)");
  });

  it("covers foreign keys used by cleanup and integrity checks", () => {
    expect(indexMigration).toContain("daily_challenges_category_version_idx");
    expect(indexMigration).toContain("daily_submissions_answer_idx");
  });

  it("makes display names immutable attempt data and exposes only a narrow leaderboard RPC", () => {
    expect(leaderboardMigration).toContain("add column display_name text");
    expect(leaderboardMigration).toContain("char_length(display_name) between 2 and 24");
    expect(leaderboardMigration).toContain("drop function public.daily_start_attempt()");
    expect(leaderboardMigration).toContain("create function public.daily_start_attempt(p_display_name text)");
    expect(leaderboardMigration).toContain("current_attempt.display_name is distinct from normalized_display_name");
    expect(leaderboardMigration).toContain("create or replace function public.daily_get_leaderboard()");
    expect(leaderboardMigration).toContain("limit 10");
    expect(leaderboardMigration).toContain("grant execute on function public.daily_get_leaderboard() to authenticated");
    expect(leaderboardMigration).not.toMatch(/grant\s+select\s+on\s+table\s+public\.daily_attempts/i);
    expect(displayNameControlFixMigration).toContain("p_display_name ~ '[[:cntrl:]]'");
    expect(displayNameControlFixMigration).toContain("revoke all on function private.normalize_daily_display_name(text)");
  });

  it("derives eligible scores, excludes active attempts, and orders ties deterministically", () => {
    expect(leaderboardMigration).toContain("attempt.status in ('completed', 'expired')");
    expect(leaderboardMigration).toContain("attempt.display_name is not null");
    expect(leaderboardMigration).toContain("attempt.verified_score desc");
    expect(leaderboardMigration).toContain("attempt.completed_at asc");
    expect(leaderboardMigration).toContain("attempt.created_at asc");
    expect(leaderboardMigration).toContain("attempt.id asc");
    expect(leaderboardMigration).toContain("count(*)::integer");
    expect(leaderboardMigration).toContain("submission_window_count >= 40");
    expect(leaderboardMigration).toContain("'rate-limited'");
  });

  it("extends the deterministic UTC preview schedule without changing category history", () => {
    expect(leaderboardMigration).toContain("'2026-08-17'::date");
    expect(leaderboardMigration).toContain("'2026-12-31'::date");
    expect(leaderboardMigration).toContain("on conflict (challenge_date) do nothing");
  });

  it("keeps room tables deny-all and exposes only narrow authenticated RPCs", () => {
    expect(roomLobbyMigration).toContain("alter table public.rooms enable row level security");
    expect(roomLobbyMigration).toContain("alter table public.room_players enable row level security");
    expect(roomLobbyMigration).toContain("revoke all on table public.rooms from public, anon, authenticated");
    expect(roomLobbyMigration).toContain("revoke all on table public.room_players from public, anon, authenticated");
    expect(roomLobbyMigration.match(/security definer\nset search_path = ''/g)).toHaveLength(4);
    expect(roomLobbyMigration).toContain("grant execute on function public.room_create(text) to authenticated");
    expect(roomLobbyMigration).toContain("grant execute on function public.room_get_status(text) to authenticated");
    expect(roomLobbyMigration).not.toMatch(/grant\s+(select|insert|update|delete)\s+on\s+(table\s+)?public\.(rooms|room_players)/i);
  });

  it("locks capacity, membership, host start, and server timestamps in the database", () => {
    expect(roomLobbyMigration).toContain("unique (room_id, user_id)");
    expect(roomLobbyMigration).toContain("where is_host;");
    expect(roomLobbyMigration).toContain("for update;");
    expect(roomLobbyMigration).toContain("if player_count >= 8 then");
    expect(roomLobbyMigration).toContain("selected_room.status <> 'waiting'");
    expect(roomLobbyMigration).toContain("current_member.id <> selected_room.host_player_id");
    expect(roomLobbyMigration).toContain("started_at = v_now");
    expect(roomLobbyMigration).toContain("deadline_at = v_now + make_interval");
    expect(roomLobbyMigration).toContain("participant.last_seen_at > p_now - interval '20 seconds'");
    expect(roomHostIndexMigration).toContain("on public.rooms (host_player_id, id)");
  });

  it("uses non-ambiguous codes and hides participant names from outsiders", () => {
    expect(roomLobbyMigration).toContain("^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$");
    expect(roomLobbyMigration).toContain("when member.id is null then '[]'::jsonb");
    expect(roomLobbyMigration).toContain("when member.id is null then null");
    expect(roomLobbyMigration).toContain("left join public.room_players as member");
  });

  it("keeps multiplayer submissions server-owned and active opponent answers hidden", () => {
    expect(roomGameMigration).toContain("create table public.room_submissions");
    expect(roomGameMigration).toContain("unique (player_id, answer_id)");
    expect(roomGameMigration).toContain("revoke all on table public.room_submissions from public, anon, authenticated");
    expect(roomGameMigration).toContain("when ranked.id = member.id or room.status = 'completed'");
    expect(roomGameMigration).toContain("else null");
    expect(roomGameMigration).toContain("selected_room.deadline_at <= v_now");
    expect(roomGameMigration).toContain("submission_window_count >= 40");
    expect(roomGameMigration).not.toMatch(/grant\s+(select|insert|update|delete)\s+on\s+(table\s+)?public\.room_submissions/i);
  });

  it("authorizes private realtime topics by both room membership and owning player", () => {
    expect(roomGameMigration).toContain("on realtime.messages");
    expect(roomGameMigration).toContain("private.room_realtime_authorized");
    expect(roomGameMigration).toContain("and (not p_write or topic_player.user_id = p_user_id)");
    expect(roomGameMigration).toContain("realtime.messages.extension in ('broadcast', 'presence')");
    expect(roomGameMigration).toContain("'board_changed'");
    expect(roomGameMigration).not.toContain("canonicalText', matched_answer.canonical_text,\n      'playerId'");
  });

  it("covers the composite room submission player foreign key", () => {
    expect(roomSubmissionIndexMigration).toContain("on public.room_submissions (player_id, room_id)");
  });

  it("keeps realtime authorization callable without granting private-schema usage", () => {
    expect(roomRealtimeFixMigration).toContain("create or replace function public.room_realtime_authorized");
    expect(roomRealtimeFixMigration).toContain("and (not p_write or topic_player.user_id = auth.uid())");
    expect(roomRealtimeFixMigration).toContain("drop function private.room_realtime_authorized");
    expect(roomRealtimeFixMigration).not.toContain("grant usage on schema private");
  });

  it("uses one database-owned canonical claim per elimination room", () => {
    expect(eliminationMigration).toContain("mode in ('private_race', 'elimination')");
    expect(eliminationMigration).toContain("create table public.room_answer_claims");
    expect(eliminationMigration).toContain("primary key (room_id, answer_id)");
    expect(eliminationMigration).toContain("on conflict (room_id, answer_id) do nothing");
    expect(eliminationMigration).toContain("claim_owner_id is distinct from current_player.id");
    expect(eliminationMigration).toContain("'status', 'already-taken'");
  });

  it("keeps claims deny-all and preserves private-race creation", () => {
    expect(eliminationMigration).toContain("alter table public.room_answer_claims enable row level security");
    expect(eliminationMigration).toContain("revoke all on table public.room_answer_claims from public, anon, authenticated");
    expect(eliminationMigration).toContain("created_payload := public.room_create(p_display_name)");
    expect(eliminationMigration).toContain("grant execute on function public.room_create(text, text) to authenticated");
    expect(eliminationMigration).not.toMatch(/grant\s+(select|insert|update|delete)\s+on\s+(table\s+)?public\.room_answer_claims/i);
  });
});
