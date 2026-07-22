import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GameBoard } from "@/components/GameBoard";
import { currentNbaPlayersCategory } from "@/lib/categories";
import { chemicalElementsCategory } from "@/lib/chemical-elements";
import {
  feedbackPreferenceStorageKey,
  getPracticeBestStorageKey,
} from "@/lib/practice-game";

const endingTransitionMilliseconds = 460;

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

function startRound() {
  fireEvent.keyDown(
    screen.getByRole("button", { name: /Move here when you’re ready/ }),
    { key: "Enter" },
  );
}

function typeAnswer(answer: string) {
  const input = screen.getByLabelText("Type an NBA player’s name");
  fireEvent.change(input, {
    target: { value: answer },
  });
}

function submitUnmatchedAnswer(answer: string) {
  const input = screen.getByLabelText("Type an NBA player’s name");
  const form = input.closest("form");

  if (!form) {
    throw new Error("Expected the answer input to be inside a form.");
  }

  typeAnswer(answer);
  fireEvent.submit(form);
}

function finishTransition() {
  act(() => {
    vi.advanceTimersByTime(endingTransitionMilliseconds);
  });
}

describe("GameBoard", () => {
  it("plays and summarizes a reviewed category without NBA metadata", () => {
    vi.useFakeTimers();
    render(<GameBoard category={chemicalElementsCategory} />);

    expect(
      screen.getByRole("heading", {
        name: "How many chemical elements can you name?",
      }),
    ).toBeInTheDocument();
    startRound();

    const input = screen.getByLabelText("Type a chemical element");
    expect(input).toHaveAttribute("placeholder", "Type an element name or symbol…");
    fireEvent.change(input, { target: { value: "Na" } });

    expect(screen.getByText("Sodium")).toBeInTheDocument();
    expect(screen.getByLabelText("Na, Sodium element symbol")).toHaveTextContent("Na");
    expect(screen.queryByText("Team coverage")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "End round" }));
    finishTransition();

    expect(screen.getByText("Period coverage")).toBeInTheDocument();
    expect(screen.getByText("1", { selector: ".result-metrics dd span" })).toBeInTheDocument();
    expect(screen.getByText("IUPAC periodic table · May 4, 2022")).toBeInTheDocument();
  });

  it("starts in the ready state and begins a focused round", () => {
    render(<GameBoard category={currentNbaPlayersCategory} />);

    expect(
      screen.getByRole("heading", {
        name: "How many NBA players can you name?",
      }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("timer-value")).toHaveTextContent("01:30");
    expect(screen.queryByRole("button", { name: "Start round" })).toBeNull();

    startRound();

    const input = screen.getByLabelText("Type an NBA player’s name");
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute(
      "aria-describedby",
      "practice-answer-guidance practice-answer-feedback",
    );
    expect(input).toHaveAttribute("aria-invalid", "false");
    expect(screen.getByTestId("timer-value")).toHaveAccessibleName(
      "90 seconds remaining",
    );
    expect(screen.getByTestId("score-value")).toHaveAccessibleName(
      "0 accepted answers",
    );
    expect(screen.queryByRole("button", { name: "Submit" })).toBeNull();
  });

  it("starts automatically after the ready-zone hover dwell", () => {
    vi.useFakeTimers();
    render(<GameBoard category={currentNbaPlayersCategory} />);

    fireEvent.mouseEnter(
      screen.getByRole("button", { name: /Move here when you’re ready/ }),
    );

    act(() => {
      vi.advanceTimersByTime(899);
    });
    expect(
      screen.queryByLabelText("Type an NBA player’s name"),
    ).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByLabelText("Type an NBA player’s name")).toHaveFocus();
  });

  it("treats the notes board as the focus and ripple surface", () => {
    render(<GameBoard category={currentNbaPlayersCategory} />);
    startRound();

    const input = screen.getByLabelText("Type an NBA player’s name");
    const board = screen.getByRole("region", { name: "Answer writing board" });

    input.blur();
    fireEvent.click(board);
    expect(input).toHaveFocus();

    fireEvent.pointerMove(board, {
      clientX: 48,
      clientY: 72,
      pointerType: "mouse",
    });
    expect(board.style.getPropertyValue("--ripple-x")).toBe("48px");
    expect(board.style.getPropertyValue("--ripple-y")).toBe("72px");
  });

  it("adds a restrained blur response without moving typed text", () => {
    render(<GameBoard category={currentNbaPlayersCategory} />);
    startRound();

    const input = screen.getByLabelText("Type an NBA player’s name");
    const cancel = vi.fn();
    const animate = vi.fn(
      (
        _keyframes: Keyframe[] | PropertyIndexedKeyframes,
        _options?: number | KeyframeAnimationOptions,
      ) => {
        void _keyframes;
        void _options;
        return { cancel };
      },
    );
    Object.defineProperty(input, "animate", {
      configurable: true,
      value: animate,
    });

    typeAnswer("S");
    typeAnswer("St");

    expect(animate).toHaveBeenCalledTimes(2);
    expect(cancel).toHaveBeenCalledOnce();
    expect(animate.mock.calls[0]?.[0]).toEqual([
      { filter: "blur(0.35px)", opacity: 0.9 },
      { filter: "blur(0)", opacity: 1 },
    ]);
    expect(input).toHaveValue("St");
  });

  it("accepts unique last names and explains the rule on the board", () => {
    vi.useFakeTimers();
    render(<GameBoard category={currentNbaPlayersCategory} />);
    startRound();

    expect(
      screen.getByPlaceholderText("Type a full name or unique last name…"),
    ).toBeInTheDocument();

    typeAnswer("James");
    act(() => {
      vi.advanceTimersByTime(420);
    });

    expect(screen.getByRole("status")).toHaveTextContent("LeBron James added");
    expect(screen.getByTestId("answer-row-nba-lebron-james")).toBeInTheDocument();
  });

  it("lets longer names pass a short alias prefix and delays a lone alias", () => {
    vi.useFakeTimers();
    render(<GameBoard category={currentNbaPlayersCategory} />);
    startRound();

    typeAnswer("Ja");
    expect(screen.getByLabelText("Type an NBA player’s name")).toHaveValue("Ja");
    expect(screen.getByTestId("score-value")).toHaveTextContent("00");

    typeAnswer("Jalen Green");
    expect(screen.getByRole("status")).toHaveTextContent("Jalen Green added");
    expect(screen.getByTestId("answer-row-nba-jalen-green")).toBeInTheDocument();
    expect(screen.queryByTestId("answer-row-nba-ja-morant")).toBeNull();

    typeAnswer("Ja");
    act(() => {
      vi.advanceTimersByTime(419);
    });
    expect(screen.getByLabelText("Type an NBA player’s name")).toHaveValue("Ja");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByTestId("answer-row-nba-ja-morant")).toBeInTheDocument();
    expect(screen.getByTestId("score-value")).toHaveTextContent("02");
  });

  it("settles accepted ink, locates duplicates, and reports unmatched answers", () => {
    vi.useFakeTimers();
    render(<GameBoard category={currentNbaPlayersCategory} />);
    startRound();

    typeAnswer("Steph");
    act(() => {
      vi.advanceTimersByTime(420);
    });
    expect(screen.getByRole("status")).toHaveTextContent("Stephen Curry added");
    expect(screen.getByTestId("score-value")).toHaveTextContent("01");
    expect(screen.getByTestId("answer-row-nba-stephen-curry")).toHaveClass(
      "is-fresh",
    );
    expect(screen.getByLabelText("Team GSW")).toHaveClass("answer-icon-slot");
    expect(screen.getByLabelText("Team GSW")).toHaveTextContent("GSW");
    expect(document.querySelector(".note-entry-marker")).toBeNull();
    expect(document.querySelector(".entry-success")).toBeInTheDocument();
    expect(document.querySelector(".team-color-flash")).toBeInTheDocument();
    expect(screen.getByLabelText("Type an NBA player’s name")).toHaveValue("");

    typeAnswer("Stephen Curry");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Stephen Curry is already on your board",
    );
    expect(screen.getByTestId("answer-row-nba-stephen-curry")).toHaveClass(
      "is-duplicate-target",
    );
    expect(screen.getByTestId("score-value")).toHaveTextContent("01");

    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(screen.getByTestId("answer-row-nba-stephen-curry")).not.toHaveClass(
      "is-duplicate-target",
    );

    submitUnmatchedAnswer("Michael Jordan");
    expect(screen.getByRole("status")).toHaveTextContent("No match yet");
    expect(screen.getByLabelText("Type an NBA player’s name")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("celebrates two fast answers with a liquid ripple and natural banner", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-17T12:00:00Z"));
    render(<GameBoard category={currentNbaPlayersCategory} />);
    startRound();

    typeAnswer("Stephen Curry");
    vi.setSystemTime(new Date("2026-07-17T12:00:01.420Z"));
    typeAnswer("Jayson Tatum");

    expect(screen.getByTestId("quick-pair-banner")).toHaveTextContent(
      "Two in 1.42s — damn.",
    );
    expect(document.querySelector(".quick-pair-ripple")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Answer writing board" })).toHaveClass(
      "is-quick-pair",
    );

    act(() => {
      vi.advanceTimersByTime(3_200);
    });

    expect(screen.queryByTestId("quick-pair-banner")).toBeNull();
    expect(document.querySelector(".quick-pair-ripple")).toBeNull();
  });

  it("creates a restrained milestone without changing score rules", () => {
    vi.useFakeTimers();
    render(<GameBoard category={currentNbaPlayersCategory} />);
    startRound();

    for (const answer of [
      "Stephen Curry",
      "Joker",
      "Luka Doncic",
      "Jayson Tatum",
      "Kevin Durant",
    ]) {
      typeAnswer(answer);
    }

    expect(screen.getByTestId("score-value")).toHaveTextContent("05");
    expect(screen.getByRole("status")).toHaveTextContent("5 names — hot run");
    expect(screen.getByText("5 names", { selector: ".milestone-wave-label" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Answer writing board" })).toHaveClass(
      "is-milestone",
    );

    act(() => {
      vi.advanceTimersByTime(1_100);
    });
    expect(screen.queryByText("5 names", { selector: ".milestone-wave-label" })).toBeNull();
  });

  it("freezes input at the absolute deadline before revealing results", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-16T12:00:00Z"));
    render(<GameBoard category={currentNbaPlayersCategory} />);
    startRound();
    typeAnswer("Curry");

    act(() => {
      vi.advanceTimersByTime(90_000);
    });

    expect(screen.getByTestId("timer-value")).toHaveTextContent("00:00");
    expect(
      screen.queryByLabelText("Type an NBA player’s name"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Time’s up — ink down.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Round complete/ })).toBeNull();

    finishTransition();

    expect(
      screen.getByRole("heading", { name: /Round complete/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("Stephen Curry")).toBeInTheDocument();
  });

  it("marks the timer and board as urgent below ten seconds", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-16T12:00:00Z"));
    render(<GameBoard category={currentNbaPlayersCategory} />);
    startRound();

    act(() => {
      vi.advanceTimersByTime(81_000);
    });

    expect(screen.getByTestId("timer-value")).toHaveTextContent("00:09");
    expect(screen.getByTestId("timer-value")).toHaveClass("is-urgent");
    expect(screen.getByTestId("timer-value").closest(".game-board")).toHaveClass(
      "is-urgent-round",
    );
  });

  it("stores a local personal best and labels it as practice data", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-16T12:00:00Z"));
    const bestKey = getPracticeBestStorageKey(currentNbaPlayersCategory);
    window.localStorage.setItem(bestKey, JSON.stringify({ version: 1, score: 1 }));
    render(<GameBoard category={currentNbaPlayersCategory} />);
    startRound();

    typeAnswer("Stephen Curry");
    typeAnswer("Joker");
    fireEvent.click(screen.getByRole("button", { name: "End round" }));
    finishTransition();

    expect(screen.getByText("New local best")).toBeInTheDocument();
    expect(screen.getByText("Local practice · not ranked")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(bestKey) ?? "{}")).toEqual({
      version: 1,
      score: 2,
    });
  });

  it("persists the optional sound and haptics preference without playing audio", async () => {
    window.localStorage.setItem(
      feedbackPreferenceStorageKey,
      JSON.stringify({ version: 1, enabled: false }),
    );
    render(<GameBoard category={currentNbaPlayersCategory} />);

    const toggle = await screen.findByRole("button", {
      name: "Sound and haptics off",
    });
    expect(toggle).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(toggle);

    expect(
      screen.getByRole("button", { name: "Sound and haptics on" }),
    ).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => {
      expect(
        JSON.parse(
          window.localStorage.getItem(feedbackPreferenceStorageKey) ?? "{}",
        ),
      ).toEqual({ version: 1, enabled: true });
    });
  });

  it("plays a slightly louder two-note glass chime for an accepted answer", () => {
    const setFrequency = vi.fn();
    const setGain = vi.fn();
    const rampGain = vi.fn();
    const start = vi.fn();
    const stop = vi.fn();
    const createOscillator = vi.fn(() => ({
      type: "sine",
      frequency: { setValueAtTime: setFrequency },
      connect: vi.fn(),
      start,
      stop,
    }));
    const createGain = vi.fn(() => ({
      gain: {
        setValueAtTime: setGain,
        exponentialRampToValueAtTime: rampGain,
      },
      connect: vi.fn(),
    }));
    const context = {
      currentTime: 10,
      destination: {},
      createOscillator,
      createGain,
      close: vi.fn().mockResolvedValue(undefined),
    };
    const AudioContextMock = vi.fn(function AudioContextMock() {
      return context;
    });
    vi.stubGlobal("AudioContext", AudioContextMock);

    render(<GameBoard category={currentNbaPlayersCategory} />);
    startRound();
    typeAnswer("Stephen Curry");

    expect(createOscillator).toHaveBeenCalledTimes(2);
    expect(setFrequency.mock.calls).toEqual([
      [520, 10],
      [760, 10.055],
    ]);
    expect(rampGain).toHaveBeenCalledWith(0.065, 10.012);
    expect(rampGain).toHaveBeenCalledWith(0.055, 10.067);
    expect(start.mock.calls).toEqual([[10], [10.055]]);
  });

  it("copies a spoiler-free result when Web Share is unavailable", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-16T12:00:00Z"));
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    render(<GameBoard category={currentNbaPlayersCategory} />);
    startRound();
    typeAnswer("Stephen Curry");
    fireEvent.click(screen.getByRole("button", { name: "End round" }));
    finishTransition();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Share result" }));
    });

    expect(writeText).toHaveBeenCalledOnce();
    expect(writeText.mock.calls[0]?.[0]).toContain("1 name · 1/30 NBA teams");
    expect(writeText.mock.calls[0]?.[0]).not.toContain("Stephen Curry");
    expect(screen.getByRole("status")).toHaveTextContent("Result copied");
  });

  it("resets round events, duplicates, sharing, and score on replay", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-16T12:00:00Z"));
    render(<GameBoard category={currentNbaPlayersCategory} />);
    startRound();
    typeAnswer("Joker");
    typeAnswer("Joker");

    fireEvent.click(screen.getByRole("button", { name: "End round" }));
    finishTransition();
    expect(screen.getByText("Nikola Jokić")).toBeInTheDocument();
    expect(screen.getByText("Duplicates").nextElementSibling).toHaveTextContent("1");

    fireEvent.click(screen.getByRole("button", { name: "Play again" }));

    expect(screen.getByTestId("score-value")).toHaveTextContent("00");
    expect(screen.getByLabelText("Type an NBA player’s name")).toHaveFocus();
    expect(screen.queryByText("Nikola Jokić")).toBeNull();
  });
});
