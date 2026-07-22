import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CategoryModerationWorkspace } from "@/components/CategoryModerationWorkspace";
import type { CategoryModerationQueuePayload } from "@/lib/category-moderation-types";

afterEach(() => vi.unstubAllGlobals());

const payload: CategoryModerationQueuePayload = {
  serverNow: "2026-07-21T18:05:00.000Z",
  authorized: true,
  reports: [{
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
  }],
};

describe("CategoryModerationWorkspace", () => {
  it("records a sanitized publisher review without changing the category", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      data: {
        reportId: payload.reports[0].reportId,
        status: "publisher-review",
        outcome: "publisher-review",
        decidedAt: "2026-07-21T18:06:00.000Z",
      },
    })));
    vi.stubGlobal("fetch", fetchMock);
    render(<CategoryModerationWorkspace initialPayload={payload} />);

    expect(screen.getByText("Reporter identity stays private")).toBeInTheDocument();
    expect(screen.queryByText("reporter-user-id")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Internal decision note/), {
      target: { value: "Send a sanitized accuracy summary to the publisher." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send to publisher review" }));

    const message = await screen.findByText(/live category remains unchanged/);
    expect(message).toHaveFocus();
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/categories/moderation/${payload.reports[0].reportId}/decision`,
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("fails closed for ordinary users", () => {
    render(<CategoryModerationWorkspace initialPayload={{ serverNow: payload.serverNow, authorized: false, reports: [] }} />);
    expect(screen.getByRole("heading", { name: "Moderator access required." })).toBeInTheDocument();
    expect(screen.queryByText("Moderation queue")).not.toBeInTheDocument();
  });

  it("moves and selects report-view tabs with arrow keys", () => {
    render(<CategoryModerationWorkspace initialPayload={payload} />);
    const pendingTab = screen.getByRole("tab", { name: "Pending" });
    const reviewedTab = screen.getByRole("tab", { name: "Reviewed" });

    pendingTab.focus();
    fireEvent.keyDown(pendingTab, { key: "ArrowRight" });

    expect(reviewedTab).toHaveFocus();
    expect(reviewedTab).toHaveAttribute("aria-selected", "true");
    expect(reviewedTab).toHaveAttribute("tabindex", "0");
    expect(pendingTab).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", "moderation-tab-reviewed");
  });
});
