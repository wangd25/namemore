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
  releases: [],
};

const release = {
  publicationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  draftId: payload.banks[0].draftId,
  bankRevision: 2,
  slug: "european-capitals",
  title: "European capitals",
  prompt: payload.banks[0].prompt,
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
  availability: "practice" as const,
  competitiveEligible: false as const,
  correctionRequest: null,
};

describe("CategoryPublicationWorkspace", () => {
  it("renders approved evidence and the explicit noncompetitive boundary", () => {
    render(<CategoryPublicationWorkspace initialPayload={payload} />);
    expect(screen.getByRole("heading", { name: "Prepare the reviewed practice release." })).toBeInTheDocument();
    expect(screen.getByText("2 canonical answers · 4 accepted names")).toBeInTheDocument();
    expect(screen.getByText("Competitive play still blocked")).toBeInTheDocument();
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
      supersededPublicationId: null,
      availability: "practice",
      competitiveEligible: false,
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, data: result })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, data: { ...payload, banks: [], releases: [release] } })));
    vi.stubGlobal("fetch", fetchMock);
    render(<CategoryPublicationWorkspace initialPayload={payload} />);
    fireEvent.click(screen.getByRole("button", { name: "Publish unranked practice" }));
    expect(await screen.findByText(/Published as reviewed, unranked practice/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open practice category" })).toHaveAttribute("href", "/practice/european-capitals");
    expect(screen.getByRole("heading", { name: "Published release history." })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(`/api/categories/banks/${payload.banks[0].draftId}/publish`, expect.objectContaining({ method: "POST" }));
  });

  it("records a correction while keeping the current release visibly live", async () => {
    const correctedRelease = {
      ...release,
      correctionRequest: {
        requestId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        reason: "Correct one provenance-backed answer spelling.",
        requestedAt: "2026-07-21T18:03:00.000Z",
        revisionStarted: false,
        successorPublished: false,
      },
    };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, data: correctedRelease })));
    vi.stubGlobal("fetch", fetchMock);
    render(<CategoryPublicationWorkspace initialPayload={{ ...payload, banks: [], releases: [release] }} />);
    fireEvent.change(screen.getByLabelText(/Correction reason/), { target: { value: correctedRelease.correctionRequest.reason } });
    fireEvent.click(screen.getByRole("button", { name: "Request correction" }));
    expect(await screen.findByText("Correction pending")).toBeInTheDocument();
    expect(screen.getByText(/current practice release remains live/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(`/api/categories/banks/publications/${release.publicationId}/corrections`, expect.objectContaining({ method: "POST" }));
  });

  it("fails closed for ordinary users", () => {
    render(<CategoryPublicationWorkspace initialPayload={{ serverNow: payload.serverNow, authorized: false, banks: [], releases: [] }} />);
    expect(screen.getByRole("heading", { name: "Publisher access required." })).toBeInTheDocument();
    expect(screen.queryByText("Publishing queue")).not.toBeInTheDocument();
  });
});
