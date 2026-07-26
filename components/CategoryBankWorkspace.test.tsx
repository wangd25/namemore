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
  reviewStatus: "unreviewed",
  snapshotDate: "2026-07-21",
  timeLimitSeconds: 90,
  sourceLabel: "Official geographic list",
  sourceUrl: "https://example.org/source",
  versionNote: "Initial reviewed snapshot.",
  competitiveEligible: false,
  updatedAt: "2026-07-21T17:00:00.000Z",
  submittedAt: null,
  latestReview: null,
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
    publicationCorrection: null,
    bank,
  }],
};

describe("CategoryBankWorkspace", () => {
  it("validates collisions before making a save request", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<CategoryBankWorkspace initialPayload={payload} />);
    const editor = screen.getByLabelText("Canonical answers and aliases");
    fireEvent.change(editor, {
      target: { value: "Luka Dončić | Luka Doncic\nLeBron James" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Validate bank" }));
    expect(screen.getByText(/collides with/)).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveAttribute("id", "bank-validation");
    expect(editor).toHaveAttribute("aria-describedby", "bank-answer-guidance bank-validation");
    expect(editor).toHaveAttribute("aria-invalid", "true");
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    expect(editor).toHaveFocus();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("saves a valid private revision through the narrow route", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, data: bank })));
    vi.stubGlobal("fetch", fetchMock);
    render(<CategoryBankWorkspace initialPayload={payload} />);
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    const message = await screen.findByText("Draft saved. The revision remains private and editable.");
    expect(message).toHaveFocus();
    expect(fetchMock).toHaveBeenCalledWith(`/api/categories/banks/${bank.draftId}`, expect.objectContaining({ method: "PUT" }));
  });

  it("fails closed for ordinary users", () => {
    render(<CategoryBankWorkspace initialPayload={{ serverNow: payload.serverNow, authorized: false, drafts: [] }} />);
    expect(screen.getByRole("heading", { name: "Reviewer access required." })).toBeInTheDocument();
    expect(screen.queryByText("Bank workspace")).not.toBeInTheDocument();
  });

  it("previews an AI candidate before explicitly replacing unsaved editor text", async () => {
    const aiDraft = {
      status: "needs-verification",
      model: "gpt-5.6-terra",
      generatedAt: "2026-07-25T20:00:00.000Z",
      answers: [
        { canonicalText: "Paris", aliases: [] },
        { canonicalText: "Rome", aliases: ["Roma"] },
      ],
      sourceSuggestions: [{
        label: "Official geographic source",
        url: "https://example.org/geography",
      }],
      coverageWarnings: ["Confirm transcontinental-country rules."],
      validation: { canonicalCount: 2, aliasCount: 1 },
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: aiDraft })),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(
      <CategoryBankWorkspace
        initialPayload={payload}
        aiAssistEnabled
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Generate candidate with AI" }));

    expect(await screen.findByText("Needs verification")).toBeInTheDocument();
    expect(screen.getByLabelText("Canonical answers and aliases")).toHaveValue(
      "Copenhagen | København\nLisbon | Lisboa",
    );
    fireEvent.click(screen.getByRole("button", { name: "Replace editor with candidate" }));
    expect(screen.getByLabelText("Canonical answers and aliases")).toHaveValue(
      "Paris\nRome | Roma",
    );
    expect(screen.getByText(/still unsaved and require source verification/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
