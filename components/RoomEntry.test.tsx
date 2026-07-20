import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RoomEntry } from "@/components/RoomEntry";
import type { RoomApi, RoomPayload } from "@/lib/room-types";

const push = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const createdPayload: RoomPayload = {
  serverNow: "2026-07-20T12:00:00.000Z",
  room: {
    code: "K7M4Q2PX",
    status: "waiting",
    mode: "elimination",
    capacity: 8,
    playerCount: 1,
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
      displayName: "Mode Host",
      isHost: true,
    },
    participants: [],
  },
};

function makeApi(): RoomApi {
  return {
    create: vi.fn().mockResolvedValue(createdPayload),
    getStatus: vi.fn(),
    join: vi.fn(),
    start: vi.fn(),
    getGame: vi.fn(),
    submit: vi.fn(),
  };
}

describe("RoomEntry", () => {
  it("creates an elimination room from the explicit mode control", async () => {
    const api = makeApi();
    render(<RoomEntry api={api} />);

    fireEvent.change(screen.getByRole("textbox", { name: "Your display name" }), {
      target: { value: "Mode Host" },
    });
    fireEvent.click(screen.getByRole("radio", { name: /Elimination/ }));
    fireEvent.click(screen.getByRole("button", { name: /Create private room/ }));

    await waitFor(() => expect(api.create).toHaveBeenCalledWith("Mode Host", "elimination"));
    expect(push).toHaveBeenCalledWith("/room/K7M4Q2PX");
  });
});
