import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RoomGame } from "@/components/RoomGame";
import type { RoomApi, RoomGamePayload } from "@/lib/room-types";

const selfId = "11111111-1111-4111-8111-111111111111";
const guestId = "22222222-2222-4222-8222-222222222222";

const activePayload: RoomGamePayload = {
  serverNow: "2026-07-20T12:00:10.000Z",
  game: {
    code: "K7M4Q2PX",
    status: "active",
    mode: "private-race",
    startedAt: "2026-07-20T12:00:00.000Z",
    deadlineAt: "2026-07-20T12:01:30.000Z",
    endedAt: null,
    category: {
      slug: "current-nba-players",
      version: 1,
      title: "Current NBA players",
      prompt: "How many NBA players can you name?",
      timeLimitSeconds: 90,
    },
    membership: { playerId: selfId, displayName: "Room Host", isHost: true },
    players: [
      { id: selfId, displayName: "Room Host", isHost: true, joinedAt: "2026-07-20T12:00:00.000Z", connected: true, score: 0, rank: 2, isTied: false, answers: [] },
      { id: guestId, displayName: "Guest Player", isHost: false, joinedAt: "2026-07-20T12:00:01.000Z", connected: true, score: 1, rank: 1, isTied: false, answers: null },
    ],
  },
};

function makeApi(payload: RoomGamePayload): RoomApi {
  return {
    create: vi.fn(),
    getStatus: vi.fn(),
    join: vi.fn(),
    start: vi.fn(),
    getGame: vi.fn().mockResolvedValue(payload),
    submit: vi.fn().mockResolvedValue({
      status: "accepted",
      serverNow: "2026-07-20T12:00:11.000Z",
      score: 1,
      answer: { id: "nba-stephen-curry", canonicalText: "Stephen Curry", teamCode: "GSW", acceptedAt: "2026-07-20T12:00:11.000Z" },
    }),
  };
}

describe("RoomGame", () => {
  it("auto-submits quickly while keeping opponent answer text out of the active DOM", async () => {
    const api = makeApi(activePayload);
    render(<RoomGame roomCode="K7M4Q2PX" api={api} realtimeConnector={null} />);

    const input = await screen.findByRole("textbox", { name: "Type an NBA player’s name" });
    expect(screen.getByText("Guest Player")).toBeInTheDocument();
    expect(screen.getByLabelText("1 hidden accepted answers")).toBeInTheDocument();
    expect(screen.queryByText("LeBron James")).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: "Stephen Curry" } });
    await waitFor(() => expect(api.submit).toHaveBeenCalledWith("K7M4Q2PX", "Stephen Curry"));
    expect(await screen.findByText("Stephen Curry")).toBeInTheDocument();
  });

  it("reveals every player’s accepted answers only after completion", async () => {
    const completedPayload: RoomGamePayload = {
      ...activePayload,
      game: {
        ...activePayload.game,
        status: "completed",
        endedAt: activePayload.game.deadlineAt,
        players: activePayload.game.players.map((player) => player.id === guestId ? {
          ...player,
          answers: [{ id: "nba-lebron-james", canonicalText: "LeBron James", teamCode: "LAL", acceptedAt: "2026-07-20T12:00:12.000Z" }],
        } : player),
      },
    };
    render(<RoomGame roomCode="K7M4Q2PX" api={makeApi(completedPayload)} realtimeConnector={null} />);

    expect(await screen.findByRole("heading", { name: "Round complete" })).toBeInTheDocument();
    expect(screen.getByText("LeBron James")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Play again" })).toHaveAttribute("href", "/room");
  });

  it("shows an answer-free already-taken result in elimination mode", async () => {
    const eliminationPayload: RoomGamePayload = {
      ...activePayload,
      game: { ...activePayload.game, mode: "elimination" },
    };
    const api = makeApi(eliminationPayload);
    api.submit = vi.fn().mockResolvedValue({
      status: "already-taken",
      serverNow: "2026-07-20T12:00:11.000Z",
    });
    render(<RoomGame roomCode="K7M4Q2PX" api={api} realtimeConnector={null} />);

    const input = await screen.findByRole("textbox", { name: "Type an NBA player’s name" });
    fireEvent.change(input, { target: { value: "Stephen Curry" } });

    expect(await screen.findByText("Already taken — another player claimed that name first.")).toBeInTheDocument();
    expect(input).toHaveValue("");
    expect(screen.queryByText("Stephen Curry")).not.toBeInTheDocument();
  });
});
