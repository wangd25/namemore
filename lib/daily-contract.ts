import { nbaTeamCodes } from "@/lib/category-types";
import { normalizeDisplayName } from "@/lib/display-name";
import type {
  ApiResponse,
  DailyAcceptedAnswer,
  DailyAttempt,
  DailyAttemptStatus,
  DailyChallenge,
  DailyFinishPayload,
  DailyLeaderboardEntry,
  DailyLeaderboardPayload,
  DailyStatusPayload,
  DailySubmissionResult,
} from "@/lib/daily-types";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const controlCharacters = /[\u0000-\u001f\u007f]/;
const teamCodes = new Set<string>(nbaTeamCodes);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Invalid ${key}.`);
  }
  return value;
}

function readNullableString(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value = record[key];
  if (value === null) {
    return null;
  }
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Invalid ${key}.`);
  }
  return value;
}

function readInteger(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error(`Invalid ${key}.`);
  }
  return value as number;
}

function readBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];
  if (typeof value !== "boolean") {
    throw new Error(`Invalid ${key}.`);
  }
  return value;
}

export { normalizeDisplayName } from "@/lib/display-name";

function parseAcceptedAnswer(value: unknown): DailyAcceptedAnswer {
  if (!isRecord(value)) {
    throw new Error("Invalid accepted answer.");
  }
  const teamCode = readString(value, "teamCode");
  if (!teamCodes.has(teamCode)) {
    throw new Error("Invalid team code.");
  }
  return {
    id: readString(value, "id"),
    canonicalText: readString(value, "canonicalText"),
    teamCode: teamCode as DailyAcceptedAnswer["teamCode"],
    acceptedAt: readString(value, "acceptedAt"),
  };
}

export function parseDailyAttempt(value: unknown): DailyAttempt {
  if (!isRecord(value)) {
    throw new Error("Invalid daily attempt.");
  }
  const status = readString(value, "status");
  if (!(new Set<DailyAttemptStatus>(["active", "completed", "expired"]) as Set<string>).has(status)) {
    throw new Error("Invalid attempt status.");
  }
  if (!Array.isArray(value.answers)) {
    throw new Error("Invalid accepted answers.");
  }
  const displayName = readNullableString(value, "displayName");
  if (displayName !== null && normalizeDisplayName(displayName) !== displayName) {
    throw new Error("Invalid display name.");
  }
  return {
    id: readString(value, "id"),
    displayName,
    rankedEligible: readBoolean(value, "rankedEligible"),
    status: status as DailyAttemptStatus,
    startedAt: readString(value, "startedAt"),
    deadlineAt: readString(value, "deadlineAt"),
    completedAt: readNullableString(value, "completedAt"),
    score: readInteger(value, "score"),
    answers: value.answers.map(parseAcceptedAnswer),
  };
}

function parseDailyChallenge(value: unknown): DailyChallenge {
  if (!isRecord(value) || !isRecord(value.category)) {
    throw new Error("Invalid daily challenge.");
  }
  const category = value.category;
  return {
    id: readString(value, "id"),
    date: readString(value, "date"),
    resetAt: readString(value, "resetAt"),
    category: {
      slug: readString(category, "slug"),
      version: readInteger(category, "version"),
      snapshotDate: readString(category, "snapshotDate"),
      title: readString(category, "title"),
      prompt: readString(category, "prompt"),
      timeLimitSeconds: readInteger(category, "timeLimitSeconds"),
    },
  };
}

export function parseDailyStatusPayload(value: unknown): DailyStatusPayload {
  if (!isRecord(value)) {
    throw new Error("Invalid daily status.");
  }
  return {
    serverNow: readString(value, "serverNow"),
    challenge: value.challenge === null ? null : parseDailyChallenge(value.challenge),
    attempt: value.attempt === null ? null : parseDailyAttempt(value.attempt),
  };
}

export function parseDailySubmissionResult(value: unknown): DailySubmissionResult {
  if (!isRecord(value)) {
    throw new Error("Invalid submission result.");
  }
  const status = readString(value, "status");
  const serverNow = readString(value, "serverNow");
  if (status === "invalid" || status === "rate-limited") {
    return { status, serverNow };
  }
  if (status === "round-ended") {
    return { status, serverNow, attempt: parseDailyAttempt(value.attempt) };
  }
  if (status === "accepted" || status === "duplicate") {
    const answer = parseAcceptedAnswer(value.answer);
    if (status === "duplicate" && !answer.acceptedAt) {
      answer.acceptedAt = serverNow;
    }
    return { status, serverNow, score: readInteger(value, "score"), answer };
  }
  throw new Error("Invalid submission status.");
}

export function parseDailyFinishPayload(value: unknown): DailyFinishPayload {
  if (!isRecord(value)) {
    throw new Error("Invalid finish result.");
  }
  return {
    serverNow: readString(value, "serverNow"),
    attempt: parseDailyAttempt(value.attempt),
  };
}

function parseLeaderboardEntry(value: unknown): DailyLeaderboardEntry {
  if (!isRecord(value)) {
    throw new Error("Invalid leaderboard entry.");
  }
  const rank = readInteger(value, "rank");
  const displayName = readString(value, "displayName");
  if (rank < 1 || rank > 10 || normalizeDisplayName(displayName) !== displayName) {
    throw new Error("Invalid leaderboard entry.");
  }
  return {
    rank,
    displayName,
    score: readInteger(value, "score"),
    isTied: readBoolean(value, "isTied"),
  };
}

export function parseDailyLeaderboardPayload(value: unknown): DailyLeaderboardPayload {
  if (!isRecord(value) || !Array.isArray(value.entries) || value.entries.length > 10) {
    throw new Error("Invalid daily leaderboard.");
  }
  const entries = value.entries.map(parseLeaderboardEntry);
  entries.forEach((entry, index) => {
    if (entry.rank !== index + 1) {
      throw new Error("Invalid leaderboard rank.");
    }
  });

  let challenge: DailyLeaderboardPayload["challenge"] = null;
  if (value.challenge !== null) {
    if (!isRecord(value.challenge) || !isRecord(value.challenge.category)) {
      throw new Error("Invalid leaderboard challenge.");
    }
    challenge = {
      date: readString(value.challenge, "date"),
      category: {
        slug: readString(value.challenge.category, "slug"),
        version: readInteger(value.challenge.category, "version"),
      },
    };
  }

  return {
    serverNow: readString(value, "serverNow"),
    challenge,
    entries,
  };
}

export function parseApiResponse<T>(
  value: unknown,
  parseData: (data: unknown) => T,
): ApiResponse<T> {
  if (!isRecord(value) || typeof value.ok !== "boolean") {
    throw new Error("Invalid API response.");
  }
  if (value.ok) {
    return { ok: true, data: parseData(value.data) };
  }
  if (!isRecord(value.error)) {
    throw new Error("Invalid API error.");
  }
  return {
    ok: false,
    error: {
      code: readString(value.error, "code"),
      message: readString(value.error, "message"),
    },
  };
}

export function parseSubmitRequest(value: unknown): {
  attemptId: string;
  answer: string;
} | null {
  if (!isRecord(value) || typeof value.attemptId !== "string" || typeof value.answer !== "string") {
    return null;
  }
  const answer = value.answer.trim();
  if (!uuidPattern.test(value.attemptId) || answer.length < 1 || answer.length > 80 || controlCharacters.test(answer)) {
    return null;
  }
  return { attemptId: value.attemptId, answer };
}

export function parseStartRequest(value: unknown): { displayName: string } | null {
  if (!isRecord(value) || typeof value.displayName !== "string") {
    return null;
  }
  const displayName = normalizeDisplayName(value.displayName);
  return displayName ? { displayName } : null;
}

export function parseFinishRequest(value: unknown): { attemptId: string } | null {
  if (!isRecord(value) || typeof value.attemptId !== "string" || !uuidPattern.test(value.attemptId)) {
    return null;
  }
  return { attemptId: value.attemptId };
}
