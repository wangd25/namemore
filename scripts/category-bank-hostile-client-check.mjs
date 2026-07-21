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
const editor = client();
const decider = client();
const publisher = client();
const outsider = client();
const [ownerId, editorId, deciderId, publisherId, outsiderId] = await Promise.all([
  signIn(owner),
  signIn(editor),
  signIn(decider),
  signIn(publisher),
  signIn(outsider),
]);

for (const table of ["category_answer_bank_versions", "category_answer_bank_answers", "category_answer_bank_aliases", "category_answer_bank_reviews", "category_publishers", "category_answer_bank_publications", "category_publication_correction_requests"]) {
  await assertDenied(`direct ${table} read`, () => editor.schema("private").from(table).select("*"));
}
await assertDenied("outsider bank queue", () => outsider.rpc("category_bank_queue"), "42501");
await assertDenied("outsider bank review queue", () => outsider.rpc("category_bank_review_queue"), "42501");
await assertDenied("outsider publication queue", () => outsider.rpc("category_publication_queue"), "42501");
const { data: outsiderPublisherStatus, error: outsiderPublisherStatusError } = await outsider.rpc("category_publisher_status");
assert.ifError(outsiderPublisherStatusError);
assert.equal(outsiderPublisherStatus.authorized, false);

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
console.log(`BANK_EDITOR_USER_ID=${editorId}`);
console.log(`BANK_DECIDER_USER_ID=${deciderId}`);
console.log(`BANK_PUBLISHER_USER_ID=${publisherId}`);
console.log(`BANK_OWNER_USER_ID=${ownerId}`);
console.log(`BANK_OUTSIDER_USER_ID=${outsiderId}`);
console.log("Promote editor and decider in the private reviewer allowlist. Promote owner, editor, decider, and publisher in the private publisher allowlist. Then send a newline.");
const input = createInterface({ input: process.stdin, output: process.stdout });
await input.question("");
input.close();

const { data: decision, error: decisionError } = await editor.rpc("category_review_decide", {
  p_draft_id: draft.id,
  p_decision: "scope-approve",
  p_note: "The QA scope is clear enough for private answer-bank validation.",
});
assert.ifError(decisionError);
assert.equal(decision.reviewStatus, "scope-approved");

await assertDenied("owner bank queue", () => owner.rpc("category_bank_queue"), "42501");
await assertDenied("outsider bank open", () => outsider.rpc("category_bank_open", { p_draft_id: draft.id }), "42501");

const { data: queue, error: queueError } = await editor.rpc("category_bank_queue");
assert.ifError(queueError);
const queued = queue.drafts.find((item) => item.draftId === draft.id);
assert.ok(queued);
assert.equal(queued.status, "not-started");
assert.equal(queued.revision, 0);
assert.equal(queued.bank, null);
assert.equal("userId" in queued, false);

const { data: opened, error: openError } = await editor.rpc("category_bank_open", { p_draft_id: draft.id });
assert.ifError(openError);
assert.equal(opened.revision, 1);
assert.equal(opened.status, "editing");
assert.equal(opened.reviewStatus, "unreviewed");
assert.equal(opened.competitiveEligible, false);

const metadata = {
  p_draft_id: draft.id,
  p_snapshot_date: "2026-07-21",
  p_time_limit_seconds: 90,
  p_source_label: "Official QA geographic list",
  p_source_url: "https://example.org/qa-source",
  p_version_note: "Initial private QA answer-bank snapshot.",
};

await assertDenied("accent collision", () => editor.rpc("category_bank_save", {
  ...metadata,
  p_answers: [{ canonicalText: "Luka Dončić", aliases: ["Luka Doncic"] }],
}), "22023");
await assertDenied("cross-answer collision", () => editor.rpc("category_bank_save", {
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
const { data: saved, error: saveError } = await editor.rpc("category_bank_save", {
  ...metadata,
  p_answers: firstAnswers,
});
assert.ifError(saveError);
assert.deepEqual(saved.answers, firstAnswers);
assert.equal(saved.status, "editing");

const { data: frozen, error: freezeError } = await editor.rpc("category_bank_freeze", { p_draft_id: draft.id });
assert.ifError(freezeError);
assert.equal(frozen.status, "review-ready");
assert.ok(frozen.submittedAt);
assert.equal(frozen.reviewStatus, "pending");
assert.equal(frozen.latestReview, null);
assert.equal(frozen.competitiveEligible, false);
await assertDenied("frozen revision overwrite", () => editor.rpc("category_bank_save", {
  ...metadata,
  p_answers: firstAnswers,
}), "55000");

if (process.env.BANK_QA_FREEZE_ONLY === "1") {
  await Promise.all([owner.auth.signOut(), editor.auth.signOut(), decider.auth.signOut(), publisher.auth.signOut(), outsider.auth.signOut()]);
  console.log("BANK_QA_FROZEN_FOR_BROWSER=1");
  process.exit(0);
}

await assertDenied("editor self-decision", () => editor.rpc("category_bank_review_decide", {
  p_draft_id: draft.id,
  p_decision: "approve",
  p_note: "The editor must not approve their own frozen answer bank.",
}), "55000");
await assertDenied("owner decision", () => owner.rpc("category_bank_review_decide", {
  p_draft_id: draft.id,
  p_decision: "approve",
  p_note: "The category owner must not approve their own answer bank.",
}), "42501");
await assertDenied("premature correction copy", () => editor.rpc("category_bank_start_revision", { p_draft_id: draft.id }), "55000");

const { data: reviewQueue, error: reviewQueueError } = await decider.rpc("category_bank_review_queue");
assert.ifError(reviewQueueError);
const pendingBank = reviewQueue.banks.find((item) => item.draftId === draft.id);
assert.ok(pendingBank);
assert.equal(pendingBank.reviewStatus, "pending");
assert.deepEqual(pendingBank.answers, firstAnswers);
assert.equal("editorUserId" in pendingBank, false);

const { data: correctionDecision, error: correctionDecisionError } = await decider.rpc("category_bank_review_decide", {
  p_draft_id: draft.id,
  p_decision: "request-correction",
  p_note: "Add the documented Vienna alias before this bank can be approved.",
});
assert.ifError(correctionDecisionError);
assert.equal(correctionDecision.reviewStatus, "changes-requested");
assert.equal(correctionDecision.competitiveEligible, false);
await assertDenied("duplicate revision decision", () => decider.rpc("category_bank_review_decide", {
  p_draft_id: draft.id,
  p_decision: "approve",
  p_note: "A frozen revision may receive exactly one final decision record.",
}), "55000");

const { data: revision, error: revisionError } = await editor.rpc("category_bank_start_revision", { p_draft_id: draft.id });
assert.ifError(revisionError);
assert.equal(revision.revision, 2);
assert.equal(revision.status, "editing");
assert.equal(revision.reviewStatus, "unreviewed");
assert.deepEqual(revision.answers, firstAnswers);
await assertDenied("parallel editing revision", () => editor.rpc("category_bank_start_revision", { p_draft_id: draft.id }), "55000");

const correctedAnswers = [...firstAnswers, { canonicalText: "Vienna", aliases: ["Wien"] }];
const { data: corrected, error: correctedError } = await editor.rpc("category_bank_save", {
  ...metadata,
  p_version_note: "Second private QA snapshot adds the documented correction.",
  p_answers: correctedAnswers,
});
assert.ifError(correctedError);
assert.equal(corrected.revision, 2);
assert.deepEqual(corrected.answers, correctedAnswers);

const { data: correctedFrozen, error: correctedFreezeError } = await editor.rpc("category_bank_freeze", { p_draft_id: draft.id });
assert.ifError(correctedFreezeError);
assert.equal(correctedFrozen.reviewStatus, "pending");

const { data: approval, error: approvalError } = await decider.rpc("category_bank_review_decide", {
  p_draft_id: draft.id,
  p_decision: "approve",
  p_note: "The corrected frozen snapshot matches its provenance and declared coverage.",
});
assert.ifError(approvalError);
assert.equal(approval.reviewStatus, "approved");
assert.equal(approval.competitiveEligible, false);
await assertDenied("approved revision correction copy", () => editor.rpc("category_bank_start_revision", { p_draft_id: draft.id }), "55000");

if (process.env.BANK_QA_APPROVE_ONLY === "1") {
  await Promise.all([owner.auth.signOut(), editor.auth.signOut(), decider.auth.signOut(), publisher.auth.signOut(), outsider.auth.signOut()]);
  console.log("BANK_QA_APPROVED_FOR_BROWSER=1");
  process.exit(0);
}

const { data: publisherStatus, error: publisherStatusError } = await publisher.rpc("category_publisher_status");
assert.ifError(publisherStatusError);
assert.equal(publisherStatus.authorized, true);
const { data: publicationQueue, error: publicationQueueError } = await publisher.rpc("category_publication_queue");
assert.ifError(publicationQueueError);
const publishableBank = publicationQueue.banks.find((item) => item.draftId === draft.id);
assert.ok(publishableBank);
assert.equal(publishableBank.reviewStatus, "approved");
assert.deepEqual(publishableBank.answers, correctedAnswers);
assert.equal("editorUserId" in publishableBank, false);
assert.equal("reviewerUserId" in publishableBank, false);

const publicationInput = {
  p_draft_id: draft.id,
  p_slug: `bank-qa-${runId}-capitals`,
  p_title: `Bank QA ${runId} capitals`,
  p_summary: `A reviewed local-practice QA bank for run ${runId}.`,
  p_coverage_note: `The reviewed QA scope for run ${runId} contains four capital names.`,
};
await assertDenied("owner self-publish", () => owner.rpc("category_publish_approved_bank", publicationInput), "55000");
await assertDenied("editor self-publish", () => editor.rpc("category_publish_approved_bank", publicationInput), "55000");
await assertDenied("reviewer self-publish", () => decider.rpc("category_publish_approved_bank", publicationInput), "55000");
await assertDenied("invalid publication slug", () => publisher.rpc("category_publish_approved_bank", {
  ...publicationInput,
  p_slug: "../private",
}), "22023");

const { data: publication, error: publicationError } = await publisher.rpc("category_publish_approved_bank", publicationInput);
assert.ifError(publicationError);
assert.equal(publication.slug, publicationInput.p_slug);
assert.equal(publication.categoryVersion, 1);
assert.equal(publication.answerCount, 4);
assert.equal(publication.acceptedNameCount, 8);
assert.equal(publication.availability, "practice");
assert.equal(publication.competitiveEligible, false);
console.log(`BANK_QA_PUBLICATION_ID=${publication.publicationId}`);
console.log(`BANK_QA_PUBLICATION_SLUG=${publication.slug}`);
await assertDenied("duplicate publication", () => publisher.rpc("category_publish_approved_bank", publicationInput), "55000");

const { data: publishedDiscovery, error: publishedDiscoveryError } = await owner.rpc("category_discover", { p_query: `bank QA ${runId}` });
assert.ifError(publishedDiscoveryError);
const discoveryEntry = publishedDiscovery.categories.find((item) => item.slug === publication.slug);
assert.ok(discoveryEntry);
assert.equal(discoveryEntry.reviewStatus, "reviewed");
assert.equal(discoveryEntry.availability, "practice");
assert.equal(discoveryEntry.competitiveEligible, false);
assert.equal(discoveryEntry.answerCount, 4);

const { data: practiceCategory, error: practiceCategoryError } = await owner.rpc("category_practice_get", { p_slug: publication.slug });
assert.ifError(practiceCategoryError);
assert.equal(practiceCategory.slug, publication.slug);
assert.equal(practiceCategory.competitiveEligible, false);
assert.deepEqual(practiceCategory.answers, correctedAnswers);

const { data: ownerDrafts, error: ownerDraftsError } = await owner.rpc("category_list_drafts");
assert.ifError(ownerDraftsError);
const ownerProjection = ownerDrafts.drafts.find((item) => item.id === draft.id);
assert.ok(ownerProjection);
assert.equal("answers" in ownerProjection, false);
assert.equal("bank" in ownerProjection, false);
assert.equal(ownerProjection.competitiveEligible, false);

const correctionReason = "Add the newly documented Helsinki answer and refresh the dated provenance snapshot.";
await assertDenied("outsider correction request", () => outsider.rpc("category_publication_request_correction", {
  p_publication_id: publication.publicationId,
  p_reason: correctionReason,
}), "42501");
await assertDenied("owner correction request", () => owner.rpc("category_publication_request_correction", {
  p_publication_id: publication.publicationId,
  p_reason: correctionReason,
}), "42501");
await assertDenied("editor correction request", () => editor.rpc("category_publication_request_correction", {
  p_publication_id: publication.publicationId,
  p_reason: correctionReason,
}), "42501");
await assertDenied("reviewer correction request", () => decider.rpc("category_publication_request_correction", {
  p_publication_id: publication.publicationId,
  p_reason: correctionReason,
}), "42501");

const { data: correctionRequest, error: correctionRequestError } = await publisher.rpc(
  "category_publication_request_correction",
  { p_publication_id: publication.publicationId, p_reason: correctionReason },
);
assert.ifError(correctionRequestError);
assert.equal(correctionRequest.current, true);
assert.equal(correctionRequest.categoryVersion, 1);
assert.equal(correctionRequest.correctionRequest.reason, correctionReason);
assert.equal(correctionRequest.correctionRequest.revisionStarted, false);
assert.equal(correctionRequest.competitiveEligible, false);
await assertDenied("duplicate publication correction", () => publisher.rpc("category_publication_request_correction", {
  p_publication_id: publication.publicationId,
  p_reason: "A second correction request must not overwrite the first immutable request.",
}), "55000");

const { data: editorCorrectionQueue, error: editorCorrectionQueueError } = await editor.rpc("category_bank_queue");
assert.ifError(editorCorrectionQueueError);
const correctionQueueItem = editorCorrectionQueue.drafts.find((item) => item.draftId === draft.id);
assert.ok(correctionQueueItem);
assert.equal(correctionQueueItem.available, true);
assert.equal(correctionQueueItem.publicationCorrection.publicationId, publication.publicationId);
assert.equal(correctionQueueItem.publicationCorrection.reason, correctionReason);
await assertDenied("non-editor published correction copy", () => decider.rpc("category_bank_start_revision", {
  p_draft_id: draft.id,
}), "55000");

const { data: publishedRevision, error: publishedRevisionError } = await editor.rpc(
  "category_bank_start_revision",
  { p_draft_id: draft.id },
);
assert.ifError(publishedRevisionError);
assert.equal(publishedRevision.revision, 3);
assert.equal(publishedRevision.status, "editing");
assert.deepEqual(publishedRevision.answers, correctedAnswers);

const successorAnswers = [...correctedAnswers, { canonicalText: "Helsinki", aliases: ["Helsingfors"] }];
const { data: successorSaved, error: successorSaveError } = await editor.rpc("category_bank_save", {
  ...metadata,
  p_snapshot_date: "2026-07-22",
  p_source_label: "Updated official QA geographic list",
  p_version_note: "Third private QA snapshot adds the documented Helsinki correction.",
  p_answers: successorAnswers,
});
assert.ifError(successorSaveError);
assert.equal(successorSaved.revision, 3);
assert.deepEqual(successorSaved.answers, successorAnswers);
const { data: successorFrozen, error: successorFreezeError } = await editor.rpc("category_bank_freeze", {
  p_draft_id: draft.id,
});
assert.ifError(successorFreezeError);
assert.equal(successorFrozen.reviewStatus, "pending");
const { data: successorApproval, error: successorApprovalError } = await decider.rpc("category_bank_review_decide", {
  p_draft_id: draft.id,
  p_decision: "approve",
  p_note: "The successor snapshot resolves the correction and matches the updated provenance.",
});
assert.ifError(successorApprovalError);
assert.equal(successorApproval.reviewStatus, "approved");

const successorInput = {
  ...publicationInput,
  p_summary: `An updated reviewed local-practice QA bank for run ${runId}.`,
  p_coverage_note: `The reviewed QA scope for run ${runId} now contains five capital names.`,
};
await assertDenied("successor URL change", () => publisher.rpc("category_publish_approved_bank", {
  ...successorInput,
  p_slug: `${publication.slug}-changed`,
}), "55000");
const { data: successorPublication, error: successorPublicationError } = await publisher.rpc(
  "category_publish_approved_bank",
  successorInput,
);
assert.ifError(successorPublicationError);
assert.equal(successorPublication.categoryVersion, 2);
assert.equal(successorPublication.bankRevision, 3);
assert.equal(successorPublication.supersededPublicationId, publication.publicationId);
assert.equal(successorPublication.slug, publication.slug);
assert.equal(successorPublication.answerCount, 5);
assert.equal(successorPublication.acceptedNameCount, 10);
assert.equal(successorPublication.competitiveEligible, false);

const { data: releaseLedger, error: releaseLedgerError } = await publisher.rpc("category_publication_queue");
assert.ifError(releaseLedgerError);
const currentRelease = releaseLedger.releases.find((item) => item.publicationId === successorPublication.publicationId);
const historicalRelease = releaseLedger.releases.find((item) => item.publicationId === publication.publicationId);
assert.ok(currentRelease);
assert.ok(historicalRelease);
assert.equal(currentRelease.current, true);
assert.equal(currentRelease.categoryVersion, 2);
assert.equal(currentRelease.supersedesPublicationId, publication.publicationId);
assert.equal(historicalRelease.current, false);
assert.equal(historicalRelease.supersededByPublicationId, successorPublication.publicationId);
assert.equal(historicalRelease.correctionRequest.successorPublished, true);
assert.equal(historicalRelease.answerCount, 4);

const { data: correctedPractice, error: correctedPracticeError } = await owner.rpc("category_practice_get", {
  p_slug: publication.slug,
});
assert.ifError(correctedPracticeError);
assert.equal(correctedPractice.version, 2);
assert.deepEqual(correctedPractice.answers, successorAnswers);
assert.equal(correctedPractice.competitiveEligible, false);

await Promise.all([owner.auth.signOut(), editor.auth.signOut(), decider.auth.signOut(), publisher.auth.signOut(), outsider.auth.signOut()]);

console.log(`CATEGORY_BANK_QA_OWNER=${ownerId}`);
console.log("Category bank hostile-client checks passed: deny-all tables, independent review and publishing, immutable correction evidence and release history, editor-only successor revision copying, atomic practice supersession, dynamic current-practice projection, discovery visibility, and unchanged noncompetitive state.");
