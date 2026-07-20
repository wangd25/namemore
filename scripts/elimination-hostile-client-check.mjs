import assert from "node:assert/strict";
import readline from "node:readline/promises";

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !publishableKey) throw new Error("Public Supabase test configuration is required.");

function client() {
  return createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
}

async function assertDenied(label, operation) {
  const { error } = await operation();
  assert.ok(error, `${label} unexpectedly succeeded.`);
}

async function signIn(entry) {
  const { data, error } = await entry.auth.signInAnonymously();
  assert.ifError(error);
  assert.ok(data.user?.is_anonymous);
}

const unsigned = client();
await assertDenied("unsigned elimination create", () => unsigned.rpc("room_create", {
  p_display_name: "Unsigned Host",
  p_mode: "elimination",
}));

const host = client();
const guest = client();
const isolatedHost = client();
const raceHost = client();
const raceGuest = client();
for (const entry of [host, guest, isolatedHost, raceHost, raceGuest]) await signIn(entry);

await assertDenied("direct claim read", () => host.from("room_answer_claims").select("*"));
await assertDenied("direct claim insert", () => host.from("room_answer_claims").insert({}));

const runId = String(Date.now()).slice(-6);
const { data: created, error: createError } = await host.rpc("room_create", {
  p_display_name: `Elim ${runId} Host`,
  p_mode: "elimination",
});
assert.ifError(createError);
assert.equal(created.room.mode, "elimination");
const roomCode = created.room.code;
const hostId = created.room.membership.playerId;

const { data: joined, error: joinError } = await guest.rpc("room_join", {
  p_room_code: roomCode,
  p_display_name: `Elim ${runId} Guest`,
});
assert.ifError(joinError);
const guestId = joined.room.membership.playerId;

const { error: startError } = await host.rpc("room_start", { p_room_code: roomCode });
assert.ifError(startError);

const concurrent = await Promise.all([
  host.rpc("room_submit_answer", { p_room_code: roomCode, p_normalized_answer: "stephen curry" }),
  guest.rpc("room_submit_answer", { p_room_code: roomCode, p_normalized_answer: "stephen curry" }),
]);
concurrent.forEach(({ error }) => assert.ifError(error));
assert.deepEqual(concurrent.map(({ data }) => data.status).sort(), ["accepted", "already-taken"]);

const winnerIndex = concurrent.findIndex(({ data }) => data.status === "accepted");
const winner = winnerIndex === 0 ? host : guest;
const loser = winnerIndex === 0 ? guest : host;
const winnerId = winnerIndex === 0 ? hostId : guestId;
const loserId = winnerIndex === 0 ? guestId : hostId;

const { data: winnerDuplicate, error: winnerDuplicateError } = await winner.rpc("room_submit_answer", {
  p_room_code: roomCode,
  p_normalized_answer: "stephen curry",
});
assert.ifError(winnerDuplicateError);
assert.equal(winnerDuplicate.status, "duplicate");
assert.equal(winnerDuplicate.score, 1);

const { data: loserRetry, error: loserRetryError } = await loser.rpc("room_submit_answer", {
  p_room_code: roomCode,
  p_normalized_answer: "stephen curry",
});
assert.ifError(loserRetryError);
assert.deepEqual(Object.keys(loserRetry).sort(), ["serverNow", "status"]);
assert.equal(loserRetry.status, "already-taken");

const { data: loserAccepted, error: loserAcceptedError } = await loser.rpc("room_submit_answer", {
  p_room_code: roomCode,
  p_normalized_answer: "lebron james",
});
assert.ifError(loserAcceptedError);
assert.equal(loserAccepted.status, "accepted");
assert.equal(loserAccepted.score, 1);

const { data: activeLoserGame, error: activeLoserError } = await loser.rpc("room_get_game", {
  p_room_code: roomCode,
});
assert.ifError(activeLoserError);
assert.equal(activeLoserGame.game.players.find((player) => player.id === winnerId).answers, null);
assert.deepEqual(
  activeLoserGame.game.players.find((player) => player.id === loserId).answers.map((answer) => answer.canonicalText),
  ["LeBron James"],
);

const { data: isolated, error: isolatedCreateError } = await isolatedHost.rpc("room_create", {
  p_display_name: `Isolated ${runId}`,
  p_mode: "elimination",
});
assert.ifError(isolatedCreateError);
assert.ifError((await isolatedHost.rpc("room_start", { p_room_code: isolated.room.code })).error);
const { data: isolatedClaim, error: isolatedClaimError } = await isolatedHost.rpc("room_submit_answer", {
  p_room_code: isolated.room.code,
  p_normalized_answer: "stephen curry",
});
assert.ifError(isolatedClaimError);
assert.equal(isolatedClaim.status, "accepted");

const { data: race, error: raceCreateError } = await raceHost.rpc("room_create", {
  p_display_name: `Race ${runId} Host`,
  p_mode: "private-race",
});
assert.ifError(raceCreateError);
assert.equal(race.room.mode, "private-race");
assert.ifError((await raceGuest.rpc("room_join", {
  p_room_code: race.room.code,
  p_display_name: `Race ${runId} Guest`,
})).error);
assert.ifError((await raceHost.rpc("room_start", { p_room_code: race.room.code })).error);
const privateRacePair = await Promise.all([
  raceHost.rpc("room_submit_answer", { p_room_code: race.room.code, p_normalized_answer: "stephen curry" }),
  raceGuest.rpc("room_submit_answer", { p_room_code: race.room.code, p_normalized_answer: "stephen curry" }),
]);
privateRacePair.forEach(({ data, error }) => {
  assert.ifError(error);
  assert.equal(data.status, "accepted");
});

console.log(`ROOM_PHASE6_READY ${roomCode}`);
const lineReader = readline.createInterface({ input: process.stdin, output: process.stdout });
await lineReader.question("");
lineReader.close();

const { data: completed, error: completedError } = await host.rpc("room_get_game", { p_room_code: roomCode });
assert.ifError(completedError);
assert.equal(completed.game.status, "completed");
assert.ok(completed.game.players.every((player) => Array.isArray(player.answers)));
assert.deepEqual(
  completed.game.players.find((player) => player.id === winnerId).answers.map((answer) => answer.canonicalText),
  ["Stephen Curry"],
);
assert.deepEqual(
  completed.game.players.find((player) => player.id === loserId).answers.map((answer) => answer.canonicalText),
  ["LeBron James"],
);

const { data: late, error: lateError } = await loser.rpc("room_submit_answer", {
  p_room_code: roomCode,
  p_normalized_answer: "kevin durant",
});
assert.ifError(lateError);
assert.equal(late.status, "round-ended");

for (const entry of [host, guest, isolatedHost, raceHost, raceGuest]) await entry.auth.signOut();

console.log("Elimination hostile-client checks passed: one atomic room claim, answer-free already-taken responses, cross-room isolation, private-race regression, deadline rejection, and verified ownership reveal.");
