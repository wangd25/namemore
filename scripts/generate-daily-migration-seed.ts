import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { currentNbaPlayersCategory } from "../lib/categories";
import { buildAnswerLookup } from "../lib/game-logic";

const categoryVersionId = "11111111-1111-4111-8111-111111111111";
const challengeId = "22222222-2222-4222-8222-222222222222";
const seedStart = "-- BEGIN GENERATED NBA SEED";
const seedEnd = "-- END GENERATED NBA SEED";

function sqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function stableUuid(value: string): string {
  const bytes = Buffer.from(createHash("sha256").update(value).digest().subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function buildSeedSql(): string {
  const category = currentNbaPlayersCategory;
  const answerRows = category.answers.map((answer, index) => {
    const answerId = stableUuid(`${category.slug}:${category.version}:${answer.id}`);
    return `  ('${answerId}', '${categoryVersionId}', ${sqlString(answer.id)}, ${sqlString(answer.canonicalText)}, ${sqlString(answer.teamCode)}, ${index})`;
  });
  const answerIds = new Map(
    category.answers.map((answer) => [
      answer.id,
      stableUuid(`${category.slug}:${category.version}:${answer.id}`),
    ]),
  );
  const aliasRows = [...buildAnswerLookup(category.answers).entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([alias, answer]) =>
      `  ('${categoryVersionId}', ${sqlString(alias)}, '${answerIds.get(answer.id)}')`,
    );

  return [
    seedStart,
    "insert into private.category_versions (id, slug, version, snapshot_date, title, prompt, time_limit_seconds)",
    "values (",
    `  '${categoryVersionId}',`,
    `  ${sqlString(category.slug)},`,
    `  ${category.version},`,
    `  ${sqlString(category.snapshotDate)}::date,`,
    `  ${sqlString(category.title)},`,
    `  ${sqlString(category.prompt)},`,
    `  ${category.timeLimitSeconds}`,
    ");",
    "",
    "insert into private.category_answers (id, category_version_id, stable_id, canonical_text, team_code, sort_order)",
    "values",
    `${answerRows.join(",\n")};`,
    "",
    "insert into private.category_answer_aliases (category_version_id, normalized_alias, answer_id)",
    "values",
    `${aliasRows.join(",\n")};`,
    "",
    "insert into public.daily_challenges (id, challenge_date, category_version_id, is_active)",
    `values ('${challengeId}', '2026-07-17'::date, '${categoryVersionId}', true);`,
    seedEnd,
  ].join("\n");
}

const migrationPath = process.argv[2];

if (!migrationPath) {
  throw new Error("Pass the migration path to update.");
}

const absolutePath = resolve(migrationPath);
const migration = readFileSync(absolutePath, "utf8");
const startIndex = migration.indexOf(seedStart);
const endIndex = migration.indexOf(seedEnd);

if (startIndex < 0 || endIndex < startIndex) {
  throw new Error("Migration seed markers are missing or out of order.");
}

const updated = `${migration.slice(0, startIndex)}${buildSeedSql()}${migration.slice(endIndex + seedEnd.length)}`;
writeFileSync(absolutePath, updated);
