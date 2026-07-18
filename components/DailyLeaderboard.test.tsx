import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DailyLeaderboard } from "@/components/DailyLeaderboard";

const emptyLeaderboard = {
  serverNow: "2099-07-17T12:02:00.000Z",
  challenge: {
    date: "2099-07-17",
    category: { slug: "current-nba-players", version: 1 },
  },
  entries: [],
} as const;

describe("DailyLeaderboard", () => {
  it("renders safe verified rows and tie guidance", () => {
    render(
      <DailyLeaderboard
        state="ready"
        onRetry={vi.fn()}
        leaderboard={{
          ...emptyLeaderboard,
          entries: [
            { rank: 1, displayName: "D’Angelo Fan", score: 8, isTied: true },
          ],
        }}
      />,
    );

    expect(screen.getByText("D’Angelo Fan")).toBeInTheDocument();
    expect(screen.getByText("tied score")).toBeInTheDocument();
    expect(screen.getByText(/Earlier verified completion/)).toBeInTheDocument();
  });

  it("handles empty and retryable error states without fabricated results", () => {
    const { rerender } = render(
      <DailyLeaderboard state="ready" onRetry={vi.fn()} leaderboard={emptyLeaderboard} />,
    );
    expect(screen.getByText(/No verified finishers yet/)).toBeInTheDocument();

    const onRetry = vi.fn();
    rerender(<DailyLeaderboard state="error" onRetry={onRetry} leaderboard={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Retry leaderboard" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
