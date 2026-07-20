"use client";

import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useState } from "react";

import { normalizeDisplayName } from "@/lib/display-name";
import { roomApi } from "@/lib/room-api";
import type { Room, RoomApi } from "@/lib/room-types";

type RoomLobbyProps = { roomCode: string; api?: RoomApi };
type ShareState = "idle" | "copied" | "error";

export function RoomLobby({ roomCode, api = roomApi }: RoomLobbyProps) {
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [pendingAction, setPendingAction] = useState<"join" | "start" | null>(null);
  const [shareState, setShareState] = useState<ShareState>("idle");
  const [error, setError] = useState<string | null>(null);

  const refreshRoom = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const payload = await api.getStatus(roomCode);
      setRoom(payload.room);
      setError(null);
    } catch (caught) {
      if (!quiet) setError(caught instanceof Error ? caught.message : "That private room couldn’t load.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [api, roomCode]);

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => void refreshRoom(), 0);
    const interval = window.setInterval(() => void refreshRoom(true), 5_000);
    return () => {
      window.clearTimeout(initialRefresh);
      window.clearInterval(interval);
    };
  }, [refreshRoom]);

  async function joinRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedName = normalizeDisplayName(displayName);
    if (!normalizedName) {
      setError("Use 2–24 letters or numbers for your display name.");
      return;
    }
    setPendingAction("join");
    setError(null);
    try {
      const payload = await api.join(roomCode, normalizedName);
      setRoom(payload.room);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That room couldn’t be joined.");
    } finally {
      setPendingAction(null);
    }
  }

  async function startRound() {
    setPendingAction("start");
    setError(null);
    try {
      const payload = await api.start(roomCode);
      setRoom(payload.room);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The room couldn’t be started.");
    } finally {
      setPendingAction(null);
    }
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareState("copied");
      window.setTimeout(() => setShareState("idle"), 1_800);
    } catch {
      setShareState("error");
    }
  }

  if (loading && !room) {
    return (
      <section className="game-board room-board" aria-busy="true">
        <header className="board-header"><Link className="brand" href="/">NameMore</Link></header>
        <div className="room-loading-state"><span className="room-loading-orb" /><h1>Opening private room…</h1><p>Checking your invite and membership.</p></div>
        <footer className="board-footer"><span>Private room · server verified</span></footer>
      </section>
    );
  }

  if (!room) {
    return (
      <section className="game-board room-board">
        <header className="board-header"><Link className="brand" href="/">NameMore</Link></header>
        <div className="room-loading-state"><h1>Room unavailable</h1><p>{error ?? "That invite may have expired or been typed incorrectly."}</p><Link className="room-primary-action" href="/room">Try another room</Link></div>
        <footer className="board-footer"><span>Private room · server verified</span></footer>
      </section>
    );
  }

  const isMember = room.membership !== null;
  const isHost = room.membership?.isHost === true;
  const emptySlots = Math.max(0, room.capacity - room.participants.length);

  return (
    <section className="game-board room-board room-lobby-board" aria-labelledby="room-title">
      <header className="board-header">
        <Link className="brand" href="/">NameMore</Link>
        <div className="room-header-code"><span>Room</span><strong>{room.code}</strong></div>
      </header>

      <div className="room-lobby-content">
        <div className="room-lobby-heading">
          <span className="room-eyebrow">{room.status === "waiting" ? "Waiting lobby" : "Room locked"}</span>
          <h1 id="room-title">Private room</h1>
          <p>{room.category.prompt}</p>
          <button className="room-code-pill" type="button" onClick={() => void copyInvite()}>
            <span>{room.code.split("").join(" ")}</span>
            <small>{shareState === "copied" ? "Copied" : shareState === "error" ? "Copy failed" : "Copy invite"}</small>
          </button>
        </div>

        {!isMember && room.status === "waiting" ? (
          <form className="room-join-card" onSubmit={(event) => void joinRoom(event)}>
            <div><span className="room-eyebrow">You’re invited</span><h2>Join the board</h2><p>{room.playerCount} of {room.capacity} spots are taken.</p></div>
            <label className="room-field"><span>Your display name</span><input autoFocus autoComplete="nickname" maxLength={40} value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="e.g. Dylan" /></label>
            <button className="room-primary-action" type="submit" disabled={pendingAction !== null}><span>{pendingAction === "join" ? "Joining…" : "Join private room"}</span><span aria-hidden="true">→</span></button>
            {error ? <p className="room-form-message is-error" role="alert">{error}</p> : null}
          </form>
        ) : !isMember ? (
          <div className="room-join-card"><span className="room-eyebrow">Invite closed</span><h2>This room has started.</h2><p>Late joins are blocked by the server so every player begins on the same clock.</p><Link className="room-secondary-action" href="/room">Find another room</Link></div>
        ) : (
          <>
            <div className="room-player-surface">
              <div className="room-player-meta"><span>{room.playerCount} / {room.capacity} players</span><span>{room.category.timeLimitSeconds} second private race</span></div>
              <ol className="room-player-list">
                {room.participants.map((participant, index) => (
                  <li className={`room-player-row${participant.connected ? "" : " is-disconnected"}`} key={participant.id}>
                    <span className="room-player-number">{index + 1}</span>
                    <strong>{participant.id === room.membership?.playerId ? "You" : participant.displayName}</strong>
                    {participant.isHost ? <span className="room-host-badge">Host</span> : null}
                    <span className="room-connection-state"><i />{participant.connected ? "Here" : "Disconnected"}</span>
                  </li>
                ))}
                {Array.from({ length: emptySlots }, (_, index) => (
                  <li className="room-player-row is-empty" key={`empty-${index}`}>
                    <span className="room-player-number">{room.participants.length + index + 1}</span>
                    <span>{room.status === "waiting" ? "Waiting for player…" : "Empty slot"}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="room-lobby-actions" aria-live="polite">
              {room.status === "waiting" && isHost ? (
                <button className="room-primary-action room-start-action" type="button" onClick={() => void startRound()} disabled={pendingAction !== null}>
                  <span>{pendingAction === "start" ? "Starting…" : "Start round"}</span><span aria-hidden="true">→</span>
                </button>
              ) : room.status === "waiting" ? (
                <div className="room-waiting-note"><span className="room-waiting-dot" />Waiting for the host to start</div>
              ) : (
                <div className="room-started-note"><strong>Room started securely.</strong><span>Live multiplayer boards arrive in the next development milestone.</span></div>
              )}
              {room.status === "waiting" ? <button className="room-copy-action" type="button" onClick={() => void copyInvite()}>{shareState === "copied" ? "Invite copied" : "Copy invite link"}</button> : null}
              {error ? <p className="room-form-message is-error" role="alert">{error}</p> : null}
            </div>
          </>
        )}
      </div>

      <footer className="board-footer">
        <span>{room.status === "waiting" ? "Private lobby · invite only" : "Private room · server clock active"}</span>
        <Link href="/room">Leave lobby</Link>
      </footer>
    </section>
  );
}
