import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CategoryDiscovery } from "@/components/CategoryDiscovery";

const payload = {
  serverNow: "2026-07-20T20:00:00.000Z",
  categories: [
    {
      slug: "current-nba-players",
      version: 1,
      title: "Current NBA players",
      prompt: "How many NBA players can you name?",
      summary: "A reviewed snapshot.",
      reviewStatus: "reviewed",
      availability: "daily",
      competitiveEligible: true,
      answerCount: 300,
      sourceLabel: "Repository-curated snapshot",
      coverageNote: "Ten players across each of the thirty teams.",
    },
    {
      slug: "chemical-elements",
      version: null,
      title: "Chemical elements",
      prompt: "How many chemical elements can you name?",
      summary: "A finite science prompt.",
      reviewStatus: "in-review",
      availability: "practice-planned",
      competitiveEligible: false,
      answerCount: null,
      sourceLabel: "Planned IUPAC review",
      coverageNote: "Names, symbols, and aliases require review.",
    },
  ],
  ambient: {
    todayBest: { score: 18, categoryTitle: "Current NBA players" },
    popularCategory: { categoryTitle: "Current NBA players", verifiedRoundCount: 5 },
    liveRooms: { roomCount: 2 },
  },
};

function mockDiscovery() {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: true, data: payload }))));
}

afterEach(() => vi.unstubAllGlobals());

describe("CategoryDiscovery", () => {
  it("renders an editable composer, reviewed selection, and only returned ambient facts", async () => {
    mockDiscovery();
    render(<CategoryDiscovery />);

    const composer = screen.getByLabelText("Choose a category prompt");
    expect(composer).toHaveValue("How many NBA players can you name?");
    expect(await screen.findByRole("option", { name: /Current NBA players/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("link", { name: /Play reviewed category/ })).toHaveAttribute("href", "/daily");
    expect(screen.getByText("18 names")).toBeInTheDocument();
    expect(screen.getByText("2 rooms")).toBeInTheDocument();
  });

  it("debounces typed catalog queries and keeps in-review prompts out of play", async () => {
    mockDiscovery();
    render(<CategoryDiscovery />);
    await screen.findByRole("option", { name: /Chemical elements/ });

    fireEvent.click(screen.getByRole("option", { name: /Chemical elements/ }));
    expect(screen.getByLabelText("Choose a category prompt")).toHaveValue("How many chemical elements can you name?");
    expect(screen.getByRole("button", { name: "Practice bank in review" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Choose a category prompt"), { target: { value: "chem" } });
    await waitFor(() => {
      expect(fetch).toHaveBeenLastCalledWith(
        "/api/categories/discover?q=chem",
        { cache: "no-store" },
      );
    });
  });
});
