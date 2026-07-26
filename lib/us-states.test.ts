import { describe, expect, it } from "vitest";

import { buildAnswerLookup, matchAnswer } from "@/lib/game-logic";
import { getPracticeCategory } from "@/lib/practice-categories";
import { normalizeAnswer } from "@/lib/normalize";
import { usStateRecords, usStatesCategory } from "@/lib/us-states";

describe("reviewed U.S. states practice category", () => {
  it("contains exactly 50 unique states and excludes non-state jurisdictions", () => {
    expect(usStateRecords).toHaveLength(50);
    const names = usStateRecords.map(([name]) => normalizeAnswer(name));
    expect(new Set(names).size).toBe(50);
    expect(names).not.toContain(normalizeAnswer("District of Columbia"));
    expect(names).not.toContain(normalizeAnswer("Puerto Rico"));
  });

  it("uses Census regions that cover every state exactly once", () => {
    const counts = usStateRecords.reduce<Record<string, number>>(
      (totals, [, , region]) => ({
        ...totals,
        [region]: (totals[region] ?? 0) + 1,
      }),
      {},
    );
    expect(counts.northeast).toBe(9);
    expect(counts.midwest).toBe(12);
    expect(counts.south).toBe(16);
    expect(counts.west).toBe(13);
    expect(usStatesCategory.answers.every((answer) => answer.groupIds?.length === 1)).toBe(true);
  });

  it("matches official names without risky two-letter auto-accept aliases", () => {
    const lookup = buildAnswerLookup(usStatesCategory.answers);
    expect(matchAnswer("North Carolina", lookup)?.canonicalText).toBe("North Carolina");
    expect(matchAnswer("NC", lookup)).toBeNull();
    expect(() => buildAnswerLookup(usStatesCategory.answers)).not.toThrow();
  });

  it("is available through the reviewed local-practice registry", () => {
    expect(getPracticeCategory("us-states")).toBe(usStatesCategory);
    expect(getPracticeCategory("chemical-elements")).not.toBeNull();
    expect(getPracticeCategory("unknown")).toBeNull();
  });
});
