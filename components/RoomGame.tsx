"use client";

import Link from "next/link";
import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { RoomResults } from "@/components/RoomResults";
import { roomApi } from "@/lib/room-api";
import {
  buildTypingSignal,
  connectRoomRealtime,
  type RoomRealtimeConnection,
  type RoomRealtimeState,
  type RoomTypingSignal,
} from "@/lib/room-realtime";
import type {
  RoomAcceptedAnswer,
  RoomApi,
  RoomGame as RoomGameState,
} from "@/lib/room-types";

type RoomGameProps = {
  roomCode: string;
  api?: RoomApi;
  realtimeConnector?: typeof connectRoomRealtime | null;
};

type Feedback = { kind: "accepted" | "duplicate" | "already-taken" | "invalid" | "error"; message: string };

const automaticSubmitMilliseconds = 180;

function formatTime(totalSeconds: number): string {
  return `${String(Math.floor(totalSeconds / 60)).padStart(2, "0")}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

function AcceptedIcon() {
  return <svg className="accepted-icon" viewBox="0 0 20 20" aria-hidden="true"><path d="m4.5 10.1 3.3 3.3 7.7-8" /></svg>;
}

export function RoomGame({ roomCode, api = roomApi, realtimeConnector = connectRoomRealtime }: RoomGameProps) {
  const [game, setGame] = useState<RoomGameState | null>(null);
  const [clockOffsetMs, setClockOffsetMs] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [inputValue, setInputValue] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [loading, setLoading] = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  const [freshAnswerId, setFreshAnswerId] = useState<string | null>(null);
  const [typingByPlayer, setTypingByPlayer] = useState<Record<string, RoomTypingSignal>>({});
  const [realtimeState, setRealtimeState] = useState<RoomRealtimeState>("connecting");
  const inputRef = useRef<HTMLInputElement>(null);
  const inputValueRef = useRef("");
  const gameRef = useRef<RoomGameState | null>(null);
  const connectionRef = useRef<RoomRealtimeConnection | null>(null);
  const submitTimeoutRef = useRef<number | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const celebrationTimeoutRef = useRef<number | null>(null);
  const inFlightAnswersRef = useRef(new Set<string>());
  const pendingChecksRef = useRef(0);
  const refreshPendingRef = useRef(false);

  const hydrate = useCallback((nextGame: RoomGameState, serverNow: string) => {
    const offset = Date.parse(serverNow) - Date.now();
    setClockOffsetMs(Number.isFinite(offset) ? offset : 0);
    gameRef.current = nextGame;
    setGame(nextGame);
    setLoading(false);
  }, []);

  const refreshGame = useCallback(async (quiet = false) => {
    if (refreshPendingRef.current) return;
    refreshPendingRef.current = true;
    if (!quiet) setLoading(true);
    try {
      const payload = await api.getGame(roomCode);
      hydrate(payload.game, payload.serverNow);
      setFeedback((current) => current?.kind === "error" ? null : current);
    } catch (caught) {
      setFeedback({ kind: "error", message: caught instanceof Error ? caught.message : "The live room couldn’t refresh." });
      if (!quiet) setLoading(false);
    } finally {
      refreshPendingRef.current = false;
    }
  }, [api, hydrate, roomCode]);

  useEffect(() => {
    const firstRefresh = window.setTimeout(() => void refreshGame(), 0);
    return () => window.clearTimeout(firstRefresh);
  }, [refreshGame]);

  useEffect(() => {
    if (game?.status !== "active") return;
    const interval = window.setInterval(() => void refreshGame(true), 3_000);
    return () => window.clearInterval(interval);
  }, [game?.status, refreshGame]);

  const playerKey = useMemo(() => game?.players.map((player) => player.id).join(":") ?? "", [game?.players]);

  useEffect(() => {
    const currentGame = gameRef.current;
    if (!currentGame || currentGame.status !== "active" || !realtimeConnector) return;
    let cancelled = false;
    void realtimeConnector({
      roomCode,
      players: currentGame.players,
      currentPlayerId: currentGame.membership.playerId,
      onPresence(playerId, connected) {
        setGame((current) => current ? {
          ...current,
          players: current.players.map((player) => player.id === playerId ? { ...player, connected } : player),
        } : current);
      },
      onTyping(playerId, signal) {
        if (playerId === currentGame.membership.playerId) return;
        setTypingByPlayer((current) => ({ ...current, [playerId]: signal }));
      },
      onBoardChanged() {
        void refreshGame(true);
      },
      onState: setRealtimeState,
    }).then((connection) => {
      if (cancelled) void connection.destroy();
      else connectionRef.current = connection;
    }).catch(() => setRealtimeState("degraded"));

    return () => {
      cancelled = true;
      const connection = connectionRef.current;
      connectionRef.current = null;
      if (connection) void connection.destroy();
    };
  }, [game?.membership.playerId, game?.status, playerKey, realtimeConnector, refreshGame, roomCode]);

  useEffect(() => {
    if (game?.status !== "active") return;
    inputRef.current?.focus();
  }, [game?.status]);

  useEffect(() => {
    if (game?.status !== "active") return;
    const deadline = Date.parse(game.deadlineAt);
    const updateClock = () => {
      const nextRemaining = Math.max(0, Math.ceil((deadline - (Date.now() + clockOffsetMs)) / 1_000));
      setRemainingSeconds(nextRemaining);
      if (nextRemaining === 0) void refreshGame(true);
    };
    updateClock();
    const interval = window.setInterval(updateClock, 250);
    return () => window.clearInterval(interval);
  }, [clockOffsetMs, game?.deadlineAt, game?.status, refreshGame]);

  useEffect(() => () => {
    for (const timeout of [submitTimeoutRef, typingTimeoutRef, celebrationTimeoutRef]) {
      if (timeout.current !== null) window.clearTimeout(timeout.current);
    }
  }, []);

  const currentPlayer = game?.players.find((player) => player.id === game.membership.playerId) ?? null;
  const visiblePlayers = useMemo(() => {
    if (!game) return [];
    return [...game.players].sort((a, b) => {
      if (a.id === game.membership.playerId) return -1;
      if (b.id === game.membership.playerId) return 1;
      return a.joinedAt.localeCompare(b.joinedAt);
    });
  }, [game]);

  async function submitAnswer(rawAnswer: string, reportInvalid: boolean) {
    const submitted = rawAnswer.trim();
    if (!gameRef.current || gameRef.current.status !== "active" || !submitted) return;
    const requestKey = submitted.toLocaleLowerCase();
    if (inFlightAnswersRef.current.has(requestKey)) return;
    inFlightAnswersRef.current.add(requestKey);
    pendingChecksRef.current += 1;
    setIsChecking(true);
    try {
      const result = await api.submit(roomCode, submitted);
      const offset = Date.parse(result.serverNow) - Date.now();
      setClockOffsetMs(Number.isFinite(offset) ? offset : 0);
      if (result.status === "round-ended") {
        hydrate(result.game, result.serverNow);
        setInputValue("");
        inputValueRef.current = "";
        return;
      }
      if (result.status === "invalid") {
        if (reportInvalid) setFeedback({ kind: "invalid", message: "No match yet — check the name or try another player." });
        return;
      }
      if (result.status === "rate-limited") {
        setFeedback({ kind: "error", message: "Too many checks at once — pause briefly, then keep naming." });
        return;
      }
      if (result.status === "already-taken") {
        if (inputValueRef.current.trim() === submitted) {
          setInputValue("");
          inputValueRef.current = "";
          void connectionRef.current?.sendTyping(buildTypingSignal(""));
        }
        setFeedback({ kind: "already-taken", message: "Already taken — another player claimed that name first." });
        return;
      }
      if (inputValueRef.current.trim() === submitted) {
        setInputValue("");
        inputValueRef.current = "";
        void connectionRef.current?.sendTyping(buildTypingSignal(""));
      }
      if (result.status === "duplicate") {
        setFeedback({
          kind: "duplicate",
          message: gameRef.current.mode === "elimination"
            ? `${result.answer.canonicalText} is already your claim.`
            : `${result.answer.canonicalText} is already on your board.`,
        });
        return;
      }
      setFreshAnswerId(result.answer.id);
      if (celebrationTimeoutRef.current !== null) window.clearTimeout(celebrationTimeoutRef.current);
      celebrationTimeoutRef.current = window.setTimeout(() => setFreshAnswerId(null), 700);
      setGame((current) => {
        if (!current) return current;
        const players = current.players.map((player) => {
          if (player.id !== current.membership.playerId) return player;
          const answers = player.answers ?? [];
          return {
            ...player,
            score: result.score,
            answers: answers.some((answer) => answer.id === result.answer.id)
              ? answers
              : [...answers, result.answer],
          };
        });
        const next = { ...current, players };
        gameRef.current = next;
        return next;
      });
      setFeedback({
        kind: "accepted",
        message: gameRef.current?.mode === "elimination"
          ? `${result.answer.canonicalText} claimed.`
          : `${result.answer.canonicalText} added.`,
      });
    } catch {
      setFeedback({ kind: "error", message: "That answer couldn’t be checked. Your verified score is safe; try again." });
    } finally {
      inFlightAnswersRef.current.delete(requestKey);
      pendingChecksRef.current = Math.max(0, pendingChecksRef.current - 1);
      if (pendingChecksRef.current === 0) setIsChecking(false);
    }
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    const nextValue = event.target.value;
    setInputValue(nextValue);
    inputValueRef.current = nextValue;
    if (submitTimeoutRef.current !== null) window.clearTimeout(submitTimeoutRef.current);
    if (typingTimeoutRef.current !== null) window.clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = window.setTimeout(() => {
      void connectionRef.current?.sendTyping(buildTypingSignal(nextValue));
    }, 70);
    if (nextValue.trim()) {
      submitTimeoutRef.current = window.setTimeout(() => void submitAnswer(nextValue, false), automaticSubmitMilliseconds);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitTimeoutRef.current !== null) window.clearTimeout(submitTimeoutRef.current);
    void submitAnswer(inputValue, true);
  }

  if (loading && !game) {
    return <section className="game-board room-board" aria-busy="true"><header className="board-header"><Link className="brand" href="/">NameMore</Link></header><div className="room-loading-state"><span className="room-loading-orb" /><h1>Syncing the live board…</h1><p>Recovering the server clock and your verified answers.</p></div></section>;
  }

  if (!game || !currentPlayer) {
    return <section className="game-board room-board"><header className="board-header"><Link className="brand" href="/">NameMore</Link></header><div className="room-loading-state"><h1>Live board unavailable</h1><p>{feedback?.message ?? "This room could not be recovered."}</p><button className="room-primary-action" type="button" onClick={() => void refreshGame()}>Retry</button></div></section>;
  }

  if (game.status === "completed") return <RoomResults game={game} />;

  return (
    <section className={`game-board room-board room-live-board${remainingSeconds <= 10 ? " is-urgent" : ""}`} aria-labelledby="room-game-title">
      <header className="board-header room-live-header">
        <Link className="brand" href="/">NameMore</Link>
        <div className="room-header-code"><span>Room</span><strong>{game.code}</strong></div>
        <div className="room-live-hud"><strong>{formatTime(remainingSeconds)}</strong><i /><span key={currentPlayer.score}>{currentPlayer.score}</span></div>
      </header>

      <main className="room-live-content">
        <div className="room-live-heading">
          <span>{game.mode === "elimination" ? "Elimination · first claim wins" : "Private race · shared answer pool"}</span>
          <h1 id="room-game-title">{game.category.prompt}</h1>
        </div>
        <form className={`room-live-entry${isChecking ? " is-checking" : ""}`} onSubmit={handleSubmit} aria-busy={isChecking}>
          <label className="sr-only" htmlFor="room-answer-input">Type an NBA player’s name</label>
          <input ref={inputRef} id="room-answer-input" value={inputValue} onChange={handleInputChange} autoComplete="off" autoCapitalize="words" spellCheck="false" maxLength={80} placeholder="Type a full name or unique last name…" />
          {isChecking ? <span className="entry-checking" aria-hidden="true"><span /></span> : null}
        </form>

        <div className="room-live-grid">
          {visiblePlayers.map((player) => {
            const isSelf = player.id === game.membership.playerId;
            const answers = isSelf ? (player.answers ?? []) : [];
            const typing = typingByPlayer[player.id]?.typing === true;
            return (
              <section className={`room-live-player${isSelf ? " is-self" : " is-opponent"}`} key={player.id} aria-labelledby={`player-${player.id}`}>
                <header>
                  <div><h2 id={`player-${player.id}`}>{isSelf ? "You" : player.displayName}{isSelf ? <small> · {player.displayName}</small> : null}</h2><span className={player.connected ? "is-online" : ""}>{player.connected ? "Online" : "Reconnecting"}</span></div>
                  <strong key={player.score}>{player.score}</strong>
                </header>
                {isSelf ? (
                  <ol className="room-live-answers">
                    {answers.map((answer: RoomAcceptedAnswer) => <li className={answer.id === freshAnswerId ? "is-fresh" : ""} key={answer.id}><span><AcceptedIcon /></span>{answer.canonicalText}</li>)}
                    {answers.length === 0 ? <li className="is-empty">Your accepted answers settle here.</li> : null}
                  </ol>
                ) : (
                  <div className="room-opponent-safe-state">
                    <div className={`room-typing-signal${typing ? " is-typing" : ""}`}><i /><span>{typing ? `${player.displayName} is typing…` : "Board hidden during play"}</span></div>
                    <ol aria-label={`${player.score} hidden accepted answers`}>
                      {Array.from({ length: player.score }, (_, index) => <li key={index}><span /><i style={{ width: `${46 + ((index * 17) % 37)}%` }} /></li>)}
                    </ol>
                  </div>
                )}
              </section>
            );
          })}
        </div>

        <div className={`room-live-status${feedback ? ` is-${feedback.kind}` : ""}`} aria-live="polite">
          <span className={`room-realtime-dot is-${realtimeState}`} />
          <p>{feedback?.message ?? (realtimeState === "degraded" ? "Live signals are reconnecting; verified scores still sync safely." : "Answers reveal when time ends.")}</p>
        </div>
      </main>
      <footer className="board-footer"><span>{game.mode === "elimination" ? "Elimination" : "Private race"} · server clock</span><Link href="/room">Leave room</Link></footer>
    </section>
  );
}
