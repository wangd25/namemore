import { describe, expect, it } from "vitest";

import { parsePublishedPracticeCategory } from "@/lib/published-practice-contract";

const payload = {
  slug: "european-capitals",
  version: 1,
  snapshotDate: "2026-07-21",
  title: "European capitals",
  prompt: "How many European capitals can you name?",
  timeLimitSeconds: 90,
  inputLabel: "Type an answer",
  inputPlaceholder: "Type a name…",
  sourceLabel: "United Nations geographic names",
  competitiveEligible: false,
  answers: [
    { canonicalText: "Copenhagen", aliases: ["København"] },
    { canonicalText: "Lisbon", aliases: ["Lisboa"] },
  ],
};

describe("published practice contract", () => {
  it("builds a category-neutral local-practice category", () => {
    const category = parsePublishedPracticeCategory(payload);
    expect(category.slug).toBe("european-capitals");
    expect(category.answers[0]).toEqual({
      id: "european-capitals-copenhagen",
      canonicalText: "Copenhagen",
      aliases: ["København"],
    });
    expect(category.coverage).toBeUndefined();
  });

  it("rejects competitive, undersized, or malformed payloads", () => {
    expect(() => parsePublishedPracticeCategory({ ...payload, competitiveEligible: true })).toThrow("practice");
    expect(() => parsePublishedPracticeCategory({ ...payload, answers: [payload.answers[0]] })).toThrow("practice");
    expect(() => parsePublishedPracticeCategory({ ...payload, slug: "../private" })).toThrow("metadata");
  });
});
