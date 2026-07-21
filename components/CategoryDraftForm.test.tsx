import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CategoryDraftForm } from "@/components/CategoryDraftForm";
import type { CategoryDraftPayload } from "@/lib/category-discovery-types";

afterEach(() => vi.unstubAllGlobals());

const savedDraft: CategoryDraftPayload = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  prompt: "How many European capitals can you name?",
  sourceNotes: "An official geographic source",
  coverageNotes: "Sovereign national capitals only",
  status: "draft",
  reviewStatus: "unreviewed",
  reviewRevision: 0,
  latestReview: null,
  competitiveEligible: false,
  createdAt: "2026-07-20T20:00:00.000Z",
  updatedAt: "2026-07-20T20:00:00.000Z",
  submittedAt: null,
};

function apiResponse(data: CategoryDraftPayload) {
  return new Response(JSON.stringify({ ok: true, data }));
}

describe("CategoryDraftForm", () => {
  it("edits an owned draft and locks it after a review request", async () => {
    const updatedDraft = { ...savedDraft, sourceNotes: "The official EU geographic source" };
    const submittedDraft: CategoryDraftPayload = {
      ...updatedDraft,
      status: "review-requested",
      reviewStatus: "pending",
      reviewRevision: 1,
      updatedAt: "2026-07-20T20:02:00.000Z",
      submittedAt: "2026-07-20T20:02:00.000Z",
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(apiResponse(updatedDraft))
      .mockResolvedValueOnce(apiResponse(submittedDraft));
    vi.stubGlobal("fetch", fetchMock);

    render(<CategoryDraftForm
      initialPrompt=""
      initialPayload={{ serverNow: "2026-07-20T20:01:00.000Z", drafts: [savedDraft] }}
    />);

    fireEvent.change(screen.getByLabelText("Source or provenance"), {
      target: { value: updatedDraft.sourceNotes },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Changes saved privately.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      `/api/categories/drafts/${savedDraft.id}`,
      expect.objectContaining({ method: "PATCH" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Submit for review" }));

    expect(await screen.findByText("Submitted for review · editing locked")).toBeInTheDocument();
    expect(screen.getByLabelText("Category prompt")).toHaveAttribute("readonly");
    expect(screen.getByText("Pending review")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `/api/categories/drafts/${savedDraft.id}/submit`,
      { method: "POST" },
    );
  });

  it("saves a new private draft before submitting it for review", async () => {
    const submittedDraft: CategoryDraftPayload = {
      ...savedDraft,
      status: "review-requested",
      reviewStatus: "pending",
      reviewRevision: 1,
      updatedAt: "2026-07-20T20:02:00.000Z",
      submittedAt: "2026-07-20T20:02:00.000Z",
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(apiResponse(savedDraft))
      .mockResolvedValueOnce(apiResponse(submittedDraft));
    vi.stubGlobal("fetch", fetchMock);

    render(<CategoryDraftForm
      initialPrompt="How many European capitals can you name?"
      initialPayload={{ serverNow: "2026-07-20T20:01:00.000Z", drafts: [] }}
    />);
    fireEvent.change(screen.getByLabelText("Source or provenance"), {
      target: { value: savedDraft.sourceNotes },
    });
    fireEvent.change(screen.getByLabelText("Coverage boundaries"), {
      target: { value: savedDraft.coverageNotes },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit for review" }));

    expect(await screen.findByText("Submitted for review. Editing is now locked.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/categories/drafts",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `/api/categories/drafts/${savedDraft.id}/submit`,
      { method: "POST" },
    );
    expect(screen.queryByText("No saved drafts yet.")).not.toBeInTheDocument();
  });

  it("shows reviewer feedback and reopens changes-requested drafts for editing", () => {
    const changesRequested: CategoryDraftPayload = {
      ...savedDraft,
      reviewStatus: "changes-requested",
      reviewRevision: 1,
      latestReview: {
        decision: "request-changes",
        note: "Clarify whether transcontinental sovereign states are included.",
        revision: 1,
        decidedAt: "2026-07-20T20:04:00.000Z",
      },
      updatedAt: "2026-07-20T20:04:00.000Z",
    };

    render(<CategoryDraftForm
      initialPrompt=""
      initialPayload={{ serverNow: "2026-07-20T20:05:00.000Z", drafts: [changesRequested] }}
    />);

    expect(screen.getAllByText("Changes requested")).toHaveLength(2);
    expect(screen.getByText("Clarify whether transcontinental sovereign states are included.")).toBeInTheDocument();
    expect(screen.getByLabelText("Category prompt")).not.toHaveAttribute("readonly");
    expect(screen.getByRole("button", { name: "Submit for review" })).toBeEnabled();
  });
});
