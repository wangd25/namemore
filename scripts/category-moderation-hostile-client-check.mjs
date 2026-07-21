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

const reporter = client();
const moderator = client();
const outsider = client();
const [reporterId, moderatorId, outsiderId] = await Promise.all([
  signIn(reporter), signIn(moderator), signIn(outsider),
]);

for (const table of ["category_moderators", "category_reports", "category_report_moderation_decisions"]) {
  await assertDenied(`direct ${table} read`, () => outsider.schema("private").from(table).select("*"));
}

const { data: outsiderStatus, error: outsiderStatusError } = await outsider.rpc("category_moderator_status");
assert.ifError(outsiderStatusError);
assert.equal(outsiderStatus.authorized, false);
await assertDenied("outsider moderation queue", () => outsider.rpc("category_moderation_queue"), "42501");

await assertDenied("invalid null reason", () => reporter.rpc("category_report_create", {
  p_slug: "chemical-elements",
  p_reason: null,
  p_detail: "This otherwise valid report must not accept a missing reason.",
}), "22023");

const { data: firstReport, error: firstReportError } = await reporter.rpc("category_report_create", {
  p_slug: "chemical-elements",
  p_reason: "answer-bank-accuracy",
  p_detail: "Please verify the documented spelling for the hostile-client check.",
});
assert.ifError(firstReportError);
assert.equal(firstReport.status, "pending");
await assertDenied("duplicate pending report", () => reporter.rpc("category_report_create", {
  p_slug: "chemical-elements",
  p_reason: "other",
  p_detail: "A second pending report for the same category version must be rejected.",
}), "23505");

console.log(`MODERATION_QA_REPORTER_USER_ID=${reporterId}`);
console.log(`MODERATION_QA_MODERATOR_USER_ID=${moderatorId}`);
console.log(`MODERATION_QA_OUTSIDER_USER_ID=${outsiderId}`);
console.log(`MODERATION_QA_REPORT_ID=${firstReport.reportId}`);
console.log("Promote the moderator in the private allowlist, then send a newline.");
const input = createInterface({ input: process.stdin, output: process.stdout });
await input.question("");
input.close();

const { data: moderatorStatus, error: moderatorStatusError } = await moderator.rpc("category_moderator_status");
assert.ifError(moderatorStatusError);
assert.equal(moderatorStatus.authorized, true);

const { data: queue, error: queueError } = await moderator.rpc("category_moderation_queue");
assert.ifError(queueError);
const queuedReport = queue.reports.find((report) => report.reportId === firstReport.reportId);
assert.ok(queuedReport);
assert.equal("reporterUserId" in queuedReport, false);
assert.equal("moderatorUserId" in queuedReport, false);

await assertDenied("invalid null outcome", () => moderator.rpc("category_moderation_decide", {
  p_report_id: firstReport.reportId,
  p_outcome: null,
  p_note: "This otherwise valid note must not accept a missing outcome.",
}), "22023");

const { data: decision, error: decisionError } = await moderator.rpc("category_moderation_decide", {
  p_report_id: firstReport.reportId,
  p_outcome: "publisher-review",
  p_note: "Check the report against the cited source before preparing a correction.",
});
assert.ifError(decisionError);
assert.equal(decision.status, "publisher-review");
await assertDenied("stale second decision", () => moderator.rpc("category_moderation_decide", {
  p_report_id: firstReport.reportId,
  p_outcome: "dismiss",
  p_note: "A reviewed report cannot receive a second moderation decision.",
}), "55000");

const { data: discovery, error: discoveryError } = await outsider.rpc("category_discover", { p_query: "chemical elements" });
assert.ifError(discoveryError);
const category = discovery.categories.find((item) => item.slug === "chemical-elements");
assert.ok(category);
assert.equal(category.reviewStatus, "reviewed");
assert.equal(category.availability, "practice");
assert.equal(category.competitiveEligible, false);

const { data: browserReport, error: browserReportError } = await reporter.rpc("category_report_create", {
  p_slug: "chemical-elements",
  p_reason: "coverage-or-wording",
  p_detail: "Browser QA should confirm this pending report appears without reporter identity.",
});
assert.ifError(browserReportError);
console.log(`MODERATION_BROWSER_REPORT_ID=${browserReport.reportId}`);
console.log("CATEGORY_MODERATION_HOSTILE_CLIENT_CHECK=passed");

await Promise.all([reporter.auth.signOut(), moderator.auth.signOut(), outsider.auth.signOut()]);
