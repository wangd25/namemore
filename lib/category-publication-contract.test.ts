import { describe, expect, it } from "vitest";

import {
  parseCategoryPublicationPayload,
  parseCategoryPublicationRelease,
  parseCategoryPublicationQueuePayload,
  parseCategoryPublicationCorrectionRequest,
  parseCategoryPublicationRequest,
  parseCategoryPublisherStatusPayload,
} from "@/lib/category-publication-contract";

const approvedBank = {
  draftId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  prompt: "How many European capitals can you name?",
  sourceNotes: "Official geographic source",
  coverageNotes: "Sovereign national capitals only",
  revision: 2,
  status: "review-ready",
  reviewStatus: "approved",
  snapshotDate: "2026-07-21",
  timeLimitSeconds: 90,
  sourceLabel: "United Nations geographic names",
  sourceUrl: "https://example.org/source",
  versionNote: "Corrected reviewed snapshot.",
  competitiveEligible: false,
  updatedAt: "2026-07-21T18:00:00.000Z",
  submittedAt: "2026-07-21T17:00:00.000Z",
  latestReview: {
    decision: "approve",
    note: "The corrected frozen snapshot matches its provenance.",
    revision: 2,
    decidedAt: "2026-07-21T18:00:00.000Z",
  },
  answers: [
    { canonicalText: "Copenhagen", aliases: ["København"] },
    { canonicalText: "Lisbon", aliases: ["Lisboa"] },
  ],
};

describe("category publication contracts", () => {
  it("accepts safe publisher status and only approved bank queues", () => {
    expect(parseCategoryPublisherStatusPayload({
      serverNow: "2026-07-21T18:01:00.000Z",
      authorized: false,
    }).authorized).toBe(false);
    expect(parseCategoryPublicationQueuePayload({
      serverNow: "2026-07-21T18:01:00.000Z",
      authorized: true,
      banks: [approvedBank],
      releases: [],
    }).banks[0]).toEqual(approvedBank);
    expect(() => parseCategoryPublicationQueuePayload({
      serverNow: "2026-07-21T18:01:00.000Z",
      authorized: true,
      banks: [{ ...approvedBank, reviewStatus: "pending", latestReview: null }],
      releases: [],
    })).toThrow("queue");
  });

  it("normalizes bounded correction reasons", () => {
    expect(parseCategoryPublicationCorrectionRequest({ reason: "  Correct   the documented spelling. " }))
      .toEqual({ reason: "Correct the documented spelling." });
    expect(parseCategoryPublicationCorrectionRequest({ reason: "too short" })).toBeNull();
  });

  it("normalizes bounded publication metadata and rejects unsafe slugs", () => {
    expect(parseCategoryPublicationRequest({
      slug: "  EUROPEAN-CAPITALS ",
      title: " European   capitals ",
      summary: " A reviewed local-practice bank. ",
      coverageNote: " Sovereign national capitals only. ",
    })).toEqual({
      slug: "european-capitals",
      title: "European capitals",
      summary: "A reviewed local-practice bank.",
      coverageNote: "Sovereign national capitals only.",
    });
    expect(parseCategoryPublicationRequest({
      slug: "../private",
      title: "European capitals",
      summary: "A reviewed local-practice bank.",
      coverageNote: "Sovereign national capitals only.",
    })).toBeNull();
  });

  it("requires an unranked practice result with coherent counts", () => {
    const payload = {
      publicationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      draftId: approvedBank.draftId,
      bankRevision: 2,
      slug: "european-capitals",
      categoryVersion: 1,
      answerCount: 44,
      acceptedNameCount: 61,
      publishedAt: "2026-07-21T18:02:00.000Z",
      supersededPublicationId: null,
      availability: "practice",
      competitiveEligible: false,
    };
    expect(parseCategoryPublicationPayload(payload)).toEqual(payload);
    expect(() => parseCategoryPublicationPayload({ ...payload, competitiveEligible: true })).toThrow("publication");
    expect(() => parseCategoryPublicationPayload({ ...payload, acceptedNameCount: 3 })).toThrow("count");
  });

  it("accepts only a sanitized moderation escalation on a release", () => {
    const release = {
      publicationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      draftId: approvedBank.draftId,
      bankRevision: 2,
      slug: "european-capitals",
      title: "European capitals",
      prompt: approvedBank.prompt,
      summary: "A reviewed local-practice bank for European capitals.",
      coverageNote: "Sovereign national capitals only.",
      categoryVersion: 1,
      snapshotDate: "2026-07-21",
      timeLimitSeconds: 90,
      sourceLabel: "United Nations geographic names",
      sourceUrl: "https://example.org/source",
      versionNote: "Corrected reviewed snapshot.",
      answerCount: 2,
      acceptedNameCount: 4,
      publishedAt: "2026-07-21T18:02:00.000Z",
      current: true,
      supersedesPublicationId: null,
      supersededByPublicationId: null,
      availability: "practice",
      competitiveEligible: false,
      correctionRequest: null,
      moderationEscalation: {
        reportId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        reason: "coverage-or-wording",
        summary: "Check the report against the cited source before preparing a correction.",
        decidedAt: "2026-07-21T18:04:00.000Z",
      },
    };
    expect(parseCategoryPublicationRelease(release).moderationEscalation).toEqual(release.moderationEscalation);
    expect(() => parseCategoryPublicationRelease({
      ...release,
      moderationEscalation: { ...release.moderationEscalation, reporterUserId: "private" },
    })).toThrow("escalation");
    expect(() => parseCategoryPublicationRelease({
      ...release,
      moderationEscalation: { ...release.moderationEscalation, reason: "hide-category" },
    })).toThrow("escalation");
  });
});
