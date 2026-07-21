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

const creator = client();
const joiner = client();
await Promise.all([signIn(creator), signIn(joiner)]);

const directRead = await creator.schema("private").from("anonymous_action_events").select("*");
assert.ok(directRead.error, "direct abuse-event read unexpectedly succeeded");

const runId = String(Date.now()).slice(-8);
for (let index = 1; index <= 5; index += 1) {
  const { data, error } = await creator.rpc("room_create", {
    p_display_name: `QA Abuse ${runId} ${index}`,
    p_mode: index % 2 === 0 ? "elimination" : "private-race",
  });
  assert.ifError(error);
  assert.match(data.room.code, /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/);
}

const sixthCreate = await creator.rpc("room_create", {
  p_display_name: `QA Abuse ${runId} 6`,
  p_mode: "private-race",
});
assert.ifError(sixthCreate.error);
assert.deepEqual(sixthCreate.data, { _roomError: "rate-limited" });

for (let index = 0; index < 30; index += 1) {
  const missingJoin = await joiner.rpc("room_join", {
    p_room_code: "ZZZZZZZZ",
    p_display_name: `QA Join ${runId}`,
  });
  assert.ifError(missingJoin.error);
  assert.deepEqual(missingJoin.data, { _roomError: "not-found" });
}

const limitedJoin = await joiner.rpc("room_join", {
  p_room_code: "ZZZZZZZZ",
  p_display_name: `QA Join ${runId}`,
});
assert.ifError(limitedJoin.error);
assert.deepEqual(limitedJoin.data, { _roomError: "rate-limited" });

await Promise.all([creator.auth.signOut(), joiner.auth.signOut()]);

console.log(
  `Room abuse checks passed for QA run ${runId}: private event storage, five-per-hour creation, and thirty-per-ten-minute join limits.`,
);
