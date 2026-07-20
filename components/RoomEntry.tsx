"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { normalizeDisplayName } from "@/lib/display-name";
import { roomApi } from "@/lib/room-api";
import { normalizeRoomCode } from "@/lib/room-contract";
import type { RoomApi } from "@/lib/room-types";

type RoomEntryProps = { api?: RoomApi };

export function RoomEntry({ api = roomApi }: RoomEntryProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [pendingAction, setPendingAction] = useState<"create" | "join" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const normalizedName = normalizeDisplayName(displayName);
  const normalizedCode = normalizeRoomCode(roomCode);

  async function createPrivateRoom() {
    if (!normalizedName) {
      setError("Use 2–24 letters or numbers for your display name.");
      return;
    }
    setPendingAction("create");
    setError(null);
    try {
      const payload = await api.create(normalizedName);
      router.push(`/room/${payload.room.code}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Private rooms are temporarily unavailable.");
      setPendingAction(null);
    }
  }

  async function joinPrivateRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!normalizedName) {
      setError("Use 2–24 letters or numbers for your display name.");
      return;
    }
    if (!normalizedCode) {
      setError("Enter the eight-character invite code.");
      return;
    }
    setPendingAction("join");
    setError(null);
    try {
      const payload = await api.join(normalizedCode, normalizedName);
      router.push(`/room/${payload.room.code}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That room couldn’t be joined.");
      setPendingAction(null);
    }
  }

  return (
    <section className="game-board room-board room-entry-board" aria-labelledby="room-entry-title">
      <header className="board-header">
        <Link className="brand" href="/">NameMore</Link>
        <span className="room-header-kicker">Private rooms</span>
      </header>

      <div className="room-entry-content">
        <div className="room-entry-copy">
          <span className="room-eyebrow">Play with friends</span>
          <h1 id="room-entry-title">One room.<br />Every name you know.</h1>
          <p>Create a private race for up to eight players, or enter an invite code to join one.</p>
        </div>

        <div className="room-entry-panel">
          <label className="room-field">
            <span>Your display name</span>
            <input
              autoComplete="nickname"
              maxLength={40}
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="e.g. Dylan"
              disabled={pendingAction !== null}
            />
          </label>

          <button
            className="room-primary-action"
            type="button"
            onClick={() => void createPrivateRoom()}
            disabled={pendingAction !== null}
          >
            <span>{pendingAction === "create" ? "Creating room…" : "Create private room"}</span>
            <span aria-hidden="true">→</span>
          </button>

          <div className="room-entry-divider"><span>or join an invite</span></div>

          <form className="room-join-row" onSubmit={(event) => void joinPrivateRoom(event)}>
            <label className="room-field room-code-field">
              <span>Room code</span>
              <input
                autoCapitalize="characters"
                autoComplete="off"
                maxLength={8}
                value={roomCode}
                onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
                placeholder="K7M4Q2PX"
                disabled={pendingAction !== null}
              />
            </label>
            <button className="room-secondary-action" type="submit" disabled={pendingAction !== null}>
              {pendingAction === "join" ? "Joining…" : "Join room"}
            </button>
          </form>

          <p className={`room-form-message${error ? " is-error" : ""}`} role="status">
            {error ?? "Your room identity and start time are verified by the server."}
          </p>
        </div>
      </div>

      <footer className="board-footer">
        <span>Private race · 90 seconds · up to 8 players</span>
        <Link href="/">Play Daily</Link>
      </footer>
    </section>
  );
}
