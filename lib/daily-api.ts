import {
  parseApiResponse,
  parseDailyFinishPayload,
  parseDailyLeaderboardPayload,
  parseDailyStatusPayload,
  parseDailySubmissionResult,
} from "@/lib/daily-contract";
import type { ApiResponse, DailyGameApi } from "@/lib/daily-types";

async function request<T>(
  path: string,
  init: RequestInit,
  parseData: (value: unknown) => T,
): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
    cache: "no-store",
  });
  const payload = parseApiResponse(await response.json(), parseData);
  if (!payload.ok) {
    throw new Error(payload.error.message);
  }
  return payload.data;
}

export const dailyGameApi: DailyGameApi = {
  getStatus() {
    return request("/api/daily/status", { method: "GET" }, parseDailyStatusPayload);
  },
  start(displayName) {
    return request(
      "/api/daily/start",
      { method: "POST", body: JSON.stringify({ displayName }) },
      parseDailyStatusPayload,
    );
  },
  submit(attemptId, answer) {
    return request(
      "/api/daily/submit-answer",
      { method: "POST", body: JSON.stringify({ attemptId, answer }) },
      parseDailySubmissionResult,
    );
  },
  finish(attemptId) {
    return request(
      "/api/daily/finish",
      { method: "POST", body: JSON.stringify({ attemptId }) },
      parseDailyFinishPayload,
    );
  },
  getLeaderboard() {
    return request(
      "/api/daily/leaderboard",
      { method: "GET" },
      parseDailyLeaderboardPayload,
    );
  },
};

export type { ApiResponse };
