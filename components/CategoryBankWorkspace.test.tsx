import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CategoryBankWorkspace } from "@/components/CategoryBankWorkspace";
import type { CategoryBankPayload, CategoryBankQueuePayload } from "@/lib/category-bank-types";

afterEach(() => vi.unstubAllGlobals());

const bank: CategoryBankPayload = {
  draftId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  prompt: "How many European capitals can you name?",
  sourceNotes: "Official geographic source",
  coverageNotes: "Sovereign national capitals only",
  revision: 1,
  status: "editing",
  snapshotDate: "2026-07-21",
  timeLimitSeconds: 90,
  sourceLabel: "Official geographic list",
  sourceUrl: "https://example.org/source",
  versionNote: "Initial reviewed snapshot.",
  competitiveEligible: false,
  updatedAt: "2026-07-21T17:00:00.000Z",
  submittedAt: null,
  answers: [
    { canonicalText: "Copenhagen", aliases: ["København"] },
    { canonicalText: "Lisbon", aliases: ["Lisboa"] },
  ],
};

const payload: CategoryBankQueuePayload = {
  serverNow: "2026-07-21T17:00:01.000Z",
  authorized: true,
  drafts: [{
    draftId: bank.draftId,
    prompt: bank.prompt,
    sourceNotes: bank.sourceNotes,
    coverageNotes: bank.coverageNotes,
    revision: 1,
    status: "editing",
    available: true,
    bank,
  }],
};

describe("CategoryBankWorkspace", () => {
  it("validates collisions before making a save request", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<CategoryBankWorkspace initialPayload={payload} />);
    fireEvent.change(screen.getByLabelText("Canonical answers and aliases"), {
      target: { value: "Luka Dončić | Luka Doncic\nLeBron James" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Validate bank" }));
    expect(screen.getByText(/collides with/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("saves a valid private revision through the narrow route", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, data: bank })));
    vi.stubGlobal("fetch", fetchMock);
    render(<CategoryBankWorkspace initialPayload={payload} />);
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    expect(await screen.findByText("Draft saved. The revision remains private and editable.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(`/api/categories/banks/${bank.draftId}`, expect.objectContaining({ method: "PUT" }));
  });

  it("fails closed for ordinary users", () => {
    render(<CategoryBankWorkspace initialPayload={{ serverNow: payload.serverNow, authorized: false, drafts: [] }} />);
    expect(screen.getByRole("heading", { name: "Reviewer access required." })).toBeInTheDocument();
    expect(screen.queryByText("Bank workspace")).not.toBeInTheDocument();
  });
});
