import { describe, expect, it } from "vitest";

import {
  parseCategoryReviewDecisionPayload,
  parseCategoryReviewDecisionRequest,
  parseCategoryReviewerStatusPayload,
  parseCategoryReviewQueuePayload,
} from "@/lib/category-review-contract";

const queueItem = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  prompt: "How many European capitals can you name?",
  sourceNotes: "Official geographic source",
  coverageNotes: "Sovereign national capitals only",
  submittedAt: "2026-07-21T01:00:00.000Z",
  reviewRevision: 1,
};

describe("category review contracts", () => {
  it("accepts bounded reviewer status and queue projections", () => {
    expect(parseCategoryReviewerStatusPayload({
      serverNow: "2026-07-21T01:01:00.000Z",
      authorized: false,
    }).authorized).toBe(false);
    expect(parseCategoryReviewQueuePayload({
      serverNow: "2026-07-21T01:01:00.000Z",
      authorized: true,
      drafts: [queueItem],
    }).drafts).toEqual([queueItem]);
  });

  it("requires an authorized queue and a positive review revision", () => {
    expect(() => parseCategoryReviewQueuePayload({
      serverNow: "2026-07-21T01:01:00.000Z",
      authorized: false,
      drafts: [],
    })).toThrow("queue payload");
    expect(() => parseCategoryReviewQueuePayload({
      serverNow: "2026-07-21T01:01:00.000Z",
      authorized: true,
      drafts: [{ ...queueItem, reviewRevision: 0 }],
    })).toThrow("reviewRevision");
  });

  it("normalizes bounded decision notes and rejects control characters", () => {
    expect(parseCategoryReviewDecisionRequest({
      decision: "request-changes",
      note: "  Clarify   whether territories are included. ",
    })).toEqual({
      decision: "request-changes",
      note: "Clarify whether territories are included.",
    });
    expect(parseCategoryReviewDecisionRequest({
      decision: "reject",
      note: "Invalid\nreview note",
    })).toBeNull();
  });

  it("couples each decision to its safe owner-visible status", () => {
    const payload = {
      draftId: queueItem.id,
      decision: "scope-approve",
      reviewStatus: "scope-approved",
      reviewRevision: 1,
      decidedAt: "2026-07-21T01:02:00.000Z",
    };
    expect(parseCategoryReviewDecisionPayload(payload)).toEqual(payload);
    expect(() => parseCategoryReviewDecisionPayload({
      ...payload,
      reviewStatus: "rejected",
    })).toThrow("decision payload");
  });
});
