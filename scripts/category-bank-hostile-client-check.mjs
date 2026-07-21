import assert from "node:assert/strict";
import { createInterface } from "node:readline/promises";

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !publishableKey) throw new Error("Public Supabase test configuration is required.");

function client() {
  return createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
}

async function signIn(entry) {
  const { data, error } = await entry.auth.signInAnonymously();
  assert.ifError(error);
  assert.ok(data.user?.is_anonymous);
  return data.user.id;
}

async function assertDenied(label, operation, expectedCode) {
  const { error } = await operation();
  assert.ok(error, `${label} unexpectedly succeeded.`);
  if (expectedCode) assert.equal(error.code, expectedCode, `${label} returned the wrong error.`);
}

const owner = client();
const reviewer = client();
const outsider = client();
const [ownerId, reviewerId] = await Promise.all([signIn(owner), signIn(reviewer), signIn(outsider)])
  .then(([ownerUserId, reviewerUserId]) => [ownerUserId, reviewerUserId]);

for (const table of ["category_answer_bank_versions", "category_answer_bank_answers", "category_answer_bank_aliases"]) {
  await assertDenied(`direct ${table} read`, () => reviewer.schema("private").from(table).select("*"));
}
await assertDenied("outsider bank queue", () => outsider.rpc("category_bank_queue"), "42501");

const runId = String(Date.now()).slice(-8);
const { data: draft, error: createError } = await owner.rpc("category_create_draft", {
  p_prompt: `How many bank QA ${runId} capitals can you name?`,
  p_source_notes: `Official bank QA source ${runId}`,
  p_coverage_notes: `Explicit bank QA coverage ${runId}`,
});
assert.ifError(createError);
const { error: submitError } = await owner.rpc("category_submit_draft", { p_draft_id: draft.id });
assert.ifError(submitError);

console.log(`BANK_QA_DRAFT_ID=${draft.id}`);
console.log(`REVIEWER_USER_ID=${reviewerId}`);
console.log("Promote this isolated QA identity in the private reviewer allowlist, then send a newline.");
const input = createInterface({ input: process.stdin, output: process.stdout });
await input.question("");
input.close();

const { data: decision, error: decisionError } = await reviewer.rpc("category_review_decide", {
  p_draft_id: draft.id,
  p_decision: "scope-approve",
  p_note: "The QA scope is clear enough for private answer-bank validation.",
});
assert.ifError(decisionError);
assert.equal(decision.reviewStatus, "scope-approved");

await assertDenied("owner bank queue", () => owner.rpc("category_bank_queue"), "42501");
await assertDenied("outsider bank open", () => outsider.rpc("category_bank_open", { p_draft_id: draft.id }), "42501");

const { data: queue, error: queueError } = await reviewer.rpc("category_bank_queue");
assert.ifError(queueError);
const queued = queue.drafts.find((item) => item.draftId === draft.id);
assert.ok(queued);
assert.equal(queued.status, "not-started");
assert.equal(queued.revision, 0);
assert.equal(queued.bank, null);
assert.equal("userId" in queued, false);

const { data: opened, error: openError } = await reviewer.rpc("category_bank_open", { p_draft_id: draft.id });
assert.ifError(openError);
assert.equal(opened.revision, 1);
assert.equal(opened.status, "editing");
assert.equal(opened.competitiveEligible, false);

const metadata = {
  p_draft_id: draft.id,
  p_snapshot_date: "2026-07-21",
  p_time_limit_seconds: 90,
  p_source_label: "Official QA geographic list",
  p_source_url: "https://example.org/qa-source",
  p_version_note: "Initial private QA answer-bank snapshot.",
};

await assertDenied("accent collision", () => reviewer.rpc("category_bank_save", {
  ...metadata,
  p_answers: [{ canonicalText: "Luka Dončić", aliases: ["Luka Doncic"] }],
}), "22023");
await assertDenied("cross-answer collision", () => reviewer.rpc("category_bank_save", {
  ...metadata,
  p_answers: [
    { canonicalText: "Copenhagen", aliases: ["København"] },
    { canonicalText: "Lisbon", aliases: ["København"] },
  ],
}), "22023");

const firstAnswers = [
  { canonicalText: "Copenhagen", aliases: ["København"] },
  { canonicalText: "Lisbon", aliases: ["Lisboa"] },
  { canonicalText: "Prague", aliases: ["Praha"] },
];
const { data: saved, error: saveError } = await reviewer.rpc("category_bank_save", {
  ...metadata,
  p_answers: firstAnswers,
});
assert.ifError(saveError);
assert.deepEqual(saved.answers, firstAnswers);
assert.equal(saved.status, "editing");

const { data: frozen, error: freezeError } = await reviewer.rpc("category_bank_freeze", { p_draft_id: draft.id });
assert.ifError(freezeError);
assert.equal(frozen.status, "review-ready");
assert.ok(frozen.submittedAt);
assert.equal(frozen.competitiveEligible, false);
await assertDenied("frozen revision overwrite", () => reviewer.rpc("category_bank_save", {
  ...metadata,
  p_answers: firstAnswers,
}), "55000");

const { data: revision, error: revisionError } = await reviewer.rpc("category_bank_start_revision", { p_draft_id: draft.id });
assert.ifError(revisionError);
assert.equal(revision.revision, 2);
assert.equal(revision.status, "editing");
assert.deepEqual(revision.answers, firstAnswers);
await assertDenied("parallel editing revision", () => reviewer.rpc("category_bank_start_revision", { p_draft_id: draft.id }), "55000");

const correctedAnswers = [...firstAnswers, { canonicalText: "Vienna", aliases: ["Wien"] }];
const { data: corrected, error: correctedError } = await reviewer.rpc("category_bank_save", {
  ...metadata,
  p_version_note: "Second private QA snapshot adds the documented correction.",
  p_answers: correctedAnswers,
});
assert.ifError(correctedError);
assert.equal(corrected.revision, 2);
assert.deepEqual(corrected.answers, correctedAnswers);

const { data: ownerDrafts, error: ownerDraftsError } = await owner.rpc("category_list_drafts");
assert.ifError(ownerDraftsError);
const ownerProjection = ownerDrafts.drafts.find((item) => item.id === draft.id);
assert.ok(ownerProjection);
assert.equal("answers" in ownerProjection, false);
assert.equal("bank" in ownerProjection, false);
assert.equal(ownerProjection.competitiveEligible, false);

const { data: discovery, error: discoveryError } = await owner.rpc("category_discover", { p_query: `bank QA ${runId}` });
assert.ifError(discoveryError);
assert.deepEqual(discovery.categories, []);

await Promise.all([owner.auth.signOut(), reviewer.auth.signOut(), outsider.auth.signOut()]);

console.log(`CATEGORY_BANK_QA_OWNER=${ownerId}`);
console.log("Category bank hostile-client checks passed: deny-all tables, reviewer-only RPCs, approved non-owned scope, deterministic collisions, immutable freeze, copied correction revisions, owner privacy, noncompetitive state, and discovery exclusion.");
