import { afterEach, describe, expect, it, vi } from "vitest";

import { generateCategoryAiDraft } from "@/lib/category-ai-server";
import type { CategoryBankPayload } from "@/lib/category-bank-types";

const bank: CategoryBankPayload = {
  draftId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  prompt: "How many European capitals can you name?",
  sourceNotes: "Use official national government sources.",
  coverageNotes: "Sovereign national capitals only.",
  revision: 1,
  status: "editing",
  reviewStatus: "unreviewed",
  snapshotDate: null,
  timeLimitSeconds: null,
  sourceLabel: null,
  sourceUrl: null,
  versionNote: null,
  competitiveEligible: false,
  updatedAt: "2026-07-25T20:00:00.000Z",
  submittedAt: null,
  latestReview: null,
  answers: [],
};

function providerResponse(value: unknown) {
  return new Response(JSON.stringify({
    output: [{
      type: "message",
      content: [{ type: "output_text", text: JSON.stringify(value) }],
    }],
  }));
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("AI category draft server", () => {
  it("uses the Responses API and returns only a validated private candidate", async () => {
    vi.stubEnv("OPENAI_API_KEY", "configured-for-test");
    const fetchMock = vi.fn().mockResolvedValue(providerResponse({
      answers: [
        { canonicalText: "Lisbon", aliases: ["Lisboa"] },
        { canonicalText: "Copenhagen", aliases: ["København"] },
      ],
      sourceSuggestions: [{
        label: "Official geographic source",
        url: "https://example.org/geography",
      }],
      coverageWarnings: [],
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateCategoryAiDraft(
      bank,
      "reviewer_privacy_preserving_id",
      "gpt-5.6-terra",
    );

    expect(result.status).toBe("needs-verification");
    expect(result.validation.canonicalCount).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = JSON.parse(fetchMock.mock.calls[0][1].body as string) as {
      model: string;
      store: boolean;
      safety_identifier: string;
      tools: Array<{ type: string }>;
      text: { format: { type: string; strict: boolean } };
    };
    expect(request).toMatchObject({
      model: "gpt-5.6-terra",
      store: false,
      safety_identifier: "reviewer_privacy_preserving_id",
      tools: [{ type: "web_search" }],
      text: { format: { type: "json_schema", strict: true } },
    });
  });

  it("allows one repair attempt when deterministic validation fails", async () => {
    vi.stubEnv("OPENAI_API_KEY", "configured-for-test");
    const invalid = {
      answers: [
        { canonicalText: "São Tomé", aliases: [] },
        { canonicalText: "Sao Tome", aliases: [] },
      ],
      sourceSuggestions: [{
        label: "Official geographic source",
        url: "https://example.org/geography",
      }],
      coverageWarnings: [],
    };
    const repaired = {
      ...invalid,
      answers: [
        { canonicalText: "São Tomé", aliases: [] },
        { canonicalText: "Lisbon", aliases: [] },
      ],
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(providerResponse(invalid))
      .mockResolvedValueOnce(providerResponse(repaired));
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateCategoryAiDraft(
      bank,
      "reviewer_privacy_preserving_id",
      "gpt-5.6-terra",
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.answers.map((answer) => answer.canonicalText)).toEqual([
      "São Tomé",
      "Lisbon",
    ]);
  });
});
