import { describe, expect, it } from "vitest";

import {
  parseDailyStatusPayload,
  parseDailySubmissionResult,
  parseFinishRequest,
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
        status: "active",
        startedAt: "2026-07-17T18:00:00.000Z",
        deadlineAt: "2026-07-17T18:01:30.000Z",
        completedAt: null,
        score: 1,
        answers: [acceptedAnswer],
      },
    });

    expect(payload.attempt?.answers).toEqual([acceptedAnswer]);
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
