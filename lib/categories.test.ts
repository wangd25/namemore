import { describe, expect, it } from "vitest";

import { currentNbaPlayersCategory } from "@/lib/categories";
import { nbaTeamCodes } from "@/lib/category-types";
import { buildAnswerLookup } from "@/lib/game-logic";
import { normalizeAnswer, toStableAnswerId } from "@/lib/normalize";

describe("current NBA players category", () => {
  const { answers } = currentNbaPlayersCategory;

  it("has stable version and snapshot metadata", () => {
    expect(currentNbaPlayersCategory.slug).toBe("current-nba-players");
    expect(currentNbaPlayersCategory.version).toBe(1);
    expect(currentNbaPlayersCategory.snapshotDate).toBe("2026-07-15");
    expect(currentNbaPlayersCategory.timeLimitSeconds).toBe(90);
  });

  it("contains exactly 300 players across 30 ten-player teams", () => {
    const teamCounts = new Map<string, number>();

    for (const answer of answers) {
      teamCounts.set(answer.teamCode, (teamCounts.get(answer.teamCode) ?? 0) + 1);
    }

    expect(answers).toHaveLength(300);
    expect(teamCounts.size).toBe(30);

    for (const teamCode of nbaTeamCodes) {
      expect(teamCounts.get(teamCode)).toBe(10);
    }
  });

  it("has unique canonical names and stable unique IDs", () => {
    const normalizedNames = answers.map((answer) =>
      normalizeAnswer(answer.canonicalText),
    );
    const ids = answers.map((answer) => answer.id);

    expect(new Set(normalizedNames).size).toBe(answers.length);
    expect(new Set(ids).size).toBe(answers.length);

    for (const answer of answers) {
      expect(answer.id).toBe(`nba-${toStableAnswerId(answer.canonicalText)}`);
    }
  });

  it("builds the full lookup without normalized alias collisions", () => {
    expect(() => buildAnswerLookup(answers)).not.toThrow();
  });

  it("includes LeBron James in the Lakers snapshot", () => {
    expect(
      answers.find((answer) => answer.canonicalText === "LeBron James"),
    ).toMatchObject({ teamCode: "LAL" });
  });
});
