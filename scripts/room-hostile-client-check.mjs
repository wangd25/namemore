import assert from "node:assert/strict";

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

async function assertDenied(label, operation) {
  const { data, error } = await operation();
  assert.ok(error || roomErrorCode(data), `${label} unexpectedly succeeded.`);
}

function roomErrorCode(data) {
  return data && typeof data === "object" && typeof data._roomError === "string"
    ? data._roomError
    : null;
}

function requestWasDenied(result) {
  return result.error !== null || roomErrorCode(result.data) !== null;
}

const unsigned = client();
await assertDenied("unsigned room create", () => unsigned.rpc("room_create", { p_display_name: "Unsigned" }));

const clients = Array.from({ length: 11 }, () => client());
const authResults = await Promise.all(clients.map((entry) => entry.auth.signInAnonymously()));
authResults.forEach(({ data, error }) => {
  assert.ifError(error);
  assert.ok(data.user?.is_anonymous);
});

const [host, guest, outsider, ...candidates] = clients;
await assertDenied("direct room read", () => host.from("rooms").select("*"));
await assertDenied("direct player read", () => host.from("room_players").select("*"));
await assertDenied("direct room insert", () => host.from("rooms").insert({}));

const runId = String(Date.now()).slice(-6);
const hostName = `QA ${runId} Host`;
const { data: created, error: createError } = await host.rpc("room_create", { p_display_name: hostName });
assert.ifError(createError);
assert.match(created.room.code, /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/);
assert.equal(created.room.status, "waiting");
assert.equal(created.room.membership.isHost, true);
assert.equal(created.room.participants.length, 1);
assert.equal("id" in created.room, false);
const roomCode = created.room.code;

const { data: outsiderPreview, error: outsiderError } = await outsider.rpc("room_get_status", { p_room_code: roomCode });
assert.ifError(outsiderError);
assert.equal(outsiderPreview.room.membership, null);
assert.deepEqual(outsiderPreview.room.participants, []);
assert.equal(outsiderPreview.room.playerCount, 1);
assert.equal(JSON.stringify(outsiderPreview).includes(hostName), false);

const guestName = `QA ${runId} Guest`;
const { data: joined, error: joinError } = await guest.rpc("room_join", {
  p_room_code: roomCode,
  p_display_name: guestName,
});
assert.ifError(joinError);
assert.equal(joined.room.playerCount, 2);
assert.equal(joined.room.participants.length, 2);
assert.equal(joined.room.membership.isHost, false);

const { data: rejoined, error: rejoinError } = await guest.rpc("room_join", {
  p_room_code: roomCode,
  p_display_name: guestName,
});
assert.ifError(rejoinError);
assert.equal(rejoined.room.membership.playerId, joined.room.membership.playerId);
assert.equal(rejoined.room.playerCount, 2);

await assertDenied("membership rename", () => guest.rpc("room_join", {
  p_room_code: roomCode,
  p_display_name: `QA ${runId} Renamed`,
}));
await assertDenied("non-host start", () => guest.rpc("room_start", { p_room_code: roomCode }));
await assertDenied("direct deadline write", () => host.from("rooms").update({
  status: "active",
  started_at: "2000-01-01T00:00:00Z",
  deadline_at: "2099-01-01T00:00:00Z",
}).eq("public_code", roomCode));

for (let index = 0; index < 5; index += 1) {
  const { error } = await candidates[index].rpc("room_join", {
    p_room_code: roomCode,
    p_display_name: `QA ${runId} Player ${index + 3}`,
  });
  assert.ifError(error);
}

const capacityRace = await Promise.all([
  candidates[5].rpc("room_join", { p_room_code: roomCode, p_display_name: `QA ${runId} Player 8A` }),
  candidates[6].rpc("room_join", { p_room_code: roomCode, p_display_name: `QA ${runId} Player 8B` }),
]);
assert.equal(capacityRace.filter((result) => !requestWasDenied(result)).length, 1);
assert.equal(capacityRace.filter(requestWasDenied).length, 1);

const { data: fullStatus, error: fullStatusError } = await host.rpc("room_get_status", { p_room_code: roomCode });
assert.ifError(fullStatusError);
assert.equal(fullStatus.room.playerCount, 8);
assert.equal(fullStatus.room.participants.length, 8);

const { data: started, error: startError } = await host.rpc("room_start", { p_room_code: roomCode });
assert.ifError(startError);
assert.equal(started.room.status, "active");
assert.equal(
  Date.parse(started.room.deadlineAt) - Date.parse(started.room.startedAt),
  started.room.category.timeLimitSeconds * 1_000,
);

await assertDenied("late join", () => candidates[7].rpc("room_join", {
  p_room_code: roomCode,
  p_display_name: `QA ${runId} Late`,
}));

const { data: afterStartRejoin, error: afterStartRejoinError } = await guest.rpc("room_join", {
  p_room_code: roomCode,
  p_display_name: guestName,
});
assert.ifError(afterStartRejoinError);
assert.equal(afterStartRejoin.room.status, "active");
assert.equal(afterStartRejoin.room.membership.playerId, joined.room.membership.playerId);

await Promise.all(clients.map((entry) => entry.auth.signOut()));
console.log("Room hostile-client checks passed: hidden membership, atomic capacity, stable rejoin, host-only start, late-join denial, and server-owned timestamps.");
