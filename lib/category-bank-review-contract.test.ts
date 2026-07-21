import { describe, expect, it } from "vitest";

import {
  parseCategoryBankDecisionPayload,
  parseCategoryBankDecisionRequest,
  parseCategoryBankReviewQueuePayload,
} from "@/lib/category-bank-review-contract";

const bank = {
  draftId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  prompt: "How many European capitals can you name?",
  sourceNotes: "Official geographic source",
  coverageNotes: "Sovereign national capitals only",
  revision: 1,
  status: "review-ready",
  reviewStatus: "pending",
  snapshotDate: "2026-07-21",
  timeLimitSeconds: 90,
  sourceLabel: "Official geographic list",
  sourceUrl: "https://example.org/source",
  versionNote: "Initial reviewed snapshot.",
  competitiveEligible: false,
  updatedAt: "2026-07-21T18:00:00.000Z",
  submittedAt: "2026-07-21T18:00:00.000Z",
  latestReview: null,
  answers: [{ canonicalText: "Copenhagen", aliases: ["København"] }],
};

describe("category bank review contracts", () => {
  it("accepts only pending frozen banks in the independent queue", () => {
    const queue = parseCategoryBankReviewQueuePayload({
      serverNow: "2026-07-21T18:01:00.000Z",
      authorized: true,
      banks: [bank],
    });
    expect(queue.banks[0]).toEqual(bank);
    expect(() => parseCategoryBankReviewQueuePayload({
      serverNow: "2026-07-21T18:01:00.000Z",
      authorized: true,
      banks: [{ ...bank, reviewStatus: "approved" }],
    })).toThrow();
  });

  it("normalizes bounded reviewer notes and rejects controls", () => {
    expect(parseCategoryBankDecisionRequest({ decision: "approve", note: "  Evidence   supports this bank. " })).toEqual({
      decision: "approve",
      note: "Evidence supports this bank.",
    });
    expect(parseCategoryBankDecisionRequest({ decision: "approve", note: "short" })).toBeNull();
    expect(parseCategoryBankDecisionRequest({ decision: "approve", note: "Invalid\nreview note" })).toBeNull();
  });

  it("couples each decision to its resulting private review status", () => {
    const payload = {
      draftId: bank.draftId,
      revision: 1,
      decision: "request-correction",
      reviewStatus: "changes-requested",
      decidedAt: "2026-07-21T18:02:00.000Z",
      competitiveEligible: false,
    };
    expect(parseCategoryBankDecisionPayload(payload)).toEqual(payload);
    expect(() => parseCategoryBankDecisionPayload({ ...payload, reviewStatus: "approved" })).toThrow("decision");
    expect(() => parseCategoryBankDecisionPayload({ ...payload, competitiveEligible: true })).toThrow("decision");
  });
});
