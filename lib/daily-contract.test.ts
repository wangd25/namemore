import { describe, expect, it } from "vitest";

import {
  normalizeDisplayName,
  parseDailyLeaderboardPayload,
  parseDailyStatusPayload,
  parseDailySubmissionResult,
  parseFinishRequest,
  parseStartRequest,
  parseSubmitRequest,
} from "@/lib/daily-contract";

const attemptId = "11111111-1111-4111-8111-111111111111";
const acceptedAnswer = {
  id: "nba-stephen-curry",
  canonicalText: "Stephen Curry",
  teamCode: "GSW",
  acceptedAt: "2026-07-17T18:00:10.000Z",
};

describe("daily API contracts", () => {
  it("accepts a complete verified status payload", () => {
    const payload = parseDailyStatusPayload({
      serverNow: "2026-07-17T18:00:12.000Z",
      challenge: {
        id: "22222222-2222-4222-8222-222222222222",
        date: "2026-07-17",
        resetAt: "2026-07-18T00:00:00.000Z",
        category: {
          slug: "current-nba-players",
          version: 1,
          snapshotDate: "2026-07-15",
          title: "Current NBA players",
          prompt: "How many NBA players can you name?",
          timeLimitSeconds: 90,
        },
      },
      attempt: {
        id: attemptId,
        displayName: "Daily Player",
        rankedEligible: false,
        status: "active",
        startedAt: "2026-07-17T18:00:00.000Z",
        deadlineAt: "2026-07-17T18:01:30.000Z",
        completedAt: null,
        score: 1,
        answers: [acceptedAnswer],
      },
    });

    expect(payload.attempt?.answers).toEqual([acceptedAnswer]);
    expect(payload.attempt?.rankedEligible).toBe(false);
  });

  it("requires ranked eligibility to come from the server payload", () => {
    const status = {
      serverNow: "2026-07-17T18:00:12.000Z",
      challenge: null,
      attempt: {
        id: attemptId,
        displayName: "Daily Player",
        status: "completed",
        startedAt: "2026-07-17T18:00:00.000Z",
        deadlineAt: "2026-07-17T18:01:30.000Z",
        completedAt: "2026-07-17T18:00:30.000Z",
        score: 1,
        answers: [acceptedAnswer],
      },
    };

    expect(() => parseDailyStatusPayload(status)).toThrow("Invalid rankedEligible");
  });

  it("normalizes safe display names and rejects malformed public names", () => {
    expect(normalizeDisplayName("  D’Angelo   Fan  ")).toBe("D’Angelo Fan");
    expect(parseStartRequest({ displayName: "  Daily   Player  " })).toEqual({
      displayName: "Daily Player",
    });
    expect(parseStartRequest({ displayName: "A" })).toBeNull();
    expect(parseStartRequest({ displayName: "x".repeat(25) })).toBeNull();
    expect(parseStartRequest({ displayName: "Player\u0000Name" })).toBeNull();
    expect(parseStartRequest({ displayName: "Player\tName" })).toBeNull();
    expect(parseStartRequest({ displayName: "<script>alert(1)</script>" })).toBeNull();
  });

  it("accepts only a safe top-ten leaderboard projection", () => {
    const payload = parseDailyLeaderboardPayload({
      serverNow: "2026-07-17T18:02:00.000Z",
      challenge: {
        date: "2026-07-17",
        category: { slug: "current-nba-players", version: 1 },
      },
      entries: [
        { rank: 1, displayName: "First Player", score: 9, isTied: false },
        { rank: 2, displayName: "Second Player", score: 8, isTied: true },
      ],
    });

    expect(payload.entries).toHaveLength(2);
    expect(Object.keys(payload.entries[0]).sort()).toEqual([
      "displayName",
      "isTied",
      "rank",
      "score",
    ]);
    expect(() => parseDailyLeaderboardPayload({
      serverNow: payload.serverNow,
      challenge: payload.challenge,
      entries: Array.from({ length: 11 }, (_, index) => ({
        rank: index + 1,
        displayName: `Player ${index}`,
        score: 1,
        isTied: true,
      })),
    })).toThrow("Invalid daily leaderboard");
  });

  it("rejects malformed and oversized answer requests", () => {
    expect(parseSubmitRequest({ attemptId: "not-a-uuid", answer: "Curry" })).toBeNull();
    expect(parseSubmitRequest({ attemptId, answer: "x".repeat(81) })).toBeNull();
    expect(parseSubmitRequest({ attemptId, answer: "Curry\nHarden" })).toBeNull();
    expect(parseSubmitRequest({ attemptId, answer: "  Curry  " })).toEqual({ attemptId, answer: "Curry" });
    expect(parseFinishRequest({ attemptId })).toEqual({ attemptId });
  });

  it("requires the server's original acceptance timestamp on duplicates", () => {
    expect(parseDailySubmissionResult({
      status: "duplicate",
      serverNow: "2026-07-17T18:00:20.000Z",
      score: 1,
      answer: acceptedAnswer,
    }).status).toBe("duplicate");

    expect(() => parseDailySubmissionResult({
      status: "duplicate",
      serverNow: "2026-07-17T18:00:20.000Z",
      score: 1,
      answer: { ...acceptedAnswer, acceptedAt: null },
    })).toThrow("Invalid acceptedAt");
  });

  it("rejects unknown teams and impossible attempt states", () => {
    expect(() => parseDailySubmissionResult({
      status: "accepted",
      serverNow: "2026-07-17T18:00:20.000Z",
      score: 1,
      answer: { ...acceptedAnswer, teamCode: "SEA" },
    })).toThrow("Invalid team code");
  });
});
