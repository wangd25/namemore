import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const retentionMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260721232749_add_phase8b_retention_dry_run.sql",
  ),
  "utf8",
);

describe("Phase 8B retention dry run", () => {
  it("returns aggregate candidates without creating a deletion path", () => {
    expect(retentionMigration).toContain(
      "create or replace function private.retention_dry_run",
    );
    expect(retentionMigration).toContain("'mode', 'dry-run'");
    expect(retentionMigration).toContain("'candidateCounts'");
    expect(retentionMigration).not.toMatch(/\bdelete\s+from\b/i);
    expect(retentionMigration).not.toMatch(/\bcron\.schedule\b/i);
    expect(retentionMigration).not.toMatch(/create\s+(or\s+replace\s+)?function\s+public\./i);
  });

  it("protects durable gameplay and category ownership references", () => {
    expect(retentionMigration).toContain("from public.daily_attempts as attempt");
    expect(retentionMigration).toContain("from public.room_players as player");
    expect(retentionMigration).toContain("from private.category_drafts as draft");
    expect(retentionMigration).toContain(
      "from private.category_answer_bank_publications as publication",
    );
    expect(retentionMigration).toContain("from private.category_reports as report");
    expect(retentionMigration).toContain("'preservedCounts'");
  });

  it("is private, read-only, and unavailable to browser roles", () => {
    expect(retentionMigration).toContain("language sql\nstable\nset search_path = ''");
    expect(retentionMigration).toContain(
      "revoke all on function private.retention_dry_run(timestamptz)",
    );
    expect(retentionMigration).toContain("from public, anon, authenticated");
    expect(retentionMigration).not.toMatch(/grant\s+execute/i);
  });
});
