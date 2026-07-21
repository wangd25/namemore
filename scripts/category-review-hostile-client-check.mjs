import assert from "node:assert/strict";
import { createInterface } from "node:readline/promises";

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !publishableKey) {
  throw new Error("Public Supabase test configuration is required.");
}

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

function draftInput(runId, label) {
  return {
    p_prompt: `How many review QA ${runId} ${label} answers can you name?`,
    p_source_notes: `Official review QA source ${runId} ${label}`,
    p_coverage_notes: `Explicit review QA coverage ${runId} ${label}`,
  };
}

const owner = client();
const reviewer = client();
const outsider = client();
const [ownerId, reviewerId] = await Promise.all([signIn(owner), signIn(reviewer), signIn(outsider)])
  .then(([ownerUserId, reviewerUserId]) => [ownerUserId, reviewerUserId]);

await assertDenied("direct reviewer allowlist read", () =>
  reviewer.schema("private").from("category_reviewers").select("*"));
await assertDenied("direct review event read", () =>
  reviewer.schema("private").from("category_draft_reviews").select("*"));

const runId = String(Date.now()).slice(-8);
const { data: ownerDraft, error: ownerCreateError } = await owner.rpc(
  "category_create_draft",
  draftInput(runId, "owner"),
);
assert.ifError(ownerCreateError);
const { data: ownerSubmitted, error: ownerSubmitError } = await owner.rpc(
  "category_submit_draft",
  { p_draft_id: ownerDraft.id },
);
assert.ifError(ownerSubmitError);
assert.equal(ownerSubmitted.reviewRevision, 1);

const { data: outsiderStatus, error: outsiderStatusError } = await outsider.rpc("category_reviewer_status");
assert.ifError(outsiderStatusError);
assert.equal(outsiderStatus.authorized, false);
await assertDenied("outsider queue read", () => outsider.rpc("category_review_queue"), "42501");
await assertDenied(
  "outsider decision",
  () => outsider.rpc("category_review_decide", {
    p_draft_id: ownerDraft.id,
    p_decision: "reject",
    p_note: "This unauthorized decision must never be recorded.",
  }),
  "42501",
);

console.log(`REVIEWER_USER_ID=${reviewerId}`);
console.log("Promote this isolated QA identity in the private reviewer allowlist, then send a newline.");
const input = createInterface({ input: process.stdin, output: process.stdout });
await input.question("");
input.close();

const { data: reviewerStatus, error: reviewerStatusError } = await reviewer.rpc("category_reviewer_status");
assert.ifError(reviewerStatusError);
assert.equal(reviewerStatus.authorized, true);

const { data: queue, error: queueError } = await reviewer.rpc("category_review_queue");
assert.ifError(queueError);
const queuedOwnerDraft = queue.drafts.find((draft) => draft.id === ownerDraft.id);
assert.ok(queuedOwnerDraft);
assert.equal(queuedOwnerDraft.reviewRevision, 1);
assert.equal("userId" in queuedOwnerDraft, false);
assert.equal("competitiveEligible" in queuedOwnerDraft, false);

const { data: reviewerDraft, error: reviewerCreateError } = await reviewer.rpc(
  "category_create_draft",
  draftInput(runId, "reviewer-owned"),
);
assert.ifError(reviewerCreateError);
const { error: reviewerSubmitError } = await reviewer.rpc("category_submit_draft", {
  p_draft_id: reviewerDraft.id,
});
assert.ifError(reviewerSubmitError);
const { data: queueAfterSelfSubmit, error: queueAfterSelfSubmitError } = await reviewer.rpc("category_review_queue");
assert.ifError(queueAfterSelfSubmitError);
assert.equal(queueAfterSelfSubmit.drafts.some((draft) => draft.id === reviewerDraft.id), false);
await assertDenied(
  "reviewer self-decision",
  () => reviewer.rpc("category_review_decide", {
    p_draft_id: reviewerDraft.id,
    p_decision: "scope-approve",
    p_note: "A reviewer cannot decide their own submitted draft.",
  }),
  "22023",
);
await assertDenied(
  "invalid decision value",
  () => reviewer.rpc("category_review_decide", {
    p_draft_id: ownerDraft.id,
    p_decision: "publish",
    p_note: "Publishing is not a valid review decision in this phase.",
  }),
  "22023",
);

const changeNote = "Clarify the geographic boundary before the next review submission.";
const { data: changeDecision, error: changeDecisionError } = await reviewer.rpc(
  "category_review_decide",
  { p_draft_id: ownerDraft.id, p_decision: "request-changes", p_note: changeNote },
);
assert.ifError(changeDecisionError);
assert.equal(changeDecision.reviewStatus, "changes-requested");
await assertDenied(
  "duplicate review decision",
  () => reviewer.rpc("category_review_decide", {
    p_draft_id: ownerDraft.id,
    p_decision: "reject",
    p_note: "A completed revision cannot receive a second decision.",
  }),
  "55000",
);

const { data: ownerAfterChanges, error: ownerAfterChangesError } = await owner.rpc("category_list_drafts");
assert.ifError(ownerAfterChangesError);
const changedDraft = ownerAfterChanges.drafts.find((draft) => draft.id === ownerDraft.id);
assert.equal(changedDraft.status, "draft");
assert.equal(changedDraft.reviewStatus, "changes-requested");
assert.equal(changedDraft.latestReview.note, changeNote);
assert.equal("reviewerUserId" in changedDraft.latestReview, false);

const { data: updatedDraft, error: updateError } = await owner.rpc("category_update_draft", {
  p_draft_id: ownerDraft.id,
  ...draftInput(runId, "owner-revised"),
});
assert.ifError(updateError);
assert.equal(updatedDraft.reviewStatus, "changes-requested");
const { data: resubmittedDraft, error: resubmitError } = await owner.rpc("category_submit_draft", {
  p_draft_id: ownerDraft.id,
});
assert.ifError(resubmitError);
assert.equal(resubmittedDraft.reviewRevision, 2);
assert.equal(resubmittedDraft.reviewStatus, "pending");

const approvalNote = "The revised scope is clear enough for internal answer-bank work.";
const { data: approval, error: approvalError } = await reviewer.rpc("category_review_decide", {
  p_draft_id: ownerDraft.id,
  p_decision: "scope-approve",
  p_note: approvalNote,
});
assert.ifError(approvalError);
assert.equal(approval.reviewStatus, "scope-approved");
assert.equal(approval.reviewRevision, 2);

const { data: ownerFinal, error: ownerFinalError } = await owner.rpc("category_list_drafts");
assert.ifError(ownerFinalError);
const approvedDraft = ownerFinal.drafts.find((draft) => draft.id === ownerDraft.id);
assert.equal(approvedDraft.status, "review-complete");
assert.equal(approvedDraft.reviewStatus, "scope-approved");
assert.equal(approvedDraft.competitiveEligible, false);
assert.equal(approvedDraft.latestReview.note, approvalNote);

const { data: discovery, error: discoveryError } = await owner.rpc("category_discover", {
  p_query: `review QA ${runId}`,
});
assert.ifError(discoveryError);
assert.deepEqual(discovery.categories, []);

await Promise.all([owner.auth.signOut(), reviewer.auth.signOut(), outsider.auth.signOut()]);

console.log(`CATEGORY_REVIEW_QA_OWNER=${ownerId}`);
console.log("Category review hostile-client checks passed: explicit reviewer authorization, deny-all tables, ordinary-user denial, self-review prevention, snapshot decisions, revision-safe resubmission, owner-visible reasons, noncompetitive approval, and discovery privacy.");
