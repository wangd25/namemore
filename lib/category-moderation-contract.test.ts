import { describe, expect, it } from "vitest";

import {
  parseCategoryModerationDecisionRequest,
  parseCategoryModerationQueuePayload,
  parseCategoryReportRequest,
} from "@/lib/category-moderation-contract";

const report = {
  reportId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  categorySlug: "chemical-elements",
  categoryTitle: "Chemical elements",
  categoryVersion: 1,
  availability: "practice",
  reason: "answer-bank-accuracy",
  detail: "Please verify the documented spelling for this answer.",
  reportedAt: "2026-07-21T18:00:00.000Z",
  status: "pending",
  decision: null,
};

describe("category moderation contracts", () => {
  it("normalizes a bounded public report", () => {
    expect(parseCategoryReportRequest({
      slug: " CHEMICAL-ELEMENTS ",
      reason: "answer-bank-accuracy",
      detail: "  Please verify   the documented spelling for this answer. ",
    })).toEqual({
      slug: "chemical-elements",
      reason: "answer-bank-accuracy",
      detail: "Please verify the documented spelling for this answer.",
    });
    expect(parseCategoryReportRequest({ ...report, reason: "fabricated" })).toBeNull();
    expect(parseCategoryReportRequest({ slug: "chemical-elements", reason: "other", detail: "too short" })).toBeNull();
  });

  it("accepts a private queue without identity fields", () => {
    expect(parseCategoryModerationQueuePayload({
      serverNow: "2026-07-21T18:05:00.000Z",
      authorized: true,
      reports: [report],
    }).reports[0]).toEqual(report);
    expect(() => parseCategoryModerationQueuePayload({
      serverNow: "2026-07-21T18:05:00.000Z",
      authorized: true,
      reports: [{ ...report, reporterUserId: "not-public" }],
    })).toThrow("report");
  });

  it("enforces coherent reviewed lifecycle data", () => {
    const decision = {
      outcome: "publisher-review",
      note: "Send a sanitized accuracy summary to the publisher.",
      decidedAt: "2026-07-21T18:06:00.000Z",
    };
    expect(parseCategoryModerationQueuePayload({
      serverNow: "2026-07-21T18:07:00.000Z",
      authorized: true,
      reports: [{ ...report, status: "publisher-review", decision }],
    }).reports[0].decision).toEqual(decision);
    expect(() => parseCategoryModerationQueuePayload({
      serverNow: "2026-07-21T18:07:00.000Z",
      authorized: true,
      reports: [{ ...report, status: "dismissed", decision }],
    })).toThrow("lifecycle");
  });

  it("normalizes only supported moderation decisions", () => {
    expect(parseCategoryModerationDecisionRequest({
      outcome: "dismiss",
      note: "  The report does   not identify an actionable issue. ",
    })).toEqual({
      outcome: "dismiss",
      note: "The report does not identify an actionable issue.",
    });
    expect(parseCategoryModerationDecisionRequest({ outcome: "hide", note: "A valid length decision note." })).toBeNull();
  });
});
