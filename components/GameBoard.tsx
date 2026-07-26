"use client";

import Link from "next/link";
import {
  type CSSProperties,
  type ChangeEvent,
  type CompositionEvent,
  type FormEvent,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { GameResults } from "@/components/GameResults";
import type { Category, CategoryAnswer } from "@/lib/category-types";
import {
  buildAnswerLookup,
  evaluateAnswerSubmission,
  shouldDelayAutomaticMatch,
} from "@/lib/game-logic";
import {
  buildSpoilerFreeShareText,
  calculatePracticeStats,
  getPracticeBestStorageKey,
  getQuickPairFeedback,
  readFeedbackPreference,
  readPracticeBest,
  type AcceptedAnswerEvent,
  type QuickPairFeedback,
  writeFeedbackPreference,
  writePracticeBest,
} from "@/lib/practice-game";

type GamePhase = "ready" | "playing" | "ending" | "finished";

type Feedback = {
  kind: "accepted" | "duplicate" | "invalid" | "ended";
  message: string;
};

type FeedbackCue =
  | "accepted"
  | "duplicate"
  | "quick-pair"
  | "milestone"
  | "ended";
type ShareStatus = "idle" | "copied" | "shared" | "error";

type QuickPairNotice = QuickPairFeedback & {
  id: number;
};

type GameBoardProps = {
  category: Category;
};

const readyDwellMilliseconds = 900;
const endingTransitionMilliseconds = 460;
const duplicateHighlightMilliseconds = 800;
const milestoneDisplayMilliseconds = 1_100;
const delayedAutomaticMatchMilliseconds = 420;
const acceptedCelebrationMilliseconds = 700;
const quickPairDisplayMilliseconds = 3_200;

type TeamAccentStyle = CSSProperties & {
  "--team-primary": string;
  "--team-secondary": string;
};

function getAnswerAccentStyle(answer: CategoryAnswer): TeamAccentStyle {
  return {
    "--team-primary": answer.visual?.primaryColor ?? "#1463ff",
    "--team-secondary": answer.visual?.secondaryColor ?? "#dbe6ff",
  };
}

function AnswerIconSlot({
  accessibleLabel,
  children,
  style,
}: {
  accessibleLabel: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <span
      className="answer-icon-slot"
      aria-label={accessibleLabel}
      style={style}
    >
      {children}
    </span>
  );
}

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function AcceptedIcon() {
  return (
    <svg className="accepted-icon" viewBox="0 0 20 20" aria-hidden="true">
      <path d="m4.5 10.1 3.3 3.3 7.7-8" />
    </svg>
  );
}

function SoundIcon({ isEnabled }: { isEnabled: boolean }) {
  return (
    <svg className="sound-icon" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M4 8h3l3.4-3v10L7 12H4V8Z" />
      {isEnabled ? (
        <path d="M13 7.1c.8.7 1.2 1.7 1.2 2.9s-.4 2.2-1.2 2.9M15.3 5.2a6.6 6.6 0 0 1 0 9.6" />
      ) : (
        <path d="m13.1 8 3.2 4m0-4-3.2 4" />
      )}
    </svg>
  );
}

function LiquidRipple() {
  return (
    <span className="liquid-ripple" aria-hidden="true">
      <span />
    </span>
  );
}

export function GameBoard({ category }: GameBoardProps) {
  const answerLookup = useMemo(
    () => buildAnswerLookup(category.answers),
    [category.answers],
  );
  const practiceBestStorageKey = useMemo(
    () => getPracticeBestStorageKey(category),
    [category],
  );
  const [phase, setPhase] = useState<GamePhase>("ready");
  const [deadlineMs, setDeadlineMs] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(
    category.timeLimitSeconds,
  );
  const [inputValue, setInputValue] = useState("");
  const [acceptedEvents, setAcceptedEvents] = useState<AcceptedAnswerEvent[]>([]);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [highlightedDuplicateId, setHighlightedDuplicateId] = useState<
    string | null
  >(null);
  const [freshAnswerId, setFreshAnswerId] = useState<string | null>(null);
  const [milestoneScore, setMilestoneScore] = useState<number | null>(null);
  const [quickPairNotice, setQuickPairNotice] =
    useState<QuickPairNotice | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [isReadyIntentActive, setIsReadyIntentActive] = useState(false);
  const [roundStartedAtMs, setRoundStartedAtMs] = useState<number | null>(null);
  const [roundEndedAtMs, setRoundEndedAtMs] = useState<number | null>(null);
  const [personalBest, setPersonalBest] = useState(0);
  const [bestAtRoundStart, setBestAtRoundStart] = useState(0);
  const [isFeedbackEnabled, setIsFeedbackEnabled] = useState(true);
  const [shareStatus, setShareStatus] = useState<ShareStatus>("idle");
  const inputRef = useRef<HTMLInputElement>(null);
  const noteBoardRef = useRef<HTMLElement>(null);
  const readyTimeoutRef = useRef<number | null>(null);
  const duplicateTimeoutRef = useRef<number | null>(null);
  const milestoneTimeoutRef = useRef<number | null>(null);
  const acceptedCelebrationTimeoutRef = useRef<number | null>(null);
  const quickPairTimeoutRef = useRef<number | null>(null);
  const automaticMatchTimeoutRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const typingAnimationRef = useRef<Animation | null>(null);
  const quickPairSequenceRef = useRef(0);
  const feedbackEnabledRef = useRef(true);
  const isComposingRef = useRef(false);

  const acceptedAnswers = useMemo(
    () => acceptedEvents.map((event) => event.answer),
    [acceptedEvents],
  );
  const acceptedAnswerIds = useMemo(
    () => new Set(acceptedAnswers.map((answer) => answer.id)),
    [acceptedAnswers],
  );
  const practiceStats = useMemo(
    () =>
      calculatePracticeStats({
        acceptedEvents,
        startedAtMs: roundStartedAtMs ?? 0,
        endedAtMs: roundEndedAtMs ?? roundStartedAtMs ?? 0,
        duplicateCount,
        coverage: category.coverage,
      }),
    [acceptedEvents, category.coverage, duplicateCount, roundEndedAtMs, roundStartedAtMs],
  );

  const playFeedback = useCallback((cue: FeedbackCue) => {
    if (!feedbackEnabledRef.current) {
      return;
    }

    const vibrationPatterns: Record<FeedbackCue, number | number[]> = {
      accepted: 12,
      duplicate: [18, 30, 18],
      "quick-pair": [14, 18, 22],
      milestone: [16, 24, 28],
      ended: [24, 36, 42],
    };

    try {
      if (typeof navigator.vibrate === "function") {
        navigator.vibrate(vibrationPatterns[cue]);
      }
    } catch {
      // Feedback is optional and must never interrupt play.
    }

    try {
      if (typeof window.AudioContext !== "function") {
        return;
      }

      const context =
        audioContextRef.current ??
        (() => {
          const nextContext = new window.AudioContext();
          audioContextRef.current = nextContext;
          return nextContext;
        })();
      const tonePlans: Record<
        FeedbackCue,
        readonly {
          frequency: number;
          delay: number;
          duration: number;
          peakGain: number;
        }[]
      > = {
        accepted: [
          { frequency: 520, delay: 0, duration: 0.13, peakGain: 0.065 },
          { frequency: 760, delay: 0.055, duration: 0.16, peakGain: 0.055 },
        ],
        duplicate: [
          { frequency: 205, delay: 0, duration: 0.11, peakGain: 0.04 },
        ],
        "quick-pair": [
          { frequency: 620, delay: 0, duration: 0.14, peakGain: 0.065 },
          { frequency: 880, delay: 0.05, duration: 0.17, peakGain: 0.06 },
        ],
        milestone: [
          { frequency: 720, delay: 0, duration: 0.18, peakGain: 0.05 },
        ],
        ended: [
          { frequency: 320, delay: 0, duration: 0.11, peakGain: 0.045 },
        ],
      };

      for (const tone of tonePlans[cue]) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const startsAt = context.currentTime + tone.delay;

        oscillator.type = cue === "duplicate" ? "triangle" : "sine";
        oscillator.frequency.setValueAtTime(tone.frequency, startsAt);
        gain.gain.setValueAtTime(0.0001, startsAt);
        gain.gain.exponentialRampToValueAtTime(
          tone.peakGain,
          startsAt + 0.012,
        );
        gain.gain.exponentialRampToValueAtTime(
          0.0001,
          startsAt + tone.duration,
        );
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(startsAt);
        oscillator.stop(startsAt + tone.duration);
      }
    } catch {
      // Browsers may deny audio creation; gameplay remains unchanged.
    }
  }, []);

  useEffect(() => {
    function syncLocalPreferences() {
      setPersonalBest(
        readPracticeBest(window.localStorage, practiceBestStorageKey),
      );
      const nextFeedbackPreference = readFeedbackPreference(window.localStorage);
      setIsFeedbackEnabled(nextFeedbackPreference);
      feedbackEnabledRef.current = nextFeedbackPreference;
    }

    const initialSyncId = window.setTimeout(syncLocalPreferences, 0);
    window.addEventListener("storage", syncLocalPreferences);

    return () => {
      window.clearTimeout(initialSyncId);
      window.removeEventListener("storage", syncLocalPreferences);
    };
  }, [practiceBestStorageKey]);

  useEffect(() => {
    feedbackEnabledRef.current = isFeedbackEnabled;
  }, [isFeedbackEnabled]);

  useEffect(() => {
    if (phase === "playing") {
      inputRef.current?.focus();
    }
  }, [phase]);

  useEffect(() => {
    const noteBoard = noteBoardRef.current;

    if (noteBoard) {
      noteBoard.scrollTop = noteBoard.scrollHeight;
    }
  }, [acceptedEvents.length]);

  useEffect(() => {
    return () => {
      for (const timeoutRef of [
        readyTimeoutRef,
        duplicateTimeoutRef,
        milestoneTimeoutRef,
        acceptedCelebrationTimeoutRef,
        quickPairTimeoutRef,
        automaticMatchTimeoutRef,
      ]) {
        if (timeoutRef.current !== null) {
          window.clearTimeout(timeoutRef.current);
        }
      }

      if (audioContextRef.current) {
        void audioContextRef.current.close();
      }

      typingAnimationRef.current?.cancel();
    };
  }, []);

  useEffect(() => {
    if (phase !== "ending") {
      return;
    }

    const score = acceptedEvents.length;
    const timeoutId = window.setTimeout(() => {
      if (score > personalBest) {
        writePracticeBest(window.localStorage, practiceBestStorageKey, score);
        setPersonalBest(score);
      }
      setPhase("finished");
    }, endingTransitionMilliseconds);

    return () => window.clearTimeout(timeoutId);
  }, [acceptedEvents.length, personalBest, phase, practiceBestStorageKey]);

  useEffect(() => {
    if (phase !== "playing" || deadlineMs === null) {
      return;
    }

    const deadline = deadlineMs;

    function syncClock() {
      const nextRemaining = Math.max(
        0,
        Math.ceil((deadline - Date.now()) / 1_000),
      );

      setRemainingSeconds((current) =>
        current === nextRemaining ? current : nextRemaining,
      );

      if (nextRemaining === 0) {
        setRoundEndedAtMs(deadline);
        setDeadlineMs(null);
        setInputValue("");
        setFeedback({ kind: "ended", message: "Time’s up — ink down." });
        setPhase("ending");
        playFeedback("ended");
      }
    }

    syncClock();
    const intervalId = window.setInterval(syncClock, 250);

    return () => window.clearInterval(intervalId);
  }, [deadlineMs, phase, playFeedback]);

  function cancelReadyIntent() {
    if (readyTimeoutRef.current !== null) {
      window.clearTimeout(readyTimeoutRef.current);
      readyTimeoutRef.current = null;
    }
    setIsReadyIntentActive(false);
  }

  function clearTransientTimers() {
    if (duplicateTimeoutRef.current !== null) {
      window.clearTimeout(duplicateTimeoutRef.current);
      duplicateTimeoutRef.current = null;
    }
    if (milestoneTimeoutRef.current !== null) {
      window.clearTimeout(milestoneTimeoutRef.current);
      milestoneTimeoutRef.current = null;
    }
    if (automaticMatchTimeoutRef.current !== null) {
      window.clearTimeout(automaticMatchTimeoutRef.current);
      automaticMatchTimeoutRef.current = null;
    }
    if (acceptedCelebrationTimeoutRef.current !== null) {
      window.clearTimeout(acceptedCelebrationTimeoutRef.current);
      acceptedCelebrationTimeoutRef.current = null;
    }
    if (quickPairTimeoutRef.current !== null) {
      window.clearTimeout(quickPairTimeoutRef.current);
      quickPairTimeoutRef.current = null;
    }
  }

  function startRound() {
    if (readyTimeoutRef.current !== null) {
      window.clearTimeout(readyTimeoutRef.current);
      readyTimeoutRef.current = null;
    }
    clearTransientTimers();

    const startedAtMs = Date.now();
    setIsReadyIntentActive(false);
    setAcceptedEvents([]);
    setDuplicateCount(0);
    setHighlightedDuplicateId(null);
    setFreshAnswerId(null);
    setMilestoneScore(null);
    setQuickPairNotice(null);
    setInputValue("");
    setFeedback(null);
    setShareStatus("idle");
    setRemainingSeconds(category.timeLimitSeconds);
    setRoundStartedAtMs(startedAtMs);
    setRoundEndedAtMs(null);
    setBestAtRoundStart(personalBest);
    setDeadlineMs(startedAtMs + category.timeLimitSeconds * 1_000);
    setPhase("playing");
  }

  function beginReadyIntent() {
    if (phase !== "ready" || readyTimeoutRef.current !== null) {
      return;
    }

    setIsReadyIntentActive(true);
    readyTimeoutRef.current = window.setTimeout(
      startRound,
      readyDwellMilliseconds,
    );
  }

  function handleReadyPointerEnter(event: PointerEvent<HTMLButtonElement>) {
    if (event.pointerType === "mouse") {
      beginReadyIntent();
    }
  }

  function handleReadyPointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (event.pointerType !== "mouse") {
      beginReadyIntent();
    }
  }

  function handleRipplePointerMove(event: PointerEvent<HTMLElement>) {
    if (event.pointerType === "touch") {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty(
      "--ripple-x",
      `${event.clientX - bounds.left}px`,
    );
    event.currentTarget.style.setProperty(
      "--ripple-y",
      `${event.clientY - bounds.top}px`,
    );
  }

  function handleReadyKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      startRound();
    }
  }

  function beginRoundEnd(message: string, endedAtMs: number) {
    if (phase !== "playing") {
      return;
    }

    setRoundEndedAtMs(endedAtMs);
    setDeadlineMs(null);
    setInputValue("");
    setFeedback({ kind: "ended", message });
    setPhase("ending");
    playFeedback("ended");
  }

  function finishRound() {
    beginRoundEnd("Round ended — ink down.", Date.now());
  }

  function showDuplicate(answerId: string) {
    if (duplicateTimeoutRef.current !== null) {
      window.clearTimeout(duplicateTimeoutRef.current);
    }

    setHighlightedDuplicateId(answerId);
    duplicateTimeoutRef.current = window.setTimeout(() => {
      setHighlightedDuplicateId(null);
      duplicateTimeoutRef.current = null;
    }, duplicateHighlightMilliseconds);
  }

  function showAcceptedCelebration(answerId: string) {
    if (acceptedCelebrationTimeoutRef.current !== null) {
      window.clearTimeout(acceptedCelebrationTimeoutRef.current);
    }

    setFreshAnswerId(answerId);
    acceptedCelebrationTimeoutRef.current = window.setTimeout(() => {
      setFreshAnswerId(null);
      acceptedCelebrationTimeoutRef.current = null;
    }, acceptedCelebrationMilliseconds);
  }

  function showMilestone(score: number) {
    if (milestoneTimeoutRef.current !== null) {
      window.clearTimeout(milestoneTimeoutRef.current);
    }

    setMilestoneScore(score);
    milestoneTimeoutRef.current = window.setTimeout(() => {
      setMilestoneScore(null);
      milestoneTimeoutRef.current = null;
    }, milestoneDisplayMilliseconds);
  }

  function showQuickPair(feedback: QuickPairFeedback) {
    if (quickPairTimeoutRef.current !== null) {
      window.clearTimeout(quickPairTimeoutRef.current);
    }

    quickPairSequenceRef.current += 1;
    setQuickPairNotice({ ...feedback, id: quickPairSequenceRef.current });
    quickPairTimeoutRef.current = window.setTimeout(() => {
      setQuickPairNotice(null);
      quickPairTimeoutRef.current = null;
    }, quickPairDisplayMilliseconds);
  }

  function resolveAnswer(rawAnswer: string, shouldReportInvalid: boolean) {
    const hasRoundEnded =
      phase !== "playing" || deadlineMs === null || Date.now() >= deadlineMs;
    const result = evaluateAnswerSubmission(
      rawAnswer,
      answerLookup,
      acceptedAnswerIds,
      hasRoundEnded,
    );

    switch (result.status) {
      case "accepted": {
        const score = acceptedEvents.length + 1;
        const acceptedAtMs = Date.now();
        const previousEvent = acceptedEvents[acceptedEvents.length - 1];
        const quickPairFeedback = previousEvent
          ? getQuickPairFeedback(previousEvent.acceptedAtMs, acceptedAtMs)
          : null;
        setAcceptedEvents((current) => [
          ...current,
          { answer: result.answer, acceptedAtMs },
        ]);
        showAcceptedCelebration(result.answer.id);
        if (quickPairFeedback) {
          showQuickPair(quickPairFeedback);
        }
        setInputValue("");

        if (score % 5 === 0) {
          showMilestone(score);
          setFeedback({
            kind: "accepted",
            message: `${score} names — hot run`,
          });
          playFeedback("milestone");
        } else {
          setFeedback({
            kind: "accepted",
            message: `${result.answer.canonicalText} added`,
          });
          playFeedback(quickPairFeedback ? "quick-pair" : "accepted");
        }
        break;
      }
      case "duplicate":
        setInputValue("");
        setDuplicateCount((current) => current + 1);
        showDuplicate(result.answer.id);
        setFeedback({
          kind: "duplicate",
          message: `${result.answer.canonicalText} is already on your board`,
        });
        playFeedback("duplicate");
        break;
      case "invalid":
        if (shouldReportInvalid && rawAnswer.trim().length > 0) {
          setFeedback({
            kind: "invalid",
            message: "No match yet — keep typing or try another answer.",
          });
        }
        break;
      case "round-ended":
        setRemainingSeconds(0);
        beginRoundEnd("Time’s up — ink down.", deadlineMs ?? Date.now());
        break;
    }
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    const nextValue = event.target.value;

    if (
      nextValue.length > inputValue.length &&
      typeof event.currentTarget.animate === "function" &&
      !(
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      )
    ) {
      typingAnimationRef.current?.cancel();
      typingAnimationRef.current = event.currentTarget.animate(
        [
          { filter: "blur(0.35px)", opacity: 0.9 },
          { filter: "blur(0)", opacity: 1 },
        ],
        {
          duration: 90,
          easing: "cubic-bezier(0.16, 0.78, 0.22, 1)",
        },
      );
    }

    if (automaticMatchTimeoutRef.current !== null) {
      window.clearTimeout(automaticMatchTimeoutRef.current);
      automaticMatchTimeoutRef.current = null;
    }

    setInputValue(nextValue);

    if (!isComposingRef.current && nextValue.trim().length > 0) {
      if (shouldDelayAutomaticMatch(nextValue, answerLookup)) {
        automaticMatchTimeoutRef.current = window.setTimeout(() => {
          automaticMatchTimeoutRef.current = null;
          resolveAnswer(nextValue, false);
        }, delayedAutomaticMatchMilliseconds);
      } else {
        resolveAnswer(nextValue, false);
      }
    }
  }

  function handleCompositionEnd(event: CompositionEvent<HTMLInputElement>) {
    isComposingRef.current = false;
    resolveAnswer(event.currentTarget.value, false);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (automaticMatchTimeoutRef.current !== null) {
      window.clearTimeout(automaticMatchTimeoutRef.current);
      automaticMatchTimeoutRef.current = null;
    }
    resolveAnswer(inputValue, true);
  }

  function toggleFeedback() {
    const nextValue = !isFeedbackEnabled;
    feedbackEnabledRef.current = nextValue;
    setIsFeedbackEnabled(nextValue);
    writeFeedbackPreference(window.localStorage, nextValue);
  }

  async function shareResult() {
    const shareText = buildSpoilerFreeShareText({
      categoryTitle: category.title,
      score: practiceStats.answerCount,
      coverageSummary: practiceStats.coverage
        ? {
            represented: practiceStats.coverage.representedGroupIds.length,
            total: practiceStats.coverage.groups.length,
            itemLabel: practiceStats.coverage.itemLabel,
          }
        : undefined,
    });

    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: "NameMore result", text: shareText });
        setShareStatus("shared");
        return;
      }

      if (typeof navigator.clipboard?.writeText === "function") {
        await navigator.clipboard.writeText(shareText);
        setShareStatus("copied");
        return;
      }

      setShareStatus("error");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setShareStatus("idle");
      } else {
        setShareStatus("error");
      }
    }
  }

  const isUrgent = phase === "playing" && remainingSeconds <= 10;
  const hasPassedBest =
    phase !== "ready" && acceptedEvents.length > bestAtRoundStart;
  const displayedBest = Math.max(personalBest, acceptedEvents.length);
  const isNewPersonalBest =
    acceptedEvents.length > 0 && acceptedEvents.length > bestAtRoundStart;
  const freshAcceptedAnswer = freshAnswerId
    ? (acceptedAnswers.find((answer) => answer.id === freshAnswerId) ?? null)
    : null;

  return (
    <section
      className={`game-board is-${phase}${isUrgent ? " is-urgent-round" : ""}`}
      aria-labelledby="game-prompt"
      data-category-slug={category.slug}
    >
      <header className="board-header">
        <Link className="brand" href="/" aria-label="NameMore home">
          NameMore
        </Link>
        <div className="header-controls">
          <div className="game-hud" aria-label="Round status">
            <time
              className={`hud-value${isUrgent ? " is-urgent" : ""}`}
              dateTime={`PT${remainingSeconds}S`}
              data-testid="timer-value"
              aria-label={`${remainingSeconds} seconds remaining`}
            >
              {formatTime(remainingSeconds)}
            </time>
            <span className="hud-divider" aria-hidden="true" />
            <span
              className="hud-value hud-score-value"
              data-testid="score-value"
              key={acceptedEvents.length}
              aria-label={`${acceptedEvents.length} of ${category.answers.length} answers accepted`}
            >
              <span>{String(acceptedEvents.length).padStart(2, "0")}</span>
              <span className="hud-score-total" aria-hidden="true">/{category.answers.length}</span>
            </span>
            {personalBest > 0 || hasPassedBest ? (
              <span
                className={`local-best-marker${hasPassedBest ? " is-passed" : ""}`}
                data-testid="local-best-marker"
              >
                <span aria-hidden="true">★</span>
                {hasPassedBest ? "New best" : `Best ${displayedBest}`}
              </span>
            ) : null}
          </div>
          <button
            className="sound-toggle"
            type="button"
            aria-label={`Sound and haptics ${isFeedbackEnabled ? "on" : "off"}`}
            aria-pressed={isFeedbackEnabled}
            onClick={toggleFeedback}
          >
            <SoundIcon isEnabled={isFeedbackEnabled} />
          </button>
        </div>
      </header>

      {phase === "ready" ? (
        <div className="ready-state">
          <div className="ready-copy">
            <h1 id="game-prompt">{category.prompt}</h1>
            <p>{category.timeLimitSeconds} seconds. Names count the moment they match.</p>
          </div>

          <button
            className={`ready-zone ripple-surface${isReadyIntentActive ? " is-activating" : ""}`}
            type="button"
            aria-describedby="ready-instructions"
            onPointerEnter={handleReadyPointerEnter}
            onPointerLeave={cancelReadyIntent}
            onPointerDown={handleReadyPointerDown}
            onPointerUp={cancelReadyIntent}
            onPointerCancel={cancelReadyIntent}
            onPointerMove={handleRipplePointerMove}
            onMouseEnter={beginReadyIntent}
            onMouseLeave={cancelReadyIntent}
            onFocus={beginReadyIntent}
            onBlur={cancelReadyIntent}
            onKeyDown={handleReadyKeyDown}
          >
            <LiquidRipple />
            <span className="ready-ring" aria-hidden="true">
              <svg viewBox="0 0 120 120">
                <circle className="ready-ring-track" cx="60" cy="60" r="53" />
                <circle className="ready-ring-progress" cx="60" cy="60" r="53" />
              </svg>
              <span className="ready-dot" />
            </span>
            <strong>Move here when you’re ready</strong>
            <span id="ready-instructions">Focus or press and hold also works.</span>
          </button>
        </div>
      ) : phase === "finished" ? (
        <GameResults
          category={category}
          stats={practiceStats}
          personalBest={displayedBest}
          isNewPersonalBest={isNewPersonalBest}
          shareStatus={shareStatus}
          onPlayAgain={startRound}
          onShare={() => void shareResult()}
        />
      ) : (
        <div className="play-surface">
          <div className="prompt-block">
            <h1 id="game-prompt">{category.prompt}</h1>
          </div>

          <section
            ref={noteBoardRef}
            className={`note-board ripple-surface${milestoneScore ? " is-milestone" : ""}${quickPairNotice ? " is-quick-pair" : ""}`}
            aria-label="Answer writing board"
            onClick={() => inputRef.current?.focus()}
            onPointerMove={handleRipplePointerMove}
          >
            {freshAcceptedAnswer ? (
              <span
                className="team-color-flash"
                key={freshAcceptedAnswer.id}
                style={getAnswerAccentStyle(freshAcceptedAnswer)}
                aria-hidden="true"
              />
            ) : null}
            {quickPairNotice ? (
              <>
                <span
                  className="quick-pair-ripple"
                  key={`ripple-${quickPairNotice.id}`}
                  aria-hidden="true"
                />
                <div
                  className="quick-pair-banner"
                  data-testid="quick-pair-banner"
                  key={`banner-${quickPairNotice.id}`}
                  aria-live="polite"
                  aria-atomic="true"
                >
                  <span className="quick-pair-glyph" aria-hidden="true">
                    2
                  </span>
                  <span>
                    <small>Quick pair</small>
                    <strong>{quickPairNotice.message}</strong>
                  </span>
                </div>
              </>
            ) : null}
            <LiquidRipple />
            {milestoneScore ? (
              <span className="milestone-wave-label" aria-hidden="true">
                {milestoneScore} names
              </span>
            ) : null}
            <h2 className="sr-only">Your answers</h2>

            {acceptedAnswers.length > 0 ? (
              <ol className="answers-list">
                {acceptedAnswers.map((answer) => (
                  <li
                    className={`${answer.id === freshAnswerId ? "is-fresh" : ""}${answer.id === highlightedDuplicateId ? " is-duplicate-target" : ""}`.trim()}
                    data-answer-id={answer.id}
                    data-team-code={answer.teamCode}
                    data-group-ids={answer.groupIds?.join(" ")}
                    data-testid={`answer-row-${answer.id}`}
                    key={answer.id}
                    style={getAnswerAccentStyle(answer)}
                  >
                    <AcceptedIcon />
                    <strong>{answer.canonicalText}</strong>
                    {answer.visual ? (
                      <AnswerIconSlot accessibleLabel={answer.visual.accessibleLabel}>
                        {answer.visual.label}
                      </AnswerIconSlot>
                    ) : null}
                  </li>
                ))}
              </ol>
            ) : null}

            {phase === "playing" ? (
              <form className="note-entry" onSubmit={handleSubmit}>
                <label className="sr-only" htmlFor="answer-input">
                  {category.inputLabel}
                </label>
                <p className="sr-only" id="practice-answer-guidance">
                  Answers are checked automatically. Accepted, duplicate, and invalid results are announced below.
                </p>
                <input
                  ref={inputRef}
                  id="answer-input"
                  name="answer"
                  type="text"
                  value={inputValue}
                  onChange={handleInputChange}
                  onCompositionStart={() => {
                    isComposingRef.current = true;
                  }}
                  onCompositionEnd={handleCompositionEnd}
                  placeholder={category.inputPlaceholder}
                  autoComplete="off"
                  autoCapitalize="words"
                  spellCheck="false"
                  maxLength={80}
                  aria-describedby="practice-answer-guidance practice-answer-feedback"
                  aria-invalid={feedback?.kind === "invalid"}
                />
                {freshAcceptedAnswer ? (
                  <span
                    className="entry-success"
                    key={freshAcceptedAnswer.id}
                    style={getAnswerAccentStyle(freshAcceptedAnswer)}
                    aria-hidden="true"
                  >
                    <AcceptedIcon />
                  </span>
                ) : null}
              </form>
            ) : (
              <div className="ink-freeze" aria-hidden="true">
                <span />
              </div>
            )}
          </section>

          <div
            id="practice-answer-feedback"
            className={`feedback${feedback ? ` is-${feedback.kind}` : ""}`}
            role="status"
            aria-live="polite"
            aria-atomic="true"
            aria-relevant="text"
          >
            {feedback?.kind === "accepted" ? <AcceptedIcon /> : null}
            <span>
              {feedback?.message ??
                (phase === "playing"
                  ? "Matches count automatically."
                  : "Finishing your board…")}
            </span>
          </div>
        </div>
      )}

      <footer className="board-footer">
        <span>
          {phase === "finished" ? "Local practice · not ranked" : category.sourceLabel}
        </span>
        {phase === "playing" ? (
          <button type="button" onClick={finishRound}>
            End round
          </button>
        ) : phase === "finished" ? (
          <span>{category.sourceLabel}</span>
        ) : null}
      </footer>
    </section>
  );
}
