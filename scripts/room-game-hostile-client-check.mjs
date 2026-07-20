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

async function subscribe(channel) {
  return await new Promise((resolve) => {
    const timeout = setTimeout(() => resolve("TIMED_OUT"), 8_000);
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        clearTimeout(timeout);
        resolve(status);
      }
    });
  });
}

const unsigned = client();
await assertDenied("unsigned game read", () => unsigned.rpc("room_get_game", { p_room_code: "K7M4Q2PX" }));

const host = client();
const guest = client();
const outsider = client();
for (const entry of [host, guest, outsider]) {
  const { data, error } = await entry.auth.signInAnonymously();
  assert.ifError(error);
  assert.ok(data.user?.is_anonymous);
  assert.ok(data.session?.access_token);
  await entry.realtime.setAuth(data.session.access_token);
}

await assertDenied("direct submission read", () => host.from("room_submissions").select("*"));
await assertDenied("direct submission insert", () => host.from("room_submissions").insert({}));

const runId = String(Date.now()).slice(-6);
const { data: created, error: createError } = await host.rpc("room_create", { p_display_name: `Live ${runId} Host` });
assert.ifError(createError);
const roomCode = created.room.code;
const hostId = created.room.membership.playerId;

const { data: joined, error: joinError } = await guest.rpc("room_join", {
  p_room_code: roomCode,
  p_display_name: `Live ${runId} Guest`,
});
assert.ifError(joinError);
const guestId = joined.room.membership.playerId;

const { error: startError } = await host.rpc("room_start", { p_room_code: roomCode });
assert.ifError(startError);

await assertDenied("outsider live game read", () => outsider.rpc("room_get_game", { p_room_code: roomCode }));

const { data: initialHostGame, error: initialHostError } = await host.rpc("room_get_game", { p_room_code: roomCode });
assert.ifError(initialHostError);
assert.equal(initialHostGame.game.status, "active");
assert.deepEqual(initialHostGame.game.players.find((player) => player.id === hostId).answers, []);
assert.equal(initialHostGame.game.players.find((player) => player.id === guestId).answers, null);

const { data: hostAccepted, error: hostSubmitError } = await host.rpc("room_submit_answer", {
  p_room_code: roomCode,
  p_normalized_answer: "stephen curry",
});
assert.ifError(hostSubmitError);
assert.equal(hostAccepted.status, "accepted");
assert.equal(hostAccepted.score, 1);

const { data: guestAccepted, error: guestSubmitError } = await guest.rpc("room_submit_answer", {
  p_room_code: roomCode,
  p_normalized_answer: "stephen curry",
});
assert.ifError(guestSubmitError);
assert.equal(guestAccepted.status, "accepted");
assert.equal(guestAccepted.score, 1);

const { data: duplicate, error: duplicateError } = await host.rpc("room_submit_answer", {
  p_room_code: roomCode,
  p_normalized_answer: "stephen curry",
});
assert.ifError(duplicateError);
assert.equal(duplicate.status, "duplicate");
assert.equal(duplicate.score, 1);

const { data: invalid, error: invalidError } = await host.rpc("room_submit_answer", {
  p_room_code: roomCode,
  p_normalized_answer: "not a current player",
});
assert.ifError(invalidError);
assert.equal(invalid.status, "invalid");

const { data: activeGuestGame, error: activeGuestError } = await guest.rpc("room_get_game", { p_room_code: roomCode });
assert.ifError(activeGuestError);
assert.equal(activeGuestGame.game.players.find((player) => player.id === guestId).answers[0].canonicalText, "Stephen Curry");
assert.equal(activeGuestGame.game.players.find((player) => player.id === hostId).answers, null);

const hostWatchesGuest = host.channel(`room:${roomCode}:player:${guestId}`, {
  config: { private: true, broadcast: { ack: true }, presence: { key: hostId } },
});
const receivedTyping = new Promise((resolve) => {
  hostWatchesGuest.on("broadcast", { event: "typing" }, ({ payload }) => resolve(payload));
});
assert.equal(await subscribe(hostWatchesGuest), "SUBSCRIBED");

const guestOwn = guest.channel(`room:${roomCode}:player:${guestId}`, {
  config: { private: true, broadcast: { ack: true }, presence: { key: guestId } },
});
assert.equal(await subscribe(guestOwn), "SUBSCRIBED");
assert.equal(await guestOwn.track({ online: true }), "ok");
assert.equal(await guestOwn.send({ type: "broadcast", event: "typing", payload: { typing: true, lengthBucket: 2 } }), "ok");
assert.deepEqual(await Promise.race([receivedTyping, new Promise((resolve) => setTimeout(() => resolve(null), 4_000))]), {
  typing: true,
  lengthBucket: 2,
});

const guestTargetsHost = guest.channel(`room:${roomCode}:player:${hostId}`, {
  config: { private: true, broadcast: { ack: true } },
});
assert.equal(await subscribe(guestTargetsHost), "SUBSCRIBED");
assert.notEqual(
  await guestTargetsHost.send({ type: "broadcast", event: "typing", payload: { typing: true, lengthBucket: 3 } }),
  "ok",
);

const outsiderTargetsHost = outsider.channel(`room:${roomCode}:player:${hostId}`, {
  config: { private: true, broadcast: { ack: true } },
});
assert.notEqual(await subscribe(outsiderTargetsHost), "SUBSCRIBED");

console.log(`ROOM_PHASE5_READY ${roomCode}`);
const lineReader = readline.createInterface({ input: process.stdin, output: process.stdout });
await lineReader.question("");
lineReader.close();

const { data: completed, error: completedError } = await host.rpc("room_get_game", { p_room_code: roomCode });
assert.ifError(completedError);
assert.equal(completed.game.status, "completed");
assert.ok(completed.game.players.every((player) => Array.isArray(player.answers)));
assert.ok(completed.game.players.every((player) => player.answers[0]?.canonicalText === "Stephen Curry"));

for (const entry of [host, guest, outsider]) {
  await entry.removeAllChannels();
  await entry.auth.signOut();
}

console.log("Room game hostile-client checks passed: per-player scoring, active answer secrecy, private owned Realtime topics, deadline completion, and post-round reveal.");
