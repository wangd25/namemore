import { describe, expect, it } from "vitest";

import {
  normalizeDiscoveryQuery,
  parseCategoryDiscoveryPayload,
  parseCategoryDraftId,
  parseCategoryDraftListPayload,
  parseCategoryDraftPayload,
  parseCategoryDraftRequest,
} from "@/lib/category-discovery-contract";

const validPayload = {
  serverNow: "2026-07-20T20:00:00.000Z",
  categories: [
    {
      slug: "current-nba-players",
      version: 1,
      title: "Current NBA players",
      prompt: "How many NBA players can you name?",
      summary: "A reviewed snapshot.",
      reviewStatus: "reviewed",
      availability: "daily",
      competitiveEligible: true,
      answerCount: 300,
      sourceLabel: "Repository-curated snapshot",
      coverageNote: "Ten players across each of the thirty teams.",
    },
  ],
  ambient: {
    todayBest: { score: 12, categoryTitle: "Current NBA players" },
    popularCategory: { categoryTitle: "Current NBA players", verifiedRoundCount: 4 },
    liveRooms: { roomCount: 2 },
  },
};

describe("category discovery contracts", () => {
  it("accepts bounded trusted category and ambient projections", () => {
    expect(parseCategoryDiscoveryPayload(validPayload)).toEqual(validPayload);
  });

  it("rejects reviewed entries without a versioned answer bank", () => {
    expect(() => parseCategoryDiscoveryPayload({
      ...validPayload,
      categories: [{ ...validPayload.categories[0], version: null, answerCount: null }],
    })).toThrow("versioned answer bank");
  });

  it("normalizes search and draft text while rejecting control characters", () => {
    expect(normalizeDiscoveryQuery("  chemical   elements ")).toBe("chemical elements");
    expect(normalizeDiscoveryQuery("bad\nquery")).toBeNull();
    expect(parseCategoryDraftRequest({
      prompt: "  European   capitals ",
      sourceNotes: " Official geographic source ",
      coverageNotes: " Includes sovereign national capitals only ",
    })).toEqual({
      prompt: "European capitals",
      sourceNotes: "Official geographic source",
      coverageNotes: "Includes sovereign national capitals only",
    });
    expect(parseCategoryDraftRequest({
      prompt: "European capitals",
      sourceNotes: "Official\nsource",
      coverageNotes: "Clear coverage boundary",
    })).toBeNull();
  });

  it("accepts only coherent private draft lifecycle projections", () => {
    const draft = {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      prompt: "How many European capitals can you name?",
      sourceNotes: "Official geographic source",
      coverageNotes: "Sovereign national capitals only",
      status: "draft",
      reviewStatus: "unreviewed",
      competitiveEligible: false,
      createdAt: "2026-07-20T20:00:00.000Z",
      updatedAt: "2026-07-20T20:01:00.000Z",
      submittedAt: null,
    };

    expect(parseCategoryDraftPayload(draft)).toEqual(draft);
    expect(parseCategoryDraftListPayload({
      serverNow: "2026-07-20T20:02:00.000Z",
      drafts: [draft],
    }).drafts).toEqual([draft]);
    expect(() => parseCategoryDraftPayload({
      ...draft,
      status: "review-requested",
      reviewStatus: "unreviewed",
    })).toThrow("lifecycle");
    expect(() => parseCategoryDraftPayload({
      ...draft,
      competitiveEligible: true,
    })).toThrow("eligibility");
  });

  it("accepts only canonical UUID draft identifiers", () => {
    expect(parseCategoryDraftId("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"))
      .toBe("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    expect(parseCategoryDraftId("not-a-draft-id")).toBeNull();
  });
});
