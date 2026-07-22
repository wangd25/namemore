import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DailyGameBoard } from "@/components/DailyGameBoard";
import type {
  DailyAcceptedAnswer,
  DailyAttempt,
  DailyChallenge,
  DailyGameApi,
  DailyStatusPayload,
  DailySubmissionResult,
} from "@/lib/daily-types";

const challenge: DailyChallenge = {
  id: "22222222-2222-4222-8222-222222222222",
  date: "2099-07-17",
  resetAt: "2099-07-18T00:00:00.000Z",
  category: {
    slug: "current-nba-players",
    version: 1,
    snapshotDate: "2026-07-15",
    title: "Current NBA players",
    prompt: "How many NBA players can you name?",
    timeLimitSeconds: 90,
  },
};
const curry: DailyAcceptedAnswer = {
  id: "nba-stephen-curry",
  canonicalText: "Stephen Curry",
  teamCode: "GSW",
  acceptedAt: "2099-07-17T12:00:10.000Z",
};
const activeAttempt: DailyAttempt = {
  id: "11111111-1111-4111-8111-111111111111",
  displayName: "Daily Player",
  rankedEligible: false,
  status: "active",
  startedAt: "2099-07-17T12:00:00.000Z",
  deadlineAt: "2099-07-17T12:01:30.000Z",
  completedAt: null,
  score: 0,
  answers: [],
};
const readyStatus: DailyStatusPayload = {
  serverNow: "2099-07-17T12:00:00.000Z",
  challenge,
  attempt: null,
};
const activeStatus: DailyStatusPayload = { ...readyStatus, attempt: activeAttempt };

function mockApi(overrides: Partial<DailyGameApi> = {}): DailyGameApi {
  return {
    getStatus: vi.fn().mockResolvedValue(readyStatus),
    start: vi.fn().mockResolvedValue(activeStatus),
    submit: vi.fn().mockResolvedValue({ status: "invalid", serverNow: readyStatus.serverNow }),
    finish: vi.fn().mockResolvedValue({
      serverNow: "2099-07-17T12:00:30.000Z",
      attempt: { ...activeAttempt, status: "completed", completedAt: "2099-07-17T12:00:30.000Z" },
    }),
    getLeaderboard: vi.fn().mockResolvedValue({
      serverNow: "2099-07-17T12:00:30.000Z",
      challenge: {
        date: challenge.date,
        category: { slug: challenge.category.slug, version: challenge.category.version },
      },
      entries: [{ rank: 1, displayName: "Daily Player", score: 1, isTied: false }],
    }),
    ...overrides,
  };
}

async function enterDisplayName(name = "Daily Player") {
  const input = await screen.findByLabelText("Display name");
  fireEvent.change(input, { target: { value: name } });
  fireEvent.submit(input.closest("form")!);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => { resolve = nextResolve; });
  return { promise, resolve };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  window.localStorage.clear();
});

describe("DailyGameBoard", () => {
  it("loads metadata, starts exactly one server-owned attempt, and reveals answers only after acceptance", async () => {
    const pending = deferred<DailySubmissionResult>();
    const submit = vi.fn().mockReturnValue(pending.promise);
    const api = mockApi({ submit });
    render(<DailyGameBoard api={api} />);

    await enterDisplayName();
    const readyButton = await screen.findByRole("button", { name: /Move here when you’re ready/ });
    fireEvent.keyDown(readyButton, { key: "Enter" });
    const input = await screen.findByLabelText("Type an NBA player’s name");
    expect(input).toHaveAttribute(
      "aria-describedby",
      "daily-answer-guidance daily-answer-feedback",
    );
    expect(input).toHaveAttribute("aria-invalid", "false");
    expect(screen.getByTestId("timer-value")).toHaveAccessibleName(
      "90 seconds remaining",
    );
    expect(screen.getByTestId("score-value")).toHaveAccessibleName(
      "0 accepted answers",
    );
    expect(api.start).toHaveBeenCalledTimes(1);
    expect(api.start).toHaveBeenCalledWith("Daily Player");

    fireEvent.change(input, { target: { value: "Curry" } });
    fireEvent.submit(input.closest("form")!);
    expect(submit).toHaveBeenCalledWith(activeAttempt.id, "Curry");
    expect(screen.queryByText("Stephen Curry")).toBeNull();

    pending.resolve({
      status: "accepted",
      serverNow: "2099-07-17T12:00:10.000Z",
      score: 1,
      answer: curry,
    });
    expect(await screen.findByText("Stephen Curry")).toBeInTheDocument();
    expect(screen.getByTestId("score-value")).toHaveTextContent("01");
    expect(screen.getByTestId("score-value")).toHaveAccessibleName(
      "1 accepted answer",
    );
  });

  it("keeps the spring launch visible while the verified round opens", async () => {
    const pendingStart = deferred<DailyStatusPayload>();
    const api = mockApi({ start: vi.fn().mockReturnValue(pendingStart.promise) });
    render(<DailyGameBoard api={api} />);

    await enterDisplayName();
    fireEvent.keyDown(await screen.findByRole("button", { name: /Move here when you’re ready/ }), { key: "Enter" });

    const launchButton = screen.getByRole("button", { name: /Go!/ });
    expect(launchButton).toHaveClass("is-launching");
    expect(launchButton).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Opening your verified board…")).toBeInTheDocument();

    pendingStart.resolve(activeStatus);
    expect(await screen.findByLabelText("Type an NBA player’s name")).toBeInTheDocument();
  });

  it("starts secure automatic checking after a short 180ms pause and exposes pending state", async () => {
    vi.useFakeTimers();
    const pending = deferred<DailySubmissionResult>();
    const submit = vi.fn().mockReturnValue(pending.promise);
    const api = mockApi({ getStatus: vi.fn().mockResolvedValue(activeStatus), submit });
    render(<DailyGameBoard api={api} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    const input = screen.getByLabelText("Type an NBA player’s name");
    fireEvent.change(input, { target: { value: "Curry" } });
    await act(async () => { await vi.advanceTimersByTimeAsync(179); });
    expect(submit).not.toHaveBeenCalled();

    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(submit).toHaveBeenCalledWith(activeAttempt.id, "Curry");
    expect(input.closest("form")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Checking securely…")).toBeInTheDocument();

    pending.resolve({ status: "invalid", serverNow: readyStatus.serverNow });
    await act(async () => { await pending.promise; });
    expect(input.closest("form")).toHaveAttribute("aria-busy", "false");
  });

  it("resumes the existing server attempt without creating another", async () => {
    const api = mockApi({
      getStatus: vi.fn().mockResolvedValue({
        ...activeStatus,
        attempt: { ...activeAttempt, score: 1, answers: [curry] },
      }),
    });
    render(<DailyGameBoard api={api} />);

    expect(await screen.findByText("Stephen Curry")).toBeInTheDocument();
    expect(screen.getByLabelText("Type an NBA player’s name")).toBeInTheDocument();
    expect(api.start).not.toHaveBeenCalled();
  });

  it("keeps duplicate scoring authoritative and reports the existing answer", async () => {
    const duplicate = vi.fn().mockResolvedValue({
      status: "duplicate",
      serverNow: "2099-07-17T12:00:20.000Z",
      score: 1,
      answer: curry,
    });
    const api = mockApi({
      getStatus: vi.fn().mockResolvedValue({ ...activeStatus, attempt: { ...activeAttempt, score: 1, answers: [curry] } }),
      submit: duplicate,
    });
    render(<DailyGameBoard api={api} />);

    const input = await screen.findByLabelText("Type an NBA player’s name");
    fireEvent.change(input, { target: { value: "Curry" } });
    fireEvent.submit(input.closest("form")!);

    expect(await screen.findByText("Stephen Curry is already on your board")).toBeInTheDocument();
    expect(screen.getByTestId("score-value")).toHaveTextContent("01");
  });

  it("marks rejected input and announces answer-check failures urgently", async () => {
    const api = mockApi({
      getStatus: vi.fn().mockResolvedValue(activeStatus),
      submit: vi.fn().mockRejectedValue(new Error("offline")),
    });
    render(<DailyGameBoard api={api} />);

    const input = await screen.findByLabelText("Type an NBA player’s name");
    fireEvent.change(input, { target: { value: "Curry" } });
    fireEvent.submit(input.closest("form")!);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Your verified score is safe");
    expect(alert).toHaveAttribute("aria-live", "assertive");
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("finishes through the server and clearly labels anonymous play as unranked", async () => {
    const completed = {
      ...activeAttempt,
      status: "completed" as const,
      completedAt: "2099-07-17T12:00:30.000Z",
      score: 1,
      answers: [curry],
    };
    const finish = vi.fn().mockResolvedValue({ serverNow: completed.completedAt, attempt: completed });
    const api = mockApi({ getStatus: vi.fn().mockResolvedValue(activeStatus), finish });
    render(<DailyGameBoard api={api} />);

    fireEvent.click(await screen.findByRole("button", { name: "End round" }));
    expect(await screen.findByText("Verified practice result · not ranked")).toBeInTheDocument();
    expect(finish).toHaveBeenCalledWith(activeAttempt.id);
    expect(await screen.findByRole("heading", { name: "Today’s top ten" })).toBeInTheDocument();
    expect(await screen.findByText("Daily Player")).toBeInTheDocument();
  });

  it("presents server-approved durable attempts as ranked", async () => {
    const completed = {
      ...activeAttempt,
      rankedEligible: true,
      status: "completed" as const,
      completedAt: "2099-07-17T12:00:30.000Z",
    };
    const api = mockApi({
      getStatus: vi.fn().mockResolvedValue({ ...activeStatus, attempt: completed }),
    });
    render(<DailyGameBoard api={api} />);

    expect(await screen.findByText("Verified ranked result")).toBeInTheDocument();
  });

  it("validates and normalizes a public display name before the attempt starts", async () => {
    const api = mockApi();
    render(<DailyGameBoard api={api} />);

    await enterDisplayName("<script>alert(1)</script>");
    expect(await screen.findByRole("alert")).toHaveTextContent("Use 2–24 letters or numbers");
    expect(screen.queryByText("<script>alert(1)</script>")).toBeNull();

    await enterDisplayName("  Daily   Player  ");
    fireEvent.keyDown(await screen.findByRole("button", { name: /Move here when you’re ready/ }), { key: "Enter" });
    await waitFor(() => expect(api.start).toHaveBeenCalledWith("Daily Player"));
  });

  it("automatically retries one transient empty daily response", async () => {
    vi.useFakeTimers();
    const emptyStatus = { serverNow: readyStatus.serverNow, challenge: null, attempt: null };
    const getStatus = vi.fn().mockResolvedValueOnce(emptyStatus).mockResolvedValueOnce(readyStatus);
    const api = mockApi({ getStatus });
    render(<DailyGameBoard api={api} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    expect(screen.getByRole("heading", { name: "Double-checking today’s challenge…" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Checking again/ })).toBeDisabled();

    await act(async () => { await vi.advanceTimersByTimeAsync(900); });
    expect(getStatus).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("heading", { name: "Choose your daily display name" })).toBeInTheDocument();
  });

  it("offers a manual retry when the confirmed UTC schedule is still empty", async () => {
    vi.useFakeTimers();
    const api = mockApi({ getStatus: vi.fn().mockResolvedValue({ serverNow: readyStatus.serverNow, challenge: null, attempt: null }) });
    render(<DailyGameBoard api={api} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    await act(async () => { await vi.advanceTimersByTimeAsync(900); });

    expect(screen.getByRole("heading", { name: "Today’s challenge isn’t available yet." })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Retry/ }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(api.getStatus).toHaveBeenCalledTimes(3);
  });
});
