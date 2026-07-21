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
const categoryDiscoveryMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260720200748_add_phase7_category_discovery.sql"),
  "utf8",
);
const reviewedElementsMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260720222224_add_phase7b_reviewed_elements_practice.sql"),
  "utf8",
);
const privateDraftReviewMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260720225651_add_phase7c_private_draft_review.sql"),
  "utf8",
);
const reviewerAuthorityMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260721061214_add_phase7c2_reviewer_authority.sql"),
  "utf8",
);
const answerBankVersionsMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260721172046_add_phase7c3_versioned_answer_banks.sql"),
  "utf8",
);
const answerBankIndexMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260721173323_add_phase7c3_bank_foreign_key_indexes.sql"),
  "utf8",
);
const answerBankReviewMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260721180113_add_phase7c4_answer_bank_review_decisions.sql"),
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

  it("keeps discovery and draft storage private behind narrow authenticated RPCs", () => {
    expect(categoryDiscoveryMigration).toContain("alter table private.category_discovery_items enable row level security");
    expect(categoryDiscoveryMigration).toContain("alter table private.category_drafts enable row level security");
    expect(categoryDiscoveryMigration).toContain("revoke all on table private.category_drafts from public, anon, authenticated");
    expect(categoryDiscoveryMigration.match(/security definer\nset search_path = ''/g)).toHaveLength(2);
    expect(categoryDiscoveryMigration).toContain("grant execute on function public.category_discover(text) to authenticated");
    expect(categoryDiscoveryMigration).toContain("grant execute on function public.category_create_draft(text, text, text) to authenticated");
    expect(categoryDiscoveryMigration).not.toMatch(/grant\s+(select|insert|update|delete)\s+on\s+(table\s+)?private\./i);
  });

  it("uses only reviewed banks for play and only real thresholded ambient metrics", () => {
    expect(categoryDiscoveryMigration).toContain("review_status = 'reviewed' and category_version_id is not null");
    expect(categoryDiscoveryMigration).toContain("availability <> 'daily' or (review_status = 'reviewed' and competitive_eligible)");
    expect(categoryDiscoveryMigration).toContain("having count(*) >= 3");
    expect(categoryDiscoveryMigration).toContain("attempt.status in ('completed', 'expired')");
    expect(categoryDiscoveryMigration).toContain("room.deadline_at > v_now");
    expect(categoryDiscoveryMigration).not.toContain("raw_answer");
  });

  it("forces created categories to remain bounded private unreviewed drafts", () => {
    expect(categoryDiscoveryMigration).toContain("review_status text not null default 'unreviewed' check (review_status = 'unreviewed')");
    expect(categoryDiscoveryMigration).toContain("competitive_eligible boolean not null default false check (not competitive_eligible)");
    expect(categoryDiscoveryMigration).toContain("recent_draft.created_at > v_now - interval '1 hour'");
    expect(categoryDiscoveryMigration).toContain(") >= 5 then");
    expect(categoryDiscoveryMigration).toContain("p_prompt ~ '[[:cntrl:]]'");
  });

  it("adds a reviewed 118-element practice bank without widening table access", () => {
    expect(reviewedElementsMigration).toContain("alter column team_code drop not null");
    expect(reviewedElementsMigration).toContain("add column visual_label text");
    expect(reviewedElementsMigration).toContain("add column group_ids text[]");
    expect(reviewedElementsMigration).toContain("availability in ('daily', 'practice', 'practice-planned')");
    expect(reviewedElementsMigration).toContain("'chemical-elements'");
    expect(reviewedElementsMigration).toContain("'2022-05-04'::date");
    expect(reviewedElementsMigration).toContain("Expected 118 chemical elements.");
    expect(reviewedElementsMigration).toContain("Expected 240 chemical element aliases.");
    expect(reviewedElementsMigration).not.toMatch(/grant\s+(select|insert|update|delete)/i);
  });

  it("keeps draft editing owner-only and review requests noncompetitive", () => {
    expect(privateDraftReviewMigration).toContain("status in ('draft', 'review-requested')");
    expect(privateDraftReviewMigration).toContain("review_status in ('unreviewed', 'pending')");
    expect(privateDraftReviewMigration).toContain("and draft.user_id = current_user_id");
    expect(privateDraftReviewMigration).toContain("and draft.status = 'draft'");
    expect(privateDraftReviewMigration).toContain("status = 'review-requested'");
    expect(privateDraftReviewMigration).toContain("review_status = 'pending'");
    expect(privateDraftReviewMigration).toContain("limit 50");
    expect(privateDraftReviewMigration.match(/security definer\nset search_path = ''/g)).toHaveLength(4);
    expect(privateDraftReviewMigration).toContain("grant execute on function public.category_list_drafts() to authenticated");
    expect(privateDraftReviewMigration).toContain("grant execute on function public.category_update_draft(uuid, text, text, text) to authenticated");
    expect(privateDraftReviewMigration).toContain("grant execute on function public.category_submit_draft(uuid) to authenticated");
    expect(privateDraftReviewMigration).not.toMatch(/grant\s+(select|insert|update|delete)/i);
    expect(privateDraftReviewMigration).not.toContain("competitive_eligible = true");
  });

  it("adds deny-all reviewer authority and append-only snapshot decisions", () => {
    expect(reviewerAuthorityMigration).toContain("create table private.category_reviewers");
    expect(reviewerAuthorityMigration).toContain("create table private.category_draft_reviews");
    expect(reviewerAuthorityMigration).toContain("unique (draft_id, review_revision)");
    expect(reviewerAuthorityMigration).toContain("prompt_snapshot text not null");
    expect(reviewerAuthorityMigration).toContain("competitive_eligible boolean not null default false check (not competitive_eligible)");
    expect(reviewerAuthorityMigration).toContain("revoke all on table private.category_reviewers from public, anon, authenticated");
    expect(reviewerAuthorityMigration).toContain("revoke all on table private.category_draft_reviews from public, anon, authenticated");
    expect(reviewerAuthorityMigration).not.toMatch(/grant\s+(select|insert|update|delete)/i);
  });

  it("requires an active reviewer, prevents self-review, and preserves non-publishing outcomes", () => {
    expect(reviewerAuthorityMigration).toContain("where reviewer.user_id = current_user_id");
    expect(reviewerAuthorityMigration).toContain("and reviewer.active");
    expect(reviewerAuthorityMigration).toContain("and draft.user_id <> current_user_id");
    expect(reviewerAuthorityMigration).toContain("for update;");
    expect(reviewerAuthorityMigration).toContain("decision in ('request-changes', 'reject', 'scope-approve')");
    expect(reviewerAuthorityMigration).toContain("review_status = next_review_status");
    expect(reviewerAuthorityMigration).toContain("review_revision = draft.review_revision + 1");
    expect(reviewerAuthorityMigration).not.toContain("competitive_eligible = true");
    expect(reviewerAuthorityMigration).not.toMatch(/insert into private\.category_(versions|answers|answer_aliases|discovery_items)/i);
  });

  it("exposes only narrow authenticated reviewer RPCs with safe search paths", () => {
    expect(reviewerAuthorityMigration.match(/security definer\nset search_path = ''/g)).toHaveLength(7);
    expect(reviewerAuthorityMigration).toContain("grant execute on function public.category_reviewer_status() to authenticated");
    expect(reviewerAuthorityMigration).toContain("grant execute on function public.category_review_queue() to authenticated");
    expect(reviewerAuthorityMigration).toContain("grant execute on function public.category_review_decide(uuid, text, text) to authenticated");
    expect(reviewerAuthorityMigration).toContain("revoke all on function public.category_review_decide(uuid, text, text) from public, anon, authenticated");
  });

  it("adds deny-all versioned bank storage with immutable review-ready snapshots", () => {
    expect(answerBankVersionsMigration).toContain("create table private.category_answer_bank_versions");
    expect(answerBankVersionsMigration).toContain("create table private.category_answer_bank_answers");
    expect(answerBankVersionsMigration).toContain("create table private.category_answer_bank_aliases");
    expect(answerBankVersionsMigration).toContain("unique (category_draft_id, revision)");
    expect(answerBankVersionsMigration).toContain("where status = 'editing'");
    expect(answerBankVersionsMigration).toContain("status = 'review-ready', updated_at = v_now, submitted_at = v_now");
    expect(answerBankVersionsMigration).toContain("competitive_eligible boolean not null default false check (not competitive_eligible)");
    expect(answerBankVersionsMigration).not.toMatch(/grant\s+(select|insert|update|delete)/i);
  });

  it("normalizes and collision-checks all canonical answers and aliases on the server", () => {
    expect(answerBankVersionsMigration).toContain("create extension if not exists unaccent with schema extensions");
    expect(answerBankVersionsMigration).toContain("create function private.category_bank_normalize(p_value text)");
    expect(answerBankVersionsMigration).toContain("normalize(p_value, NFKD)");
    expect(answerBankVersionsMigration).toContain("normalized_value = any(seen_values)");
    expect(answerBankVersionsMigration).toContain("primary key (bank_version_id, normalized_alias)");
    expect(answerBankVersionsMigration).toContain("jsonb_array_length(p_answers) not between 1 and 500");
    expect(answerBankVersionsMigration).toContain("jsonb_array_length(answer_value -> 'aliases') > 20");
  });

  it("requires reviewer authority and approved non-owned scope for narrow bank RPCs", () => {
    expect(answerBankVersionsMigration.match(/security definer\nset search_path = ''/g)).toHaveLength(5);
    expect(answerBankVersionsMigration.match(/where reviewer\.user_id = current_user_id and reviewer\.active/g)).toHaveLength(5);
    expect(answerBankVersionsMigration).toContain("draft.user_id <> current_user_id");
    expect(answerBankVersionsMigration).toContain("draft.review_status = 'scope-approved'");
    expect(answerBankVersionsMigration).toContain("grant execute on function public.category_bank_queue() to authenticated");
    expect(answerBankVersionsMigration).toContain("grant execute on function public.category_bank_save(uuid, date, integer, text, text, text, jsonb) to authenticated");
    expect(answerBankVersionsMigration).not.toContain("competitive_eligible = true");
    expect(answerBankVersionsMigration).not.toMatch(/insert into private\.category_(versions|answers|answer_aliases|discovery_items)/i);
  });

  it("covers the answer-bank foreign keys used by revision copying and ownership cleanup", () => {
    expect(answerBankIndexMigration).toContain("category_answer_bank_aliases_answer_idx");
    expect(answerBankIndexMigration).toContain("category_answer_bank_versions_editor_idx");
  });

  it("adds deny-all append-only decisions for frozen answer-bank revisions", () => {
    expect(answerBankReviewMigration).toContain("create table private.category_answer_bank_reviews");
    expect(answerBankReviewMigration).toContain("unique (bank_version_id)");
    expect(answerBankReviewMigration).toContain("answers_snapshot jsonb not null");
    expect(answerBankReviewMigration).toContain("decision in ('request-correction', 'reject', 'approve')");
    expect(answerBankReviewMigration).toContain("revoke all on table private.category_answer_bank_reviews from public, anon, authenticated");
    expect(answerBankReviewMigration).not.toMatch(/grant\s+(select|insert|update|delete)/i);
  });

  it("requires an independent reviewer and never widens approval into publication", () => {
    expect(answerBankReviewMigration).toContain("version.editor_user_id <> current_user_id");
    expect(answerBankReviewMigration).toContain("draft.user_id <> current_user_id");
    expect(answerBankReviewMigration).toContain("selected_version.editor_user_id = current_user_id");
    expect(answerBankReviewMigration).toContain("selected_version.bank_review_status <> 'pending'");
    expect(answerBankReviewMigration).toContain("bank_review_status = next_review_status");
    expect(answerBankReviewMigration).toContain("competitiveEligible', false");
    expect(answerBankReviewMigration).not.toContain("competitive_eligible = true");
    expect(answerBankReviewMigration).not.toMatch(/insert into private\.category_(versions|answers|answer_aliases|discovery_items)/i);
  });

  it("allows correction copies only after a request and exposes two narrow authenticated RPCs", () => {
    expect(answerBankReviewMigration).toContain("source_version.bank_review_status <> 'changes-requested'");
    expect(answerBankReviewMigration).toContain("source_version.editor_user_id <> current_user_id");
    expect(answerBankReviewMigration).toContain("grant execute on function public.category_bank_review_queue() to authenticated");
    expect(answerBankReviewMigration).toContain("grant execute on function public.category_bank_review_decide(uuid, text, text) to authenticated");
    expect(answerBankReviewMigration.match(/security definer\nset search_path = ''/g)).toHaveLength(5);
  });
});
