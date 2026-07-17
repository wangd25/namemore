import { describe, expect, it } from "vitest";

import { currentNbaPlayersCategory } from "@/lib/categories";
import {
  buildSpoilerFreeShareText,
  calculatePracticeStats,
  feedbackPreferenceStorageKey,
  getQuickPairFeedback,
  getPracticeBestStorageKey,
  readFeedbackPreference,
  readPracticeBest,
  writeFeedbackPreference,
  writePracticeBest,
} from "@/lib/practice-game";

function createMemoryStorage(initialValue: string | null = null) {
  let value = initialValue;

  return {
    getItem: () => value,
    setItem: (_key: string, nextValue: string) => {
      value = nextValue;
    },
    value: () => value,
  };
}

describe("practice game helpers", () => {
  it("creates natural quick-pair feedback only for genuinely fast answers", () => {
    expect(getQuickPairFeedback(1_000, 1_620)).toEqual({
      gapMs: 620,
      message: "Two in 0.62s. That was filthy.",
    });
    expect(getQuickPairFeedback(1_000, 2_420)).toEqual({
      gapMs: 1_420,
      message: "Two in 1.42s — damn.",
    });
    expect(getQuickPairFeedback(1_000, 3_100)).toEqual({
      gapMs: 2_100,
      message: "Two in 2.10s. You’re cooking.",
    });
    expect(getQuickPairFeedback(1_000, 3_501)).toBeNull();
    expect(getQuickPairFeedback(2_000, 1_000)).toBeNull();
  });

  it("calculates timing and NBA team coverage from accepted events", () => {
    const [curry, tatum, jokic] = currentNbaPlayersCategory.answers.filter(
      (answer) =>
        [
          "nba-stephen-curry",
          "nba-jayson-tatum",
          "nba-nikola-jokic",
        ].includes(answer.id),
    );

    if (!curry || !tatum || !jokic) {
      throw new Error("Expected test players in the NBA category.");
    }

    const stats = calculatePracticeStats({
      acceptedEvents: [
        { answer: curry, acceptedAtMs: 2_000 },
        { answer: tatum, acceptedAtMs: 5_500 },
        { answer: jokic, acceptedAtMs: 9_000 },
      ],
      startedAtMs: 1_000,
      endedAtMs: 11_000,
      duplicateCount: 2,
    });

    expect(stats.answerCount).toBe(3);
    expect(stats.answersPerMinute).toBe(18);
    expect(stats.fastestGapMs).toBe(3_500);
    expect(stats.longestPauseMs).toBe(3_500);
    expect(stats.duplicateCount).toBe(2);
    expect(stats.representedTeamCodes).toEqual(["BOS", "DEN", "GSW"]);
    expect(stats.missedTeamCodes).toHaveLength(27);
    expect(stats.timeline.map((entry) => entry.elapsedSeconds)).toEqual([
      1, 4.5, 8,
    ]);
  });

  it("handles a round without enough answers for a fastest gap", () => {
    const answer = currentNbaPlayersCategory.answers[0];
    const stats = calculatePracticeStats({
      acceptedEvents: [{ answer, acceptedAtMs: 2_000 }],
      startedAtMs: 1_000,
      endedAtMs: 6_000,
      duplicateCount: 0,
    });

    expect(stats.fastestGapMs).toBeNull();
    expect(stats.longestPauseMs).toBe(4_000);
  });

  it("reads and writes versioned local practice preferences safely", () => {
    const bestStorage = createMemoryStorage();
    const bestKey = getPracticeBestStorageKey(currentNbaPlayersCategory);

    expect(readPracticeBest(bestStorage, bestKey)).toBe(0);
    expect(writePracticeBest(bestStorage, bestKey, 14)).toBe(true);
    expect(readPracticeBest(bestStorage, bestKey)).toBe(14);

    const feedbackStorage = createMemoryStorage();
    expect(readFeedbackPreference(feedbackStorage)).toBe(true);
    expect(writeFeedbackPreference(feedbackStorage, false)).toBe(true);
    expect(readFeedbackPreference(feedbackStorage)).toBe(false);
    expect(feedbackPreferenceStorageKey).toBe("namemore:feedback:v1");
  });

  it("ignores corrupt, obsolete, and unavailable local storage", () => {
    const corruptStorage = createMemoryStorage("not-json");
    const wrongVersion = createMemoryStorage(
      JSON.stringify({ version: 2, score: 99, enabled: false }),
    );
    const unavailableStorage = {
      getItem: () => {
        throw new Error("Storage unavailable");
      },
      setItem: () => {
        throw new Error("Storage unavailable");
      },
    };

    expect(readPracticeBest(corruptStorage, "best")).toBe(0);
    expect(readPracticeBest(wrongVersion, "best")).toBe(0);
    expect(readPracticeBest(unavailableStorage, "best")).toBe(0);
    expect(writePracticeBest(unavailableStorage, "best", 4)).toBe(false);
    expect(readFeedbackPreference(wrongVersion)).toBe(true);
    expect(writeFeedbackPreference(unavailableStorage, false)).toBe(false);
  });

  it("builds a spoiler-free share summary", () => {
    const shareText = buildSpoilerFreeShareText({
      categoryTitle: "Current NBA Players",
      score: 13,
      representedTeamCount: 8,
    });

    expect(shareText).toContain("13 names · 8/30 NBA teams");
    expect(shareText).toContain("◆◆•••");
    expect(shareText).not.toContain("Stephen Curry");
    expect(shareText).toContain("Local practice · not ranked");
  });
});
