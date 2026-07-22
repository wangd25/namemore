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

  it("announces validation errors, focuses the affected field, and links to Daily", () => {
    const api = makeApi();
    render(<RoomEntry api={api} />);

    const nameInput = screen.getByRole("textbox", { name: "Your display name" });
    expect(nameInput).toHaveAttribute("maxlength", "24");
    fireEvent.click(screen.getByRole("button", { name: /Create private room/ }));

    expect(screen.getByRole("alert")).toHaveTextContent("Use 2–24 letters or numbers");
    expect(nameInput).toHaveFocus();
    expect(nameInput).toHaveAttribute("aria-invalid", "true");

    fireEvent.change(nameInput, { target: { value: "Room Guest" } });
    fireEvent.click(screen.getByRole("button", { name: "Join room" }));

    const codeInput = screen.getByRole("textbox", { name: "Room code" });
    expect(codeInput).toHaveFocus();
    expect(codeInput).toHaveAttribute("aria-invalid", "true");
    expect(nameInput).toHaveAttribute("aria-invalid", "false");
    expect(screen.getByRole("link", { name: "Play Daily" })).toHaveAttribute("href", "/daily");
  });

  it("supports keyboard form submission for room creation", async () => {
    const api = makeApi();
    render(<RoomEntry api={api} />);

    const nameInput = screen.getByRole("textbox", { name: "Your display name" });
    fireEvent.change(nameInput, { target: { value: "Keyboard Host" } });
    fireEvent.submit(nameInput.closest("form")!);

    await waitFor(() => expect(api.create).toHaveBeenCalledWith("Keyboard Host", "private-race"));
  });
});
