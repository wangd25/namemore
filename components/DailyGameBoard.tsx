"use client";

import {
  type CSSProperties,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { DailyGameResults } from "@/components/DailyGameResults";
import type { CategoryAnswer, NbaTeamCode } from "@/lib/category-types";
import { dailyGameApi } from "@/lib/daily-api";
import { normalizeDisplayName } from "@/lib/daily-contract";
import type {
  DailyAcceptedAnswer,
  DailyAttempt,
  DailyChallenge,
  DailyGameApi,
  DailyLeaderboardPayload,
  DailyStatusPayload,
} from "@/lib/daily-types";
import {
  calculatePracticeStats,
  getQuickPairFeedback,
  readFeedbackPreference,
  writeFeedbackPreference,
  type AcceptedAnswerEvent,
} from "@/lib/practice-game";

type Phase =
  | "loading"
  | "unavailable"
  | "name"
  | "ready"
  | "starting"
  | "playing"
  | "ending"
  | "finished"
  | "error";
type Feedback = { kind: "accepted" | "duplicate" | "invalid" | "ended" | "error"; message: string };
type FeedbackCue = "accepted" | "duplicate" | "quick-pair" | "milestone" | "ended";
type ShareStatus = "idle" | "copied" | "shared" | "error";

type DailyGameBoardProps = { api?: DailyGameApi };

const readyDwellMilliseconds = 900;
const automaticSubmitMilliseconds = 420;
const duplicateHighlightMilliseconds = 800;
const acceptedCelebrationMilliseconds = 700;
const milestoneDisplayMilliseconds = 1_100;

const nbaTeamColors = {
  ATL: ["#E03A3E", "#C1D32F"], BOS: ["#007A33", "#BA9653"], BKN: ["#000000", "#777777"],
  CHA: ["#1D1160", "#00788C"], CHI: ["#CE1141", "#111111"], CLE: ["#860038", "#FDBB30"],
  DAL: ["#00538C", "#B8C4CA"], DEN: ["#0E2240", "#FEC524"], DET: ["#C8102E", "#1D42BA"],
  GSW: ["#1D428A", "#FFC72C"], HOU: ["#CE1141", "#C4CED4"], IND: ["#002D62", "#FDBB30"],
  LAC: ["#C8102E", "#1D428A"], LAL: ["#552583", "#FDB927"], MEM: ["#5D76A9", "#12173F"],
  MIA: ["#98002E", "#F9A01B"], MIL: ["#00471B", "#EEE1C6"], MIN: ["#0C2340", "#78BE20"],
  NOP: ["#0C2340", "#C8102E"], NYK: ["#006BB6", "#F58426"], OKC: ["#007AC1", "#EF3B24"],
  ORL: ["#0077C0", "#C4CED4"], PHI: ["#006BB6", "#ED174C"], PHX: ["#1D1160", "#E56020"],
  POR: ["#E03A3E", "#000000"], SAC: ["#5A2D81", "#63727A"], SAS: ["#000000", "#C4CED4"],
  TOR: ["#CE1141", "#000000"], UTA: ["#002B5C", "#F9A01B"], WAS: ["#002B5C", "#E31837"],
} as const satisfies Record<NbaTeamCode, readonly [string, string]>;

type TeamAccentStyle = CSSProperties & { "--team-primary": string; "--team-secondary": string };

function getTeamAccentStyle(teamCode: NbaTeamCode): TeamAccentStyle {
  const [primary, secondary] = nbaTeamColors[teamCode];
  return { "--team-primary": primary, "--team-secondary": secondary };
}

function asAcceptedEvent(answer: DailyAcceptedAnswer): AcceptedAnswerEvent {
  const safeAnswer: CategoryAnswer = {
    id: answer.id,
    canonicalText: answer.canonicalText,
    aliases: [],
    teamCode: answer.teamCode,
  };
  return { answer: safeAnswer, acceptedAtMs: Date.parse(answer.acceptedAt) };
}

function formatTime(totalSeconds: number): string {
  return `${String(Math.floor(totalSeconds / 60)).padStart(2, "0")}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

function AcceptedIcon() {
  return <svg className="accepted-icon" viewBox="0 0 20 20" aria-hidden="true"><path d="m4.5 10.1 3.3 3.3 7.7-8" /></svg>;
}

function SoundIcon({ isEnabled }: { isEnabled: boolean }) {
  return (
    <svg className="sound-icon" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M4 8h3l3.4-3v10L7 12H4V8Z" />
      {isEnabled ? <path d="M13 7.1c.8.7 1.2 1.7 1.2 2.9s-.4 2.2-1.2 2.9M15.3 5.2a6.6 6.6 0 0 1 0 9.6" /> : <path d="m13.1 8 3.2 4m0-4-3.2 4" />}
    </svg>
  );
}

function LiquidRipple() {
  return <span className="liquid-ripple" aria-hidden="true"><span /></span>;
}

export function DailyGameBoard({ api = dailyGameApi }: DailyGameBoardProps) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [challenge, setChallenge] = useState<DailyChallenge | null>(null);
  const [attempt, setAttempt] = useState<DailyAttempt | null>(null);
  const [clockOffsetMs, setClockOffsetMs] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [inputValue, setInputValue] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [confirmedName, setConfirmedName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<DailyLeaderboardPayload | null>(null);
  const [leaderboardState, setLeaderboardState] = useState<"loading" | "ready" | "error">("loading");
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [highlightedDuplicateId, setHighlightedDuplicateId] = useState<string | null>(null);
  const [freshAnswerId, setFreshAnswerId] = useState<string | null>(null);
  const [milestoneScore, setMilestoneScore] = useState<number | null>(null);
  const [quickPairMessage, setQuickPairMessage] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [isReadyIntentActive, setIsReadyIntentActive] = useState(false);
  const [isFeedbackEnabled, setIsFeedbackEnabled] = useState(true);
  const [shareStatus, setShareStatus] = useState<ShareStatus>("idle");
  const inputRef = useRef<HTMLInputElement>(null);
  const noteBoardRef = useRef<HTMLElement>(null);
  const inputValueRef = useRef("");
  const finishPendingRef = useRef(false);
  const requestSequenceRef = useRef(0);
  const leaderboardSequenceRef = useRef(0);
  const inFlightAnswersRef = useRef(new Set<string>());
  const audioContextRef = useRef<AudioContext | null>(null);
  const readyTimeoutRef = useRef<number | null>(null);
  const automaticSubmitTimeoutRef = useRef<number | null>(null);
  const duplicateTimeoutRef = useRef<number | null>(null);
  const celebrationTimeoutRef = useRef<number | null>(null);
  const milestoneTimeoutRef = useRef<number | null>(null);
  const quickPairTimeoutRef = useRef<number | null>(null);

  const acceptedAnswers = useMemo(() => attempt?.answers ?? [], [attempt]);
  const acceptedEvents = useMemo(() => acceptedAnswers.map(asAcceptedEvent), [acceptedAnswers]);
  const stats = useMemo(() => calculatePracticeStats({
    acceptedEvents,
    startedAtMs: attempt ? Date.parse(attempt.startedAt) : 0,
    endedAtMs: attempt ? Date.parse(attempt.completedAt ?? attempt.deadlineAt) : 0,
    duplicateCount,
  }), [acceptedEvents, attempt, duplicateCount]);

  const playFeedback = useCallback((cue: FeedbackCue) => {
    if (!isFeedbackEnabled) return;
    const vibrationPatterns: Record<FeedbackCue, number | number[]> = {
      accepted: 12, duplicate: [18, 30, 18], "quick-pair": [14, 18, 22], milestone: [16, 24, 28], ended: [24, 36, 42],
    };
    try { navigator.vibrate?.(vibrationPatterns[cue]); } catch { /* Optional feedback. */ }
    try {
      if (typeof window.AudioContext !== "function") return;
      const context = audioContextRef.current ?? new window.AudioContext();
      audioContextRef.current = context;
      const frequencies: Record<FeedbackCue, number> = { accepted: 520, duplicate: 205, "quick-pair": 680, milestone: 720, ended: 320 };
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = frequencies[cue];
      gain.gain.setValueAtTime(0.04, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.14);
      oscillator.connect(gain); gain.connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + 0.14);
    } catch { /* Optional feedback. */ }
  }, [isFeedbackEnabled]);

  const hydrate = useCallback((payload: DailyStatusPayload) => {
    const offset = Date.parse(payload.serverNow) - Date.now();
    setClockOffsetMs(Number.isFinite(offset) ? offset : 0);
    setChallenge(payload.challenge);
    setAttempt(payload.attempt);
    setConfirmedName(payload.attempt?.displayName ?? "");
    setInputValue("");
    inputValueRef.current = "";
    setFeedback(null);
    finishPendingRef.current = false;
    if (!payload.challenge) setPhase("unavailable");
    else if (!payload.attempt || (payload.attempt.status === "active" && !payload.attempt.displayName)) setPhase("name");
    else if (payload.attempt.status === "active" && Date.parse(payload.attempt.deadlineAt) > Date.parse(payload.serverNow)) setPhase("playing");
    else setPhase("finished");
  }, []);

  const loadLeaderboard = useCallback(async () => {
    const sequence = ++leaderboardSequenceRef.current;
    setLeaderboardState("loading");
    try {
      const payload = await api.getLeaderboard();
      if (sequence === leaderboardSequenceRef.current) {
        setLeaderboard(payload);
        setLeaderboardState("ready");
      }
    } catch {
      if (sequence === leaderboardSequenceRef.current) {
        setLeaderboardState("error");
      }
    }
  }, [api]);

  const loadStatus = useCallback(async () => {
    const sequence = ++requestSequenceRef.current;
    setPhase("loading");
    try {
      const payload = await api.getStatus();
      if (sequence === requestSequenceRef.current) hydrate(payload);
    } catch {
      if (sequence === requestSequenceRef.current) {
        setFeedback({ kind: "error", message: "The daily challenge couldn’t load. Check your connection and retry." });
        setPhase("error");
      }
    }
  }, [api, hydrate]);

  useEffect(() => {
    const id = window.setTimeout(() => void loadStatus(), 0);
    return () => window.clearTimeout(id);
  }, [loadStatus]);
  useEffect(() => {
    if (phase !== "finished") return;
    const id = window.setTimeout(() => void loadLeaderboard(), 0);
    return () => window.clearTimeout(id);
  }, [loadLeaderboard, phase]);
  useEffect(() => {
    const id = window.setTimeout(() => setIsFeedbackEnabled(readFeedbackPreference(window.localStorage)), 0);
    return () => window.clearTimeout(id);
  }, []);
  useEffect(() => { if (phase === "playing") inputRef.current?.focus(); }, [phase]);
  useEffect(() => { const board = noteBoardRef.current; if (board) board.scrollTop = board.scrollHeight; }, [acceptedAnswers.length]);
  useEffect(() => () => {
    for (const ref of [readyTimeoutRef, automaticSubmitTimeoutRef, duplicateTimeoutRef, celebrationTimeoutRef, milestoneTimeoutRef, quickPairTimeoutRef]) {
      if (ref.current !== null) window.clearTimeout(ref.current);
    }
    void audioContextRef.current?.close();
  }, []);

  const finishRound = useCallback(async (message = "Round ended — ink down.") => {
    if (!attempt || finishPendingRef.current || (phase !== "playing" && phase !== "ending")) return;
    finishPendingRef.current = true;
    setPhase("ending");
    setInputValue(""); inputValueRef.current = "";
    setFeedback({ kind: "ended", message });
    playFeedback("ended");
    try {
      const result = await api.finish(attempt.id);
      setClockOffsetMs(Date.parse(result.serverNow) - Date.now());
      setAttempt(result.attempt);
      setPhase("finished");
    } catch {
      finishPendingRef.current = false;
      setFeedback({ kind: "error", message: "The server couldn’t verify the finish yet. Retry to recover your result." });
      setPhase("error");
    }
  }, [api, attempt, phase, playFeedback]);

  useEffect(() => {
    if (phase !== "playing" || !attempt) return;
    const deadline = Date.parse(attempt.deadlineAt);
    const syncClock = () => {
      const remaining = Math.max(0, Math.ceil((deadline - (Date.now() + clockOffsetMs)) / 1_000));
      setRemainingSeconds(remaining);
      if (remaining === 0) void finishRound("Time’s up — verifying your board.");
    };
    syncClock();
    const id = window.setInterval(syncClock, 250);
    return () => window.clearInterval(id);
  }, [attempt, clockOffsetMs, finishRound, phase]);

  function clearReadyIntent() {
    if (readyTimeoutRef.current !== null) window.clearTimeout(readyTimeoutRef.current);
    readyTimeoutRef.current = null;
    setIsReadyIntentActive(false);
  }

  async function startRound() {
    if (phase !== "ready" || !confirmedName) return;
    clearReadyIntent();
    setPhase("starting");
    try { hydrate(await api.start(confirmedName)); }
    catch {
      setFeedback({ kind: "error", message: "The round couldn’t be recovered. Retry to preserve any original deadline." });
      setPhase("error");
    }
  }

  async function handleNameSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedName = normalizeDisplayName(nameInput);
    if (!normalizedName) {
      setNameError("Use 2–24 letters or numbers. Spaces, apostrophes, periods, and hyphens are allowed.");
      return;
    }

    setNameError(null);
    setConfirmedName(normalizedName);
    setNameInput(normalizedName);

    if (!attempt) {
      setPhase("ready");
      return;
    }

    setPhase("starting");
    try {
      hydrate(await api.start(normalizedName));
    } catch {
      setFeedback({ kind: "error", message: "This pre-release attempt can’t be renamed or restarted." });
      setPhase("error");
    }
  }

  function beginReadyIntent() {
    if (phase !== "ready" || readyTimeoutRef.current !== null) return;
    setIsReadyIntentActive(true);
    readyTimeoutRef.current = window.setTimeout(() => void startRound(), readyDwellMilliseconds);
  }

  function handleReadyKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); void startRound(); }
  }

  function handleRipplePointerMove(event: PointerEvent<HTMLElement>) {
    if (event.pointerType === "touch") return;
    const bounds = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--ripple-x", `${event.clientX - bounds.left}px`);
    event.currentTarget.style.setProperty("--ripple-y", `${event.clientY - bounds.top}px`);
  }

  function showTransientAnswer(answer: DailyAcceptedAnswer, status: "accepted" | "duplicate") {
    const targetRef = status === "accepted" ? celebrationTimeoutRef : duplicateTimeoutRef;
    if (targetRef.current !== null) window.clearTimeout(targetRef.current);
    if (status === "accepted") setFreshAnswerId(answer.id); else setHighlightedDuplicateId(answer.id);
    targetRef.current = window.setTimeout(() => {
      if (status === "accepted") setFreshAnswerId(null); else setHighlightedDuplicateId(null);
      targetRef.current = null;
    }, status === "accepted" ? acceptedCelebrationMilliseconds : duplicateHighlightMilliseconds);
  }

  async function submitAnswer(rawAnswer: string, reportInvalid: boolean) {
    const submitted = rawAnswer.trim();
    if (!attempt || phase !== "playing" || submitted.length === 0) return;
    const requestKey = submitted.toLocaleLowerCase();
    if (inFlightAnswersRef.current.has(requestKey)) return;
    inFlightAnswersRef.current.add(requestKey);
    try {
      const result = await api.submit(attempt.id, submitted);
      setClockOffsetMs(Date.parse(result.serverNow) - Date.now());
      if (result.status === "round-ended") {
        setAttempt(result.attempt); setPhase("finished"); setFeedback({ kind: "ended", message: "Time’s up — result verified." });
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
      if (inputValueRef.current.trim() === submitted) { setInputValue(""); inputValueRef.current = ""; }
      if (result.status === "duplicate") {
        setDuplicateCount((count) => count + 1);
        showTransientAnswer(result.answer, "duplicate");
        setFeedback({ kind: "duplicate", message: `${result.answer.canonicalText} is already on your board` });
        playFeedback("duplicate");
        return;
      }
      setAttempt((current) => current ? {
        ...current,
        score: result.score,
        answers: current.answers.some((answer) => answer.id === result.answer.id)
          ? current.answers
          : [...current.answers, result.answer].sort((a, b) => Date.parse(a.acceptedAt) - Date.parse(b.acceptedAt)),
      } : current);
      showTransientAnswer(result.answer, "accepted");
      const previous = acceptedAnswers[acceptedAnswers.length - 1];
      const quickPair = previous ? getQuickPairFeedback(Date.parse(previous.acceptedAt), Date.parse(result.answer.acceptedAt)) : null;
      if (quickPair) {
        setQuickPairMessage(quickPair.message);
        if (quickPairTimeoutRef.current !== null) window.clearTimeout(quickPairTimeoutRef.current);
        quickPairTimeoutRef.current = window.setTimeout(() => setQuickPairMessage(null), 3_200);
      }
      if (result.score % 5 === 0) {
        setMilestoneScore(result.score);
        if (milestoneTimeoutRef.current !== null) window.clearTimeout(milestoneTimeoutRef.current);
        milestoneTimeoutRef.current = window.setTimeout(() => setMilestoneScore(null), milestoneDisplayMilliseconds);
      }
      setFeedback({ kind: "accepted", message: result.score % 5 === 0 ? `${result.score} names — hot run` : `${result.answer.canonicalText} added` });
      playFeedback(result.score % 5 === 0 ? "milestone" : quickPair ? "quick-pair" : "accepted");
    } catch {
      setFeedback({ kind: "error", message: "That answer couldn’t be checked. Your verified score is safe; try again." });
    } finally {
      inFlightAnswersRef.current.delete(requestKey);
    }
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    const nextValue = event.target.value;
    setInputValue(nextValue); inputValueRef.current = nextValue;
    if (automaticSubmitTimeoutRef.current !== null) window.clearTimeout(automaticSubmitTimeoutRef.current);
    if (nextValue.trim().length >= 2) {
      automaticSubmitTimeoutRef.current = window.setTimeout(() => void submitAnswer(nextValue, false), automaticSubmitMilliseconds);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (automaticSubmitTimeoutRef.current !== null) window.clearTimeout(automaticSubmitTimeoutRef.current);
    void submitAnswer(inputValue, true);
  }

  function toggleFeedback() {
    const next = !isFeedbackEnabled;
    setIsFeedbackEnabled(next);
    writeFeedbackPreference(window.localStorage, next);
  }

  async function shareResult() {
    if (!challenge || !attempt) return;
    const scorePattern = `${"◆".repeat(Math.floor(attempt.score / 5))}${"•".repeat(attempt.score % 5)}` || "—";
    const text = [`NameMore Daily — ${challenge.date}`, `${attempt.score} ${attempt.score === 1 ? "name" : "names"} · ${stats.representedTeamCodes.length}/30 NBA teams`, scorePattern, "Verified daily result"].join("\n");
    try {
      if (navigator.share) { await navigator.share({ title: "NameMore Daily", text }); setShareStatus("shared"); }
      else if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); setShareStatus("copied"); }
      else setShareStatus("error");
    } catch (error) {
      setShareStatus(error instanceof DOMException && error.name === "AbortError" ? "idle" : "error");
    }
  }

  const isUrgent = phase === "playing" && remainingSeconds <= 10;
  const freshAnswer = freshAnswerId ? acceptedAnswers.find((answer) => answer.id === freshAnswerId) : null;
  const prompt = challenge?.category.prompt ?? "How many NBA players can you name?";

  return (
    <section className={`game-board is-${phase}${isUrgent ? " is-urgent-round" : ""}`} aria-labelledby="game-prompt">
      <header className="board-header">
        <div className="brand" aria-label="NameMore">NameMore</div>
        <div className="header-controls">
          <div className="game-hud" aria-label="Round status">
            <time className={`hud-value${isUrgent ? " is-urgent" : ""}`} dateTime={`PT${remainingSeconds}S`} data-testid="timer-value">{formatTime(remainingSeconds)}</time>
            <span className="hud-divider" aria-hidden="true" />
            <span className="hud-value hud-score-value" data-testid="score-value">{String(attempt?.score ?? 0).padStart(2, "0")}</span>
          </div>
          <button className="sound-toggle" type="button" aria-label={`Sound and haptics ${isFeedbackEnabled ? "on" : "off"}`} aria-pressed={isFeedbackEnabled} onClick={toggleFeedback}><SoundIcon isEnabled={isFeedbackEnabled} /></button>
        </div>
      </header>

      {phase === "loading" || phase === "starting" ? (
        <div className="ready-state" aria-live="polite"><div className="ready-copy"><h1 id="game-prompt">{phase === "starting" ? "Starting your verified round…" : "Loading today’s challenge…"}</h1><p>The server is preparing your daily board.</p></div></div>
      ) : phase === "unavailable" || phase === "error" ? (
        <div className="ready-state"><div className="ready-copy"><h1 id="game-prompt">{phase === "unavailable" ? "Today’s challenge isn’t available yet." : "We couldn’t reach the daily challenge."}</h1><p>{feedback?.message ?? "Try again in a moment."}</p></div><button className="ready-zone" type="button" onClick={() => void loadStatus()}><strong>Retry</strong><span>Your score and timer remain server-authoritative.</span></button></div>
      ) : phase === "name" && challenge ? (
        <div className="ready-state name-state">
          <div className="ready-copy">
            <h1 id="game-prompt">Choose your daily display name</h1>
            <p>One verified attempt per UTC challenge. Your display name is public on the leaderboard and cannot be changed after the round starts.</p>
          </div>
          <form className="display-name-form" onSubmit={handleNameSubmit}>
            <label htmlFor="display-name">Display name</label>
            <div className="display-name-entry">
              <input
                id="display-name"
                name="displayName"
                type="text"
                value={nameInput}
                onChange={(event) => setNameInput(event.target.value)}
                autoComplete="nickname"
                maxLength={24}
                aria-describedby="display-name-help display-name-error"
                autoFocus
              />
              <button type="submit">Continue</button>
            </div>
            <p id="display-name-help">2–24 characters. Duplicate names are allowed; names are never used as identity.</p>
            <p id="display-name-error" className="display-name-error" role="alert">{nameError}</p>
          </form>
        </div>
      ) : phase === "ready" && challenge ? (
        <div className="ready-state">
          <div className="ready-copy"><h1 id="game-prompt">{prompt}</h1><p>{challenge.category.timeLimitSeconds} seconds as {confirmedName}. The server starts the one-attempt clock and verifies every name.</p></div>
          <button className={`ready-zone ripple-surface${isReadyIntentActive ? " is-activating" : ""}`} type="button" aria-describedby="ready-instructions" onPointerEnter={(event) => { if (event.pointerType === "mouse") beginReadyIntent(); }} onPointerLeave={clearReadyIntent} onPointerDown={(event) => { if (event.pointerType !== "mouse") beginReadyIntent(); }} onPointerUp={clearReadyIntent} onPointerCancel={clearReadyIntent} onPointerMove={handleRipplePointerMove} onFocus={beginReadyIntent} onBlur={clearReadyIntent} onKeyDown={handleReadyKeyDown}>
            <LiquidRipple /><span className="ready-ring" aria-hidden="true"><svg viewBox="0 0 120 120"><circle className="ready-ring-track" cx="60" cy="60" r="53" /><circle className="ready-ring-progress" cx="60" cy="60" r="53" /></svg><span className="ready-dot" /></span><strong>Move here when you’re ready</strong><span id="ready-instructions">Focus or press and hold also works.</span>
          </button>
        </div>
      ) : phase === "finished" && challenge && attempt ? (
        <DailyGameResults
          category={challenge.category}
          stats={stats}
          shareStatus={shareStatus}
          leaderboard={leaderboard}
          leaderboardState={leaderboardState}
          onRefresh={() => void loadStatus()}
          onRetryLeaderboard={() => void loadLeaderboard()}
          onShare={() => void shareResult()}
        />
      ) : (
        <div className="play-surface">
          <div className="prompt-block"><h1 id="game-prompt">{prompt}</h1></div>
          <section ref={noteBoardRef} className={`note-board ripple-surface${milestoneScore ? " is-milestone" : ""}${quickPairMessage ? " is-quick-pair" : ""}`} aria-label="Answer writing board" onClick={() => inputRef.current?.focus()} onPointerMove={handleRipplePointerMove}>
            {freshAnswer ? <span className="team-color-flash" style={getTeamAccentStyle(freshAnswer.teamCode)} aria-hidden="true" /> : null}
            {quickPairMessage ? <><span className="quick-pair-ripple" aria-hidden="true" /><div className="quick-pair-banner" data-testid="quick-pair-banner" aria-live="polite"><span className="quick-pair-glyph" aria-hidden="true">2</span><span><small>Quick pair</small><strong>{quickPairMessage}</strong></span></div></> : null}
            <LiquidRipple />
            {milestoneScore ? <span className="milestone-wave-label" aria-hidden="true">{milestoneScore} names</span> : null}
            <h2 className="sr-only">Your verified answers</h2>
            {acceptedAnswers.length > 0 ? <ol className="answers-list">{acceptedAnswers.map((answer) => <li className={`${answer.id === freshAnswerId ? "is-fresh" : ""}${answer.id === highlightedDuplicateId ? " is-duplicate-target" : ""}`.trim()} data-answer-id={answer.id} data-team-code={answer.teamCode} data-testid={`answer-row-${answer.id}`} key={answer.id} style={getTeamAccentStyle(answer.teamCode)}><AcceptedIcon /><strong>{answer.canonicalText}</strong><span className="answer-icon-slot" aria-label={`Team ${answer.teamCode}`}>{answer.teamCode}</span></li>)}</ol> : null}
            {phase === "playing" ? <form className="note-entry" onSubmit={handleSubmit}><label className="sr-only" htmlFor="answer-input">Type an NBA player’s name</label><input ref={inputRef} id="answer-input" name="answer" type="text" value={inputValue} onChange={handleInputChange} placeholder="Type a full name or unique last name…" autoComplete="off" autoCapitalize="words" spellCheck="false" maxLength={80} />{freshAnswer ? <span className="entry-success" style={getTeamAccentStyle(freshAnswer.teamCode)} aria-hidden="true"><AcceptedIcon /></span> : null}</form> : <div className="ink-freeze" aria-hidden="true"><span /></div>}
          </section>
          <div className={`feedback${feedback ? ` is-${feedback.kind}` : ""}`} role="status" aria-live="polite" aria-atomic="true">{feedback?.kind === "accepted" ? <AcceptedIcon /> : null}<span>{feedback?.message ?? (phase === "playing" ? "Names are checked securely as you type." : "Finishing your verified board…")}</span></div>
        </div>
      )}

      <footer className="board-footer"><span>{challenge ? `UTC daily · ${challenge.date} · resets 00:00 UTC` : "Daily challenge · verified"}</span>{phase === "playing" ? <button type="button" onClick={() => void finishRound()}>End round</button> : null}</footer>
    </section>
  );
}
