import { describe, expect, it } from "vitest";

import {
  formatAnswerBankText,
  parseAnswerBankText,
  parseCategoryBankPayload,
  parseCategoryBankQueuePayload,
  parseCategoryBankSaveRequest,
} from "@/lib/category-bank-contract";

const bank = {
  draftId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  prompt: "How many European capitals can you name?",
  sourceNotes: "Official geographic source",
  coverageNotes: "Sovereign national capitals only",
  revision: 1,
  status: "editing",
  reviewStatus: "unreviewed",
  snapshotDate: "2026-07-21",
  timeLimitSeconds: 90,
  sourceLabel: "Official geographic list",
  sourceUrl: "https://example.org/source",
  versionNote: "Initial reviewed snapshot.",
  competitiveEligible: false,
  updatedAt: "2026-07-21T17:00:00.000Z",
  submittedAt: null,
  latestReview: null,
  answers: [{ canonicalText: "Copenhagen", aliases: ["København"] }],
};

describe("category bank contracts", () => {
  it("round-trips canonical lines and explicit aliases", () => {
    const text = "Luka Dončić | Luka\nLeBron James | LeBron";
    const parsed = parseAnswerBankText(text);
    expect(parsed.canonicalCount).toBe(2);
    expect(parsed.aliasCount).toBe(2);
    expect(parsed.errors).toEqual([]);
    expect(formatAnswerBankText(parsed.answers)).toBe("Luka Dončić | Luka\nLeBron James | LeBron");
  });

  it("catches accent-insensitive and cross-answer collisions deterministically", () => {
    const parsed = parseAnswerBankText("Luka Dončić | Luka Doncic\nLeBron James | Luka Doncic");
    expect(parsed.errors).toEqual([
      "“Luka Doncic” collides with “Luka Dončić”.",
      "“Luka Doncic” collides with “Luka Dončić”.",
    ].filter((value, index, values) => values.indexOf(value) === index));
  });

  it("parses only coupled private revision lifecycle payloads", () => {
    expect(parseCategoryBankPayload(bank)).toEqual(bank);
    expect(() => parseCategoryBankPayload({ ...bank, status: "review-ready" })).toThrow("lifecycle");
    expect(() => parseCategoryBankPayload({ ...bank, reviewStatus: "approved" })).toThrow("lifecycle");
    expect(() => parseCategoryBankPayload({ ...bank, competitiveEligible: true })).toThrow("payload");
    expect(parseCategoryBankQueuePayload({
      serverNow: "2026-07-21T17:00:01.000Z",
      authorized: true,
      drafts: [{
        draftId: bank.draftId,
        prompt: bank.prompt,
        sourceNotes: bank.sourceNotes,
        coverageNotes: bank.coverageNotes,
        revision: 1,
        status: "editing",
        available: true,
        publicationCorrection: null,
        bank,
      }],
    }).drafts[0].bank).toEqual(bank);
  });

  it("bounds metadata and requires HTTPS provenance", () => {
    const input = {
      snapshotDate: "2026-07-21",
      timeLimitSeconds: 90,
      sourceLabel: "  Official source  ",
      sourceUrl: "https://example.org/source",
      versionNote: "  First   reviewed snapshot. ",
      answers: bank.answers,
    };
    expect(parseCategoryBankSaveRequest(input)).toEqual({
      ...input,
      sourceLabel: "Official source",
      versionNote: "First reviewed snapshot.",
    });
    expect(parseCategoryBankSaveRequest({ ...input, sourceUrl: "http://example.org/source" })).toBeNull();
  });
});
