import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RoomLobby } from "@/components/RoomLobby";
import type { RoomApi, RoomGamePayload, RoomPayload } from "@/lib/room-types";

const waitingPayload: RoomPayload = {
  serverNow: "2026-07-20T12:00:00.000Z",
  room: {
    code: "K7M4Q2PX",
    status: "waiting",
    mode: "private-race",
    capacity: 8,
    playerCount: 2,
    createdAt: "2026-07-20T12:00:00.000Z",
    startedAt: null,
    deadlineAt: null,
    endedAt: null,
    category: {
      slug: "current-nba-players",
      version: 1,
      title: "Current NBA players",
      prompt: "How many NBA players can you name?",
      timeLimitSeconds: 90,
    },
    membership: {
      playerId: "11111111-1111-4111-8111-111111111111",
      displayName: "Room Host",
      isHost: true,
    },
    participants: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        displayName: "Room Host",
        isHost: true,
        joinedAt: "2026-07-20T12:00:00.000Z",
        connected: true,
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        displayName: "Guest Player",
        isHost: false,
        joinedAt: "2026-07-20T12:00:01.000Z",
        connected: false,
      },
    ],
  },
};

const activeGamePayload: RoomGamePayload = {
  serverNow: "2026-07-20T12:00:10.000Z",
  game: {
    code: "K7M4Q2PX",
    status: "active",
    mode: "private-race",
    startedAt: "2026-07-20T12:00:10.000Z",
    deadlineAt: "2026-07-20T12:01:40.000Z",
    endedAt: null,
    category: waitingPayload.room.category,
    membership: waitingPayload.room.membership!,
    players: waitingPayload.room.participants.map((participant, index) => ({
      ...participant,
      score: 0,
      rank: index + 1,
      isTied: true,
      answers: index === 0 ? [] : null,
    })),
  },
};

function makeApi(overrides: Partial<RoomApi> = {}): RoomApi {
  return {
    create: vi.fn().mockResolvedValue(waitingPayload),
    getStatus: vi.fn().mockResolvedValue(waitingPayload),
    join: vi.fn().mockResolvedValue(waitingPayload),
    start: vi.fn().mockResolvedValue({
      ...waitingPayload,
      room: {
        ...waitingPayload.room,
        status: "active",
        startedAt: "2026-07-20T12:00:10.000Z",
        deadlineAt: "2026-07-20T12:01:40.000Z",
      },
    }),
    getGame: vi.fn().mockResolvedValue(activeGamePayload),
    submit: vi.fn().mockResolvedValue({ status: "invalid", serverNow: activeGamePayload.serverNow }),
    ...overrides,
  };
}

describe("RoomLobby", () => {
  it("renders real participants, empty capacity slots, and host-only start", async () => {
    const api = makeApi();
    render(<RoomLobby roomCode="K7M4Q2PX" api={api} />);

    expect(await screen.findByText("Guest Player")).toBeInTheDocument();
    expect(screen.getAllByText("Waiting for player…")).toHaveLength(6);
    expect(screen.getByText("Disconnected")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Start round/ }));
    await waitFor(() => expect(api.start).toHaveBeenCalledWith("K7M4Q2PX"));
    expect(await screen.findByRole("textbox", { name: "Type an NBA player’s name" })).toBeInTheDocument();
  });

  it("shows only the join gate for a non-member preview", async () => {
    const outsiderPayload: RoomPayload = {
      ...waitingPayload,
      room: { ...waitingPayload.room, membership: null, participants: [] },
    };
    const api = makeApi({ getStatus: vi.fn().mockResolvedValue(outsiderPayload) });
    render(<RoomLobby roomCode="K7M4Q2PX" api={api} />);

    expect(await screen.findByRole("heading", { name: "Join the board" })).toBeInTheDocument();
    expect(screen.queryByText("Guest Player")).not.toBeInTheDocument();
    expect(screen.getByText("2 of 8 spots are taken.")).toBeInTheDocument();
  });
});
