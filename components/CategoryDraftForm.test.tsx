import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CategoryDraftForm } from "@/components/CategoryDraftForm";

afterEach(() => vi.unstubAllGlobals());

describe("CategoryDraftForm", () => {
  it("saves a bounded private draft and keeps it explicitly unranked", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      data: {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        status: "draft",
        reviewStatus: "unreviewed",
        competitiveEligible: false,
        createdAt: "2026-07-20T20:00:00.000Z",
      },
    })));
    vi.stubGlobal("fetch", fetchMock);
    render(<CategoryDraftForm initialPrompt="European capitals" />);

    fireEvent.change(screen.getByLabelText("Source or provenance"), {
      target: { value: "An official geographic source" },
    });
    fireEvent.change(screen.getByLabelText("Coverage boundaries"), {
      target: { value: "Sovereign national capitals only" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save private draft" }));

    expect(await screen.findByText(/Draft saved privately/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/categories/drafts", expect.objectContaining({ method: "POST" }));
    expect(screen.getByText("Unreviewed · practice-only")).toBeInTheDocument();
  });
});
