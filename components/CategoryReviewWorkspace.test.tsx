import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CategoryReviewWorkspace } from "@/components/CategoryReviewWorkspace";
import type { CategoryReviewQueuePayload } from "@/lib/category-review-types";

afterEach(() => vi.unstubAllGlobals());

const queuePayload: CategoryReviewQueuePayload = {
  serverNow: "2026-07-21T01:01:00.000Z",
  authorized: true,
  drafts: [{
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    prompt: "How many European capitals can you name?",
    sourceNotes: "Official geographic source",
    coverageNotes: "Sovereign national capitals only",
    submittedAt: "2026-07-21T01:00:00.000Z",
    reviewRevision: 1,
  }],
};

describe("CategoryReviewWorkspace", () => {
  it("records a reasoned outcome and removes the decided draft from the queue", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      data: {
        draftId: queuePayload.drafts[0].id,
        decision: "request-changes",
        reviewStatus: "changes-requested",
        reviewRevision: 1,
        decidedAt: "2026-07-21T01:02:00.000Z",
      },
    })));
    vi.stubGlobal("fetch", fetchMock);

    render(<CategoryReviewWorkspace initialPayload={queuePayload} />);
    expect(screen.getByDisplayValue(queuePayload.drafts[0].prompt)).toHaveAttribute("readonly");
    fireEvent.change(screen.getByLabelText("Reviewer note"), {
      target: { value: "Clarify whether transcontinental states are included." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Request changes" }));

    const message = await screen.findByText("Changes requested. The owner can revise and resubmit.");
    expect(message).toHaveFocus();
    expect(screen.getByText("The queue is clear.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/categories/review/${queuePayload.drafts[0].id}/decision`,
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("fails closed for ordinary anonymous users", () => {
    render(<CategoryReviewWorkspace initialPayload={{
      serverNow: "2026-07-21T01:01:00.000Z",
      authorized: false,
      drafts: [],
    }} />);
    expect(screen.getByRole("heading", { name: "Reviewer access required." })).toBeInTheDocument();
    expect(screen.queryByText("Review queue")).not.toBeInTheDocument();
  });
});
