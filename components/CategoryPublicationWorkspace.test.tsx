import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CategoryPublicationWorkspace } from "@/components/CategoryPublicationWorkspace";
import type { CategoryPublicationQueuePayload } from "@/lib/category-publication-types";

afterEach(() => vi.unstubAllGlobals());

const payload: CategoryPublicationQueuePayload = {
  serverNow: "2026-07-21T18:01:00.000Z",
  authorized: true,
  banks: [{
    draftId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    prompt: "How many European capitals can you name?",
    sourceNotes: "Official geographic source",
    coverageNotes: "Sovereign national capitals only.",
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
  }],
};

describe("CategoryPublicationWorkspace", () => {
  it("renders approved evidence and the explicit noncompetitive boundary", () => {
    render(<CategoryPublicationWorkspace initialPayload={payload} />);
    expect(screen.getByRole("heading", { name: "Prepare the reviewed practice release." })).toBeInTheDocument();
    expect(screen.getByText("2 canonical answers · 4 accepted names")).toBeInTheDocument();
    expect(screen.getByText(/does not grant daily, leaderboard, room, or ranked eligibility/)).toBeInTheDocument();
    expect(screen.getByLabelText("Practice title")).toHaveValue("European capitals");
  });

  it("publishes through the narrow route and exposes the new practice link", async () => {
    const result = {
      publicationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      draftId: payload.banks[0].draftId,
      bankRevision: 2,
      slug: "european-capitals",
      categoryVersion: 1,
      answerCount: 2,
      acceptedNameCount: 4,
      publishedAt: "2026-07-21T18:02:00.000Z",
      availability: "practice",
      competitiveEligible: false,
    };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, data: result })));
    vi.stubGlobal("fetch", fetchMock);
    render(<CategoryPublicationWorkspace initialPayload={payload} />);
    fireEvent.click(screen.getByRole("button", { name: "Publish unranked practice" }));
    expect(await screen.findByText(/Published as reviewed, unranked practice/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open practice category" })).toHaveAttribute("href", "/practice/european-capitals");
    expect(screen.getByText("No approved banks are waiting to publish.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(`/api/categories/banks/${payload.banks[0].draftId}/publish`, expect.objectContaining({ method: "POST" }));
  });

  it("fails closed for ordinary users", () => {
    render(<CategoryPublicationWorkspace initialPayload={{ serverNow: payload.serverNow, authorized: false, banks: [] }} />);
    expect(screen.getByRole("heading", { name: "Publisher access required." })).toBeInTheDocument();
    expect(screen.queryByText("Publishing queue")).not.toBeInTheDocument();
  });
});
