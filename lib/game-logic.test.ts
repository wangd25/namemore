import { describe, expect, it } from "vitest";

import type { CategoryAnswer } from "@/lib/category-types";
import { currentNbaPlayersCategory } from "@/lib/categories";
import {
  buildAnswerLookup,
  evaluateAnswerSubmission,
  matchAnswer,
  shouldDelayAutomaticMatch,
} from "@/lib/game-logic";

const lookup = buildAnswerLookup(currentNbaPlayersCategory.answers);

describe("answer matching", () => {
  it("matches canonical names, curated aliases, and unique surnames", () => {
    expect(matchAnswer("Stephen Curry", lookup)?.canonicalText).toBe(
      "Stephen Curry",
    );
    expect(matchAnswer("Steph", lookup)?.canonicalText).toBe("Stephen Curry");
    expect(matchAnswer("Curry", lookup)?.canonicalText).toBe("Stephen Curry");
    expect(matchAnswer("James", lookup)?.canonicalText).toBe("LeBron James");
    expect(matchAnswer("Joker", lookup)?.canonicalText).toBe("Nikola Jokić");
  });

  it("rejects ambiguous surnames and invalid answers", () => {
    expect(matchAnswer("Williams", lookup)).toBeNull();
    expect(matchAnswer("Michael Jordan", lookup)).toBeNull();
    expect(matchAnswer("   ", lookup)).toBeNull();
  });

  it("delays exact aliases that prefix another player's valid name", () => {
    expect(shouldDelayAutomaticMatch("Ja", lookup)).toBe(true);
    expect(shouldDelayAutomaticMatch("Steph", lookup)).toBe(true);
    expect(shouldDelayAutomaticMatch("Stephen Curry", lookup)).toBe(false);
    expect(shouldDelayAutomaticMatch("Jalen Green", lookup)).toBe(false);
  });

  it("rejects aliases that map to different canonical answers", () => {
    const answers: CategoryAnswer[] = [
      {
        id: "one",
        canonicalText: "Alpha Player",
        aliases: ["Ace"],
        teamCode: "ATL",
      },
      {
        id: "two",
        canonicalText: "Beta Player",
        aliases: ["Ace"],
        teamCode: "BOS",
      },
    ];

    expect(() => buildAnswerLookup(answers)).toThrow(/Alias collision/);
  });
});

describe("evaluateAnswerSubmission", () => {
  it("scores new canonical IDs and rejects canonical duplicates", () => {
    const accepted = evaluateAnswerSubmission(
      "Steph",
      lookup,
      new Set(),
      false,
    );

    expect(accepted).toMatchObject({ status: "accepted", score: 1 });

    if (accepted.status !== "accepted") {
      throw new Error("Expected the alias to be accepted.");
    }

    const duplicate = evaluateAnswerSubmission(
      "Stephen Curry",
      lookup,
      new Set([accepted.answer.id]),
      false,
    );

    expect(duplicate.status).toBe("duplicate");
  });

  it("rejects invalid and late submissions", () => {
    expect(
      evaluateAnswerSubmission("Not A Player", lookup, new Set(), false),
    ).toEqual({ status: "invalid" });
    expect(
      evaluateAnswerSubmission("Stephen Curry", lookup, new Set(), true),
    ).toEqual({ status: "round-ended" });
  });
});
