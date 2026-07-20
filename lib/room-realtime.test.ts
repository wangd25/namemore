import { describe, expect, it } from "vitest";

import {
  buildTypingSignal,
  parseTypingSignal,
  roomPlayerTopic,
} from "@/lib/room-realtime";

describe("room realtime payloads", () => {
  it("broadcasts only a typing boolean and coarse length bucket", () => {
    expect(buildTypingSignal("Stephen Curry")).toEqual({ typing: true, lengthBucket: 3 });
    expect(Object.keys(buildTypingSignal("Stephen Curry")).sort()).toEqual(["lengthBucket", "typing"]);
    expect(JSON.stringify(buildTypingSignal("Stephen Curry"))).not.toContain("Stephen");
  });

  it("rejects text, player identity, extra keys, and malformed buckets", () => {
    expect(parseTypingSignal({ typing: true, lengthBucket: 2 })).toEqual({ typing: true, lengthBucket: 2 });
    expect(parseTypingSignal({ typing: true, lengthBucket: 2, text: "Stephen Curry" })).toBeNull();
    expect(parseTypingSignal({ typing: true, lengthBucket: 2, playerId: "forged" })).toBeNull();
    expect(parseTypingSignal({ typing: false, lengthBucket: 3 })).toBeNull();
    expect(parseTypingSignal({ typing: true, lengthBucket: 4 })).toBeNull();
  });

  it("binds each activity channel to a room and player", () => {
    expect(roomPlayerTopic("K7M4Q2PX", "11111111-1111-4111-8111-111111111111"))
      .toBe("room:K7M4Q2PX:player:11111111-1111-4111-8111-111111111111");
  });
});
