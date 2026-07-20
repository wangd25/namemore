import { describe, expect, it } from "vitest";

import {
  normalizeRoomCode,
  parseCreateRoomRequest,
  parseRoomPayload,
} from "@/lib/room-contract";

const roomPayload = {
  serverNow: "2026-07-20T12:00:00.000Z",
  room: {
    code: "K7M4Q2PX",
    status: "waiting",
    mode: "private-race",
    capacity: 8,
    playerCount: 1,
    createdAt: "2026-07-20T12:00:00.000Z",
    startedAt: null,
    deadlineAt: null,
    endedAt: null,
    category: {
      slug: "current-nba-players",
      version: 1,
      title: "Current NBA players",
      prompt: "How many NBA players can you name?",
      timeLimitSeconds: 90,
    },
    membership: {
      playerId: "11111111-1111-4111-8111-111111111111",
      displayName: "Room Host",
      isHost: true,
    },
    participants: [{
      id: "11111111-1111-4111-8111-111111111111",
      displayName: "Room Host",
      isHost: true,
      joinedAt: "2026-07-20T12:00:00.000Z",
      connected: true,
    }],
  },
};

describe("room API contracts", () => {
  it("normalizes only non-ambiguous eight-character codes", () => {
    expect(normalizeRoomCode(" k7m4q2px ")).toBe("K7M4Q2PX");
    expect(normalizeRoomCode("K7M4Q2P0")).toBeNull();
    expect(normalizeRoomCode("short")).toBeNull();
  });

  it("parses the narrow member projection", () => {
    expect(parseRoomPayload(roomPayload).room.membership?.isHost).toBe(true);
    expect(parseRoomPayload(roomPayload).room.participants).toHaveLength(1);
  });

  it("allows a safe outsider preview without participant names", () => {
    const payload = parseRoomPayload({
      ...roomPayload,
      room: { ...roomPayload.room, membership: null, participants: [] },
    });
    expect(payload.room.membership).toBeNull();
    expect(payload.room.participants).toEqual([]);
    expect(payload.room.playerCount).toBe(1);
  });

  it("rejects forged visibility, capacity, and display names", () => {
    expect(() => parseRoomPayload({
      ...roomPayload,
      room: { ...roomPayload.room, membership: null },
    })).toThrow("Invalid room visibility");
    expect(() => parseRoomPayload({
      ...roomPayload,
      room: { ...roomPayload.room, capacity: 99 },
    })).toThrow("Invalid room capacity");
    expect(parseCreateRoomRequest({ displayName: "  Room   Host " })).toEqual({ displayName: "Room Host" });
    expect(parseCreateRoomRequest({ displayName: "<script>" })).toBeNull();
  });
});
