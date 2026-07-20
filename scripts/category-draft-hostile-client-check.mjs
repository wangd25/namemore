import assert from "node:assert/strict";

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !publishableKey) {
  throw new Error("Public Supabase test configuration is required.");
}

function client() {
  return createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

async function signIn(entry) {
  const { data, error } = await entry.auth.signInAnonymously();
  assert.ifError(error);
  assert.ok(data.user?.is_anonymous);
}

async function assertDenied(label, operation, expectedCode) {
  const { error } = await operation();
  assert.ok(error, `${label} unexpectedly succeeded.`);
  if (expectedCode) assert.equal(error.code, expectedCode, `${label} returned the wrong error.`);
}

function draftInput(runId, index) {
  return {
    p_prompt: `How many QA ${runId} category ${index} answers can you name?`,
    p_source_notes: `Official QA source ${runId} for category ${index}`,
    p_coverage_notes: `Explicit QA coverage boundary ${runId} for category ${index}`,
  };
}

const unsigned = client();
await assertDenied("unsigned draft list", () => unsigned.rpc("category_list_drafts"));

const owner = client();
const outsider = client();
await Promise.all([signIn(owner), signIn(outsider)]);

await assertDenied("direct private draft read", () =>
  owner.schema("private").from("category_drafts").select("*"));
await assertDenied("direct private draft update", () =>
  owner.schema("private").from("category_drafts").update({ status: "review-requested" })
    .eq("id", "00000000-0000-4000-8000-000000000000"));

const runId = String(Date.now()).slice(-8);
const createdDrafts = [];
for (let index = 1; index <= 5; index += 1) {
  const { data, error } = await owner.rpc("category_create_draft", draftInput(runId, index));
  assert.ifError(error);
  assert.equal(data.status, "draft");
  assert.equal(data.reviewStatus, "unreviewed");
  assert.equal(data.competitiveEligible, false);
  assert.equal(data.submittedAt, null);
  createdDrafts.push(data);
}

await assertDenied(
  "sixth draft within one hour",
  () => owner.rpc("category_create_draft", draftInput(runId, 6)),
  "54000",
);

const primary = createdDrafts[0];
await assertDenied(
  "cross-user draft update",
  () => outsider.rpc("category_update_draft", {
    p_draft_id: primary.id,
    ...draftInput(runId, 7),
  }),
  "22023",
);
await assertDenied(
  "cross-user review request",
  () => outsider.rpc("category_submit_draft", { p_draft_id: primary.id }),
  "22023",
);

const { data: updated, error: updateError } = await owner.rpc("category_update_draft", {
  p_draft_id: primary.id,
  p_prompt: `  How many QA ${runId} updated answers can you name?  `,
  p_source_notes: `  Official QA source ${runId} updated  `,
  p_coverage_notes: `  Explicit QA coverage boundary ${runId} updated  `,
});
assert.ifError(updateError);
assert.equal(updated.prompt, `How many QA ${runId} updated answers can you name?`);
assert.equal(updated.status, "draft");

const { data: submitted, error: submitError } = await owner.rpc("category_submit_draft", {
  p_draft_id: primary.id,
});
assert.ifError(submitError);
assert.equal(submitted.status, "review-requested");
assert.equal(submitted.reviewStatus, "pending");
assert.equal(submitted.competitiveEligible, false);
assert.equal(typeof submitted.submittedAt, "string");

await assertDenied(
  "editing after review request",
  () => owner.rpc("category_update_draft", {
    p_draft_id: primary.id,
    ...draftInput(runId, 8),
  }),
  "55000",
);
await assertDenied(
  "duplicate review request",
  () => owner.rpc("category_submit_draft", { p_draft_id: primary.id }),
  "55000",
);

const { data: ownerList, error: ownerListError } = await owner.rpc("category_list_drafts");
assert.ifError(ownerListError);
assert.equal(ownerList.drafts.length, 5);
assert.equal(ownerList.drafts.find((draft) => draft.id === primary.id).status, "review-requested");

const { data: outsiderList, error: outsiderListError } = await outsider.rpc("category_list_drafts");
assert.ifError(outsiderListError);
assert.deepEqual(outsiderList.drafts, []);

const { data: outsiderDraft, error: outsiderCreateError } = await outsider.rpc(
  "category_create_draft",
  draftInput(runId, 9),
);
assert.ifError(outsiderCreateError);
const { data: ownerListAfter, error: ownerListAfterError } = await owner.rpc("category_list_drafts");
assert.ifError(ownerListAfterError);
assert.equal(ownerListAfter.drafts.some((draft) => draft.id === outsiderDraft.id), false);

const { data: discovery, error: discoveryError } = await owner.rpc("category_discover", {
  p_query: `QA ${runId}`,
});
assert.ifError(discoveryError);
assert.deepEqual(discovery.categories, []);

await Promise.all([owner.auth.signOut(), outsider.auth.signOut()]);

console.log("Category draft hostile-client checks passed: authentication, direct-table denial, owner isolation, bounded creation, normalized editing, irreversible review request, and discovery privacy.");
