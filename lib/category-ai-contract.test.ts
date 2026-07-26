import { describe, expect, it } from "vitest";

import {
  createCategoryAiDraftPayload,
  parseCategoryAiDraftPayload,
} from "@/lib/category-ai-contract";

const candidate = {
  answers: [
    { canonicalText: "Lisbon", aliases: ["Lisboa"] },
    { canonicalText: "Copenhagen", aliases: ["København"] },
  ],
  sourceSuggestions: [{
    label: "Official geographic source",
    url: "https://example.org/geography",
  }],
  coverageWarnings: ["Confirm the treatment of transcontinental states."],
};

describe("AI category draft contract", () => {
  it("creates a needs-verification payload with deterministic counts", () => {
    const payload = createCategoryAiDraftPayload(
      candidate,
      "gpt-5.6-terra",
      "2026-07-25T20:00:00.000Z",
    );
    expect(payload.status).toBe("needs-verification");
    expect(payload.validation).toEqual({ canonicalCount: 2, aliasCount: 2 });
    expect(parseCategoryAiDraftPayload(payload)).toEqual(payload);
  });

  it("rejects normalized collisions and unsafe source locations", () => {
    expect(() => createCategoryAiDraftPayload({
      ...candidate,
      answers: [
        { canonicalText: "São Tomé", aliases: [] },
        { canonicalText: "Sao Tome", aliases: [] },
      ],
    }, "gpt-5.6-terra")).toThrow("collision");

    expect(() => createCategoryAiDraftPayload({
      ...candidate,
      sourceSuggestions: [{
        label: "Local service",
        url: "https://localhost/private",
      }],
    }, "gpt-5.6-terra")).toThrow("Invalid AI source");
  });

  it("rejects a forged validation summary from the browser", () => {
    const payload = createCategoryAiDraftPayload(candidate, "gpt-5.6-terra");
    expect(() => parseCategoryAiDraftPayload({
      ...payload,
      validation: { canonicalCount: 200, aliasCount: 0 },
    })).toThrow("validation summary");
  });
});
