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
  | {
      status: "round-ended";
      serverNow: string;
      attempt: DailyAttempt;
    };

export type DailyFinishPayload = {
  serverNow: string;
  attempt: DailyAttempt;
};

export type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

export type DailyGameApi = {
  getStatus(): Promise<DailyStatusPayload>;
  start(): Promise<DailyStatusPayload>;
  submit(attemptId: string, answer: string): Promise<DailySubmissionResult>;
  finish(attemptId: string): Promise<DailyFinishPayload>;
};
