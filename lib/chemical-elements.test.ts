import { describe, expect, it } from "vitest";

import {
  chemicalElementRecords,
  chemicalElementsCategory,
} from "@/lib/chemical-elements";
import { buildAnswerLookup, matchAnswer } from "@/lib/game-logic";
import { normalizeAnswer } from "@/lib/normalize";
import { getPracticeCategory } from "@/lib/practice-categories";

describe("reviewed chemical elements category", () => {
  it("contains the 118 IUPAC elements in atomic-number order", () => {
    expect(chemicalElementRecords).toHaveLength(118);
    expect(chemicalElementRecords.map(([atomicNumber]) => atomicNumber)).toEqual(
      Array.from({ length: 118 }, (_, index) => index + 1),
    );
    expect(chemicalElementRecords[0]).toEqual([1, "H", "Hydrogen", 1]);
    expect(chemicalElementRecords.at(-1)).toEqual([118, "Og", "Oganesson", 7]);
  });

  it("has unique names, symbols, stable IDs, and collision-free aliases", () => {
    const names = chemicalElementRecords.map(([, , name]) => normalizeAnswer(name));
    const symbols = chemicalElementRecords.map(([, symbol]) => normalizeAnswer(symbol));
    const ids = chemicalElementsCategory.answers.map((answer) => answer.id);

    expect(new Set(names).size).toBe(118);
    expect(new Set(symbols).size).toBe(118);
    expect(new Set(ids).size).toBe(118);
    expect(() => buildAnswerLookup(chemicalElementsCategory.answers)).not.toThrow();
  });

  it("accepts symbols and documented spelling aliases", () => {
    const lookup = buildAnswerLookup(chemicalElementsCategory.answers);

    expect(matchAnswer("Na", lookup)?.canonicalText).toBe("Sodium");
    expect(matchAnswer("aluminum", lookup)?.canonicalText).toBe("Aluminium");
    expect(matchAnswer("cesium", lookup)?.canonicalText).toBe("Caesium");
    expect(matchAnswer("wolfram", lookup)?.canonicalText).toBe("Tungsten");
  });

  it("uses category-neutral symbol and period metadata", () => {
    expect(chemicalElementsCategory.coverage?.groups).toHaveLength(7);
    expect(chemicalElementsCategory.answers.every((answer) => !answer.teamCode)).toBe(true);
    expect(chemicalElementsCategory.answers[10]).toMatchObject({
      canonicalText: "Sodium",
      visual: { label: "Na" },
      groupIds: ["period-3"],
    });
    expect(getPracticeCategory("chemical-elements")).toBe(chemicalElementsCategory);
    expect(getPracticeCategory("unknown")).toBeNull();
  });
});
