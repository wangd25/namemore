import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CategoryBankReviewWorkspace } from "@/components/CategoryBankReviewWorkspace";
import type { CategoryBankReviewQueuePayload } from "@/lib/category-bank-review-types";

afterEach(() => vi.unstubAllGlobals());

const payload: CategoryBankReviewQueuePayload = {
  serverNow: "2026-07-21T18:01:00.000Z",
  authorized: true,
  banks: [{
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
    answers: [
      { canonicalText: "Copenhagen", aliases: ["København"] },
      { canonicalText: "Lisbon", aliases: ["Lisboa"] },
    ],
  }],
};

describe("CategoryBankReviewWorkspace", () => {
  it("renders the frozen revision and explicit non-publishing boundary", () => {
    render(<CategoryBankReviewWorkspace initialPayload={payload} />);
    expect(screen.getByRole("heading", { name: "Review every name, then decide." })).toBeInTheDocument();
    expect(screen.getByText("Copenhagen | København")).toBeInTheDocument();
    expect(screen.getByText(/does not publish the category/)).toBeInTheDocument();
  });

  it("records a bounded approval through the narrow route and advances the queue", async () => {
    const result = {
      draftId: payload.banks[0].draftId,
      revision: 1,
      decision: "approve",
      reviewStatus: "approved",
      decidedAt: "2026-07-21T18:02:00.000Z",
      competitiveEligible: false,
    };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, data: result })));
    vi.stubGlobal("fetch", fetchMock);
    render(<CategoryBankReviewWorkspace initialPayload={payload} />);
    fireEvent.change(screen.getByLabelText("Reviewer note"), { target: { value: "The frozen source and answer set are complete." } });
    fireEvent.click(screen.getByRole("button", { name: "Approve bank" }));
    expect(await screen.findByText(/approved as reviewed/)).toBeInTheDocument();
    expect(screen.getByText("No independent bank decisions are waiting.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(`/api/categories/banks/${payload.banks[0].draftId}/reviews`, expect.objectContaining({ method: "POST" }));
  });

  it("fails closed for ordinary users", () => {
    render(<CategoryBankReviewWorkspace initialPayload={{ serverNow: payload.serverNow, authorized: false, banks: [] }} />);
    expect(screen.getByRole("heading", { name: "Reviewer access required." })).toBeInTheDocument();
    expect(screen.queryByText("Bank review queue")).not.toBeInTheDocument();
  });
});
