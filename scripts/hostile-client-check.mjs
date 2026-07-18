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

async function assertDenied(label, operation) {
  const { error } = await operation();
  assert.ok(error, `${label} unexpectedly succeeded.`);
}

const unsigned = client();
await assertDenied("unsigned RPC", () => unsigned.rpc("daily_get_status"));

const playerA = client();
const playerB = client();
const [authA, authB] = await Promise.all([
  playerA.auth.signInAnonymously(),
  playerB.auth.signInAnonymously(),
]);
assert.ifError(authA.error);
assert.ifError(authB.error);
assert.ok(authA.data.user?.is_anonymous);
assert.ok(authB.data.user?.is_anonymous);
assert.notEqual(authA.data.user?.id, authB.data.user?.id);

await assertDenied("private answer-bank read", () =>
  playerA.schema("private").from("category_answers").select("canonical_text").limit(1),
);
await assertDenied("public challenge read", () =>
  playerA.from("daily_challenges").select("*"),
);
await assertDenied("direct attempt insert", () =>
  playerA.from("daily_attempts").insert({}),
);

const { data: statusA, error: statusError } = await playerA.rpc("daily_get_status");
assert.ifError(statusError);
assert.ok(statusA.challenge, "The current UTC challenge is missing.");
assert.equal(statusA.attempt, null);
assert.equal("answers" in statusA.challenge.category, false);

const [{ data: startA1, error: startError1 }, { data: startA2, error: startError2 }] =
  await Promise.all([
    playerA.rpc("daily_start_attempt"),
    playerA.rpc("daily_start_attempt"),
  ]);
assert.ifError(startError1);
assert.ifError(startError2);
assert.equal(startA1.attempt.id, startA2.attempt.id);
assert.equal(startA1.attempt.deadlineAt, startA2.attempt.deadlineAt);
assert.equal(
  Date.parse(startA1.attempt.deadlineAt) - Date.parse(startA1.attempt.startedAt),
  startA1.challenge.category.timeLimitSeconds * 1_000,
);

const { data: resumedA, error: resumeError } = await playerA.rpc("daily_get_status");
assert.ifError(resumeError);
assert.equal(resumedA.attempt.id, startA1.attempt.id);

const { data: startB, error: startErrorB } = await playerB.rpc("daily_start_attempt");
assert.ifError(startErrorB);
assert.notEqual(startB.attempt.id, startA1.attempt.id);

const { data: accepted, error: acceptedError } = await playerA.rpc(
  "daily_submit_answer",
  { p_attempt_id: startA1.attempt.id, p_normalized_answer: "curry" },
);
assert.ifError(acceptedError);
assert.equal(accepted.status, "accepted");
assert.equal(accepted.score, 1);
assert.deepEqual(Object.keys(accepted.answer).sort(), [
  "acceptedAt",
  "canonicalText",
  "id",
  "teamCode",
]);

const concurrent = await Promise.all([
  playerA.rpc("daily_submit_answer", {
    p_attempt_id: startA1.attempt.id,
    p_normalized_answer: "harden",
  }),
  playerA.rpc("daily_submit_answer", {
    p_attempt_id: startA1.attempt.id,
    p_normalized_answer: "harden",
  }),
]);
concurrent.forEach(({ error }) => assert.ifError(error));
assert.deepEqual(
  concurrent.map(({ data }) => data.status).sort(),
  ["accepted", "duplicate"],
);
assert.equal(concurrent[0].data.answer.acceptedAt, concurrent[1].data.answer.acceptedAt);

const { data: invalid, error: invalidError } = await playerA.rpc(
  "daily_submit_answer",
  {
    p_attempt_id: startA1.attempt.id,
    p_normalized_answer: "definitely not a player",
  },
);
assert.ifError(invalidError);
assert.equal(invalid.status, "invalid");

await assertDenied("cross-user attempt access", () =>
  playerB.rpc("daily_submit_answer", {
    p_attempt_id: startA1.attempt.id,
    p_normalized_answer: "curry",
  }),
);
await assertDenied("arbitrary score write", () =>
  playerA
    .from("daily_attempts")
    .update({
      verified_score: 999,
      deadline_at: "2099-01-01T00:00:00Z",
      status: "completed",
      user_id: authB.data.user.id,
    })
    .eq("id", startA1.attempt.id),
);
await assertDenied("direct accepted-row write", () =>
  playerA.from("daily_submissions").insert({
    attempt_id: startA1.attempt.id,
    answer_id: "00000000-0000-4000-8000-000000000000",
  }),
);

const { data: finish1, error: finishError1 } = await playerA.rpc(
  "daily_finish_attempt",
  { p_attempt_id: startA1.attempt.id },
);
const { data: finish2, error: finishError2 } = await playerA.rpc(
  "daily_finish_attempt",
  { p_attempt_id: startA1.attempt.id },
);
assert.ifError(finishError1);
assert.ifError(finishError2);
assert.equal(finish1.attempt.status, "completed");
assert.equal(finish1.attempt.score, 2);
assert.equal(finish2.attempt.score, 2);
assert.deepEqual(finish2.attempt.answers, finish1.attempt.answers);

const { data: afterFinish, error: afterFinishError } = await playerA.rpc(
  "daily_submit_answer",
  { p_attempt_id: startA1.attempt.id, p_normalized_answer: "durant" },
);
assert.ifError(afterFinishError);
assert.equal(afterFinish.status, "round-ended");
assert.equal(afterFinish.attempt.score, 2);

await Promise.all([playerA.auth.signOut(), playerB.auth.signOut()]);

console.log(
  "Hostile client checks passed: anonymous auth, hidden answers, ownership, atomic duplicate handling, derived score, and idempotent finish.",
);
