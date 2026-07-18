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
});
