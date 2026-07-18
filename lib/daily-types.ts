import type { NbaTeamCode } from "@/lib/category-types";

export type DailyAttemptStatus = "active" | "completed" | "expired";

export type DailyCategoryMetadata = {
  slug: string;
  version: number;
  snapshotDate: string;
  title: string;
  prompt: string;
  timeLimitSeconds: number;
};

export type DailyChallenge = {
  id: string;
  date: string;
  resetAt: string;
  category: DailyCategoryMetadata;
};

export type DailyAcceptedAnswer = {
  id: string;
  canonicalText: string;
  teamCode: NbaTeamCode;
  acceptedAt: string;
};

export type DailyAttempt = {
  id: string;
  displayName: string | null;
  status: DailyAttemptStatus;
  startedAt: string;
  deadlineAt: string;
  completedAt: string | null;
  score: number;
  answers: readonly DailyAcceptedAnswer[];
};

export type DailyStatusPayload = {
  serverNow: string;
  challenge: DailyChallenge | null;
  attempt: DailyAttempt | null;
};

export type DailySubmissionResult =
  | {
      status: "accepted" | "duplicate";
      serverNow: string;
      score: number;
      answer: DailyAcceptedAnswer;
    }
  | { status: "invalid"; serverNow: string }
  | { status: "rate-limited"; serverNow: string }
  | {
      status: "round-ended";
      serverNow: string;
      attempt: DailyAttempt;
    };

export type DailyFinishPayload = {
  serverNow: string;
  attempt: DailyAttempt;
};

export type DailyLeaderboardEntry = {
  rank: number;
  displayName: string;
  score: number;
  isTied: boolean;
};

export type DailyLeaderboardPayload = {
  serverNow: string;
  challenge: {
    date: string;
    category: { slug: string; version: number };
  } | null;
  entries: readonly DailyLeaderboardEntry[];
};

export type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

export type DailyGameApi = {
  getStatus(): Promise<DailyStatusPayload>;
  start(displayName: string): Promise<DailyStatusPayload>;
  submit(attemptId: string, answer: string): Promise<DailySubmissionResult>;
  finish(attemptId: string): Promise<DailyFinishPayload>;
  getLeaderboard(): Promise<DailyLeaderboardPayload>;
};
