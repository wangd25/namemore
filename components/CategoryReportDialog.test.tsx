import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CategoryReportDialog } from "@/components/CategoryReportDialog";

afterEach(() => vi.unstubAllGlobals());

describe("CategoryReportDialog", () => {
  it("submits a private report and explains the moderation boundary", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      data: {
        reportId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        categorySlug: "chemical-elements",
        categoryTitle: "Chemical elements",
        categoryVersion: 1,
        status: "pending",
        submittedAt: "2026-07-21T18:00:00.000Z",
      },
    })));
    vi.stubGlobal("fetch", fetchMock);
    render(<CategoryReportDialog categorySlug="chemical-elements" categoryTitle="Chemical elements" />);

    fireEvent.click(screen.getByRole("button", { name: "Report a category problem" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/identity is never shown/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/What should we check/), {
      target: { value: "Please verify the documented spelling for this answer." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send report" }));

    expect(await screen.findByText("Thank you.")).toBeInTheDocument();
    expect(screen.getByText(/moderator will review it privately/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/categories/reports", expect.objectContaining({ method: "POST" }));
  });
});
