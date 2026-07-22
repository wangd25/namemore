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
await assertDenied("legacy start without display name", () =>
  unsigned.rpc("daily_start_attempt"),
);

const runId = String(Date.now()).slice(-6);
const players = Array.from({ length: 12 }, () => client());
const authResults = await Promise.all(
  players.map((player) => player.auth.signInAnonymously()),
);
authResults.forEach(({ data, error }) => {
  assert.ifError(error);
  assert.ok(data.user?.is_anonymous);
});
assert.equal(new Set(authResults.map(({ data }) => data.user?.id)).size, players.length);

const [playerA, playerB] = players;
const authA = authResults[0];
const authB = authResults[1];

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
assert.equal(typeof statusA.challenge.resetAt, "string");

for (const displayName of [
  "A",
  "x".repeat(25),
  "Player\u0000Name",
  "Player\tName",
  "<script>alert(1)</script>",
]) {
  await assertDenied(`invalid display name ${JSON.stringify(displayName)}`, () =>
    playerA.rpc("daily_start_attempt", { p_display_name: displayName }),
  );
}

const playerAName = `QA ${runId} Player A`;
const playerBName = `QA ${runId} Player B`;

const [{ data: startA1, error: startError1 }, { data: startA2, error: startError2 }] =
  await Promise.all([
    playerA.rpc("daily_start_attempt", { p_display_name: `  ${playerAName}  ` }),
    playerA.rpc("daily_start_attempt", { p_display_name: playerAName }),
  ]);
assert.ifError(startError1);
assert.ifError(startError2);
assert.equal(startA1.attempt.id, startA2.attempt.id);
assert.equal(startA1.attempt.displayName, playerAName);
assert.equal(startA1.attempt.rankedEligible, false);
assert.equal(startA1.attempt.deadlineAt, startA2.attempt.deadlineAt);
assert.equal(
  Date.parse(startA1.attempt.deadlineAt) - Date.parse(startA1.attempt.startedAt),
  startA1.challenge.category.timeLimitSeconds * 1_000,
);

const { data: resumedA, error: resumeError } = await playerA.rpc("daily_get_status");
assert.ifError(resumeError);
assert.equal(resumedA.attempt.id, startA1.attempt.id);
assert.equal(resumedA.attempt.displayName, playerAName);

await assertDenied("attempt rename", () =>
  playerA.rpc("daily_start_attempt", { p_display_name: `QA ${runId} Renamed` }),
);

const { data: startB, error: startErrorB } = await playerB.rpc(
  "daily_start_attempt",
  { p_display_name: playerBName },
);
assert.ifError(startErrorB);
assert.notEqual(startB.attempt.id, startA1.attempt.id);
assert.equal(startB.attempt.rankedEligible, false);

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
      display_name: "Forged Name",
      ranked_eligible: true,
    })
    .eq("id", startA1.attempt.id),
);
await assertDenied("direct accepted-row write", () =>
  playerA.from("daily_submissions").insert({
    attempt_id: startA1.attempt.id,
    answer_id: "00000000-0000-4000-8000-000000000000",
  }),
);
await assertDenied("direct leaderboard insertion", () =>
  playerA.from("daily_leaderboard").insert({ display_name: "Forged", verified_score: 999 }),
);

const [{ data: finish1, error: finishError1 }, { data: finish2, error: finishError2 }] =
  await Promise.all([
    playerA.rpc("daily_finish_attempt", { p_attempt_id: startA1.attempt.id }),
    playerA.rpc("daily_finish_attempt", { p_attempt_id: startA1.attempt.id }),
  ]);
assert.ifError(finishError1);
assert.ifError(finishError2);
assert.equal(finish1.attempt.status, "completed");
assert.equal(finish1.attempt.score, 2);
assert.equal(finish2.attempt.score, 2);
assert.deepEqual(finish2.attempt.answers, finish1.attempt.answers);
assert.equal(finish1.attempt.displayName, playerAName);

const { data: afterFinish, error: afterFinishError } = await playerA.rpc(
  "daily_submit_answer",
  { p_attempt_id: startA1.attempt.id, p_normalized_answer: "durant" },
);
assert.ifError(afterFinishError);
assert.equal(afterFinish.status, "round-ended");
assert.equal(afterFinish.attempt.score, 2);

const acceptedAliases = [
  "curry",
  "harden",
  "durant",
];
const targetScores = [3, 2];
const completedNames = [];

for (let index = 0; index < targetScores.length; index += 1) {
  const player = players[index + 2];
  const displayName = `QA ${runId} Player ${String(index + 3).padStart(2, "0")}`;
  const { data: started, error: startError } = await player.rpc(
    "daily_start_attempt",
    { p_display_name: displayName },
  );
  assert.ifError(startError);
  assert.equal(started.attempt.rankedEligible, false);

  for (const normalizedAnswer of acceptedAliases.slice(0, targetScores[index])) {
    const { data, error } = await player.rpc("daily_submit_answer", {
      p_attempt_id: started.attempt.id,
      p_normalized_answer: normalizedAnswer,
    });
    assert.ifError(error);
    assert.equal(data.status, "accepted");
  }

  const { data: finished, error: finishError } = await player.rpc(
    "daily_finish_attempt",
    { p_attempt_id: started.attempt.id },
  );
  assert.ifError(finishError);
  assert.equal(finished.attempt.score, targetScores[index]);
  completedNames.push(displayName);
}

const { data: leaderboard, error: leaderboardError } = await playerA.rpc(
  "daily_get_leaderboard",
);
assert.ifError(leaderboardError);
assert.equal(leaderboard.challenge.date, statusA.challenge.date);
assert.equal(leaderboard.challenge.category.slug, statusA.challenge.category.slug);
assert.equal(leaderboard.challenge.category.version, statusA.challenge.category.version);
assert.ok(leaderboard.entries.length <= 10);
leaderboard.entries.forEach((entry, index) => {
  assert.deepEqual(Object.keys(entry).sort(), ["displayName", "isTied", "rank", "score"]);
  assert.equal(entry.rank, index + 1);
  if (index > 0) {
    assert.ok(entry.score <= leaderboard.entries[index - 1].score);
  }
});
assert.equal(leaderboard.entries.some(({ displayName }) => displayName === playerBName), false);
assert.equal(leaderboard.entries.some(({ displayName }) => displayName === playerAName), false);
completedNames.forEach((displayName) => {
  assert.equal(leaderboard.entries.some((entry) => entry.displayName === displayName), false);
});
assert.equal(JSON.stringify(leaderboard).includes(authA.data.user.id), false);
assert.equal(JSON.stringify(leaderboard).includes("canonicalText"), false);
assert.equal(JSON.stringify(leaderboard).includes("answer"), false);

const burst = await Promise.all(
  Array.from({ length: 41 }, (_, index) =>
    playerB.rpc("daily_submit_answer", {
      p_attempt_id: startB.attempt.id,
      p_normalized_answer: `invalid burst ${index}`,
    }),
  ),
);
burst.forEach(({ error }) => assert.ifError(error));
assert.ok(burst.some(({ data }) => data.status === "rate-limited"));

await Promise.all(players.map((player) => player.auth.signOut()));

console.log(
  "Hostile client checks passed: anonymous attempts stay unranked while ownership, rate limiting, derived scores, idempotent finish, and safe leaderboard projection remain intact.",
);
