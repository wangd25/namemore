import { normalizeDisplayName } from "@/lib/display-name";
import { nbaTeamCodes } from "@/lib/category-types";
import type {
  RoomAcceptedAnswer,
  Room,
  RoomGame,
  RoomGamePayload,
  RoomGamePlayer,
  RoomMembership,
  RoomMode,
  RoomParticipant,
  RoomPayload,
  RoomStatus,
  RoomSubmissionResult,
} from "@/lib/room-types";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const roomCodePattern = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/;
const statuses = new Set<RoomStatus>(["waiting", "active", "completed", "cancelled"]);
const modes = new Set<RoomMode>(["private-race"]);
const teamCodes = new Set<string>(nbaTeamCodes);
const controlCharacters = /[\u0000-\u001f\u007f]/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) throw new Error(`Invalid ${key}.`);
  return value;
}

function readUuid(record: Record<string, unknown>, key: string): string {
  const value = readString(record, key);
  if (!uuidPattern.test(value)) throw new Error(`Invalid ${key}.`);
  return value;
}

function readNullableString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (value === null) return null;
  if (typeof value !== "string" || value.length === 0) throw new Error(`Invalid ${key}.`);
  return value;
}

function readInteger(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new Error(`Invalid ${key}.`);
  return value as number;
}

function readBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];
  if (typeof value !== "boolean") throw new Error(`Invalid ${key}.`);
  return value;
}

export function normalizeRoomCode(value: string): string | null {
  const normalized = value.trim().toUpperCase();
  return roomCodePattern.test(normalized) ? normalized : null;
}

function parseParticipant(value: unknown): RoomParticipant {
  if (!isRecord(value)) throw new Error("Invalid room participant.");
  const displayName = readString(value, "displayName");
  if (normalizeDisplayName(displayName) !== displayName) throw new Error("Invalid displayName.");
  return {
    id: readUuid(value, "id"),
    displayName,
    isHost: readBoolean(value, "isHost"),
    joinedAt: readString(value, "joinedAt"),
    connected: readBoolean(value, "connected"),
  };
}

function parseMembership(value: unknown): RoomMembership | null {
  if (value === null) return null;
  if (!isRecord(value)) throw new Error("Invalid room membership.");
  const displayName = readString(value, "displayName");
  if (normalizeDisplayName(displayName) !== displayName) throw new Error("Invalid displayName.");
  return {
    playerId: readUuid(value, "playerId"),
    displayName,
    isHost: readBoolean(value, "isHost"),
  };
}

function parseRoom(value: unknown): Room {
  if (!isRecord(value) || !isRecord(value.category) || !Array.isArray(value.participants)) {
    throw new Error("Invalid room.");
  }
  const code = readString(value, "code");
  const status = readString(value, "status");
  const mode = readString(value, "mode");
  const capacity = readInteger(value, "capacity");
  const playerCount = readInteger(value, "playerCount");
  if (!roomCodePattern.test(code) || !statuses.has(status as RoomStatus) || !modes.has(mode as RoomMode)) {
    throw new Error("Invalid room state.");
  }
  if (capacity !== 8 || playerCount > capacity || value.participants.length > capacity) {
    throw new Error("Invalid room capacity.");
  }

  const participants = value.participants.map(parseParticipant);
  const membership = parseMembership(value.membership);
  if (membership === null && participants.length !== 0) throw new Error("Invalid room visibility.");
  if (membership && !participants.some((participant) => participant.id === membership.playerId)) {
    throw new Error("Invalid room membership.");
  }

  return {
    code,
    status: status as RoomStatus,
    mode: mode as RoomMode,
    capacity,
    playerCount,
    createdAt: readString(value, "createdAt"),
    startedAt: readNullableString(value, "startedAt"),
    deadlineAt: readNullableString(value, "deadlineAt"),
    endedAt: readNullableString(value, "endedAt"),
    category: {
      slug: readString(value.category, "slug"),
      version: readInteger(value.category, "version"),
      title: readString(value.category, "title"),
      prompt: readString(value.category, "prompt"),
      timeLimitSeconds: readInteger(value.category, "timeLimitSeconds"),
    },
    membership,
    participants,
  };
}

export function parseRoomPayload(value: unknown): RoomPayload {
  if (!isRecord(value)) throw new Error("Invalid room payload.");
  return { serverNow: readString(value, "serverNow"), room: parseRoom(value.room) };
}

function parseAcceptedAnswer(value: unknown): RoomAcceptedAnswer {
  if (!isRecord(value)) throw new Error("Invalid room answer.");
  const teamCode = readString(value, "teamCode");
  if (!teamCodes.has(teamCode)) throw new Error("Invalid teamCode.");
  return {
    id: readString(value, "id"),
    canonicalText: readString(value, "canonicalText"),
    teamCode: teamCode as RoomAcceptedAnswer["teamCode"],
    acceptedAt: readString(value, "acceptedAt"),
  };
}

function parseGamePlayer(value: unknown): RoomGamePlayer {
  if (!isRecord(value)) throw new Error("Invalid game player.");
  const displayName = readString(value, "displayName");
  if (normalizeDisplayName(displayName) !== displayName) throw new Error("Invalid displayName.");
  const answers = value.answers === null
    ? null
    : Array.isArray(value.answers)
      ? value.answers.map(parseAcceptedAnswer)
      : (() => { throw new Error("Invalid player answers."); })();
  return {
    id: readUuid(value, "id"),
    displayName,
    isHost: readBoolean(value, "isHost"),
    joinedAt: readString(value, "joinedAt"),
    connected: readBoolean(value, "connected"),
    score: readInteger(value, "score"),
    rank: readInteger(value, "rank"),
    isTied: readBoolean(value, "isTied"),
    answers,
  };
}

function parseRoomGame(value: unknown): RoomGame {
  if (!isRecord(value) || !isRecord(value.category) || !Array.isArray(value.players)) {
    throw new Error("Invalid room game.");
  }
  const code = readString(value, "code");
  const status = readString(value, "status");
  const mode = readString(value, "mode");
  const membership = parseMembership(value.membership);
  if (!roomCodePattern.test(code) || (status !== "active" && status !== "completed") || !modes.has(mode as RoomMode) || membership === null) {
    throw new Error("Invalid room game state.");
  }
  const players = value.players.map(parseGamePlayer);
  if (players.length < 1 || players.length > 8 || !players.some((player) => player.id === membership.playerId)) {
    throw new Error("Invalid game membership.");
  }
  players.forEach((player, index) => {
    if (player.rank !== index + 1 || player.score > 300) throw new Error("Invalid game ranking.");
    if (status === "completed" && player.answers === null) throw new Error("Invalid completed reveal.");
    if (status === "active" && player.id !== membership.playerId && player.answers !== null) {
      throw new Error("Invalid active answer visibility.");
    }
    if (player.answers !== null && player.answers.length !== player.score) {
      throw new Error("Invalid player score.");
    }
  });
  return {
    code,
    status,
    mode: mode as RoomMode,
    startedAt: readString(value, "startedAt"),
    deadlineAt: readString(value, "deadlineAt"),
    endedAt: readNullableString(value, "endedAt"),
    category: {
      slug: readString(value.category, "slug"),
      version: readInteger(value.category, "version"),
      title: readString(value.category, "title"),
      prompt: readString(value.category, "prompt"),
      timeLimitSeconds: readInteger(value.category, "timeLimitSeconds"),
    },
    membership,
    players,
  };
}

export function parseRoomGamePayload(value: unknown): RoomGamePayload {
  if (!isRecord(value)) throw new Error("Invalid room game payload.");
  return { serverNow: readString(value, "serverNow"), game: parseRoomGame(value.game) };
}

export function parseRoomSubmissionResult(value: unknown): RoomSubmissionResult {
  if (!isRecord(value)) throw new Error("Invalid room submission.");
  const status = readString(value, "status");
  const serverNow = readString(value, "serverNow");
  if (status === "invalid" || status === "rate-limited") return { status, serverNow };
  if (status === "round-ended") return { status, serverNow, game: parseRoomGame(value.game) };
  if (status === "accepted" || status === "duplicate") {
    return {
      status,
      serverNow,
      score: readInteger(value, "score"),
      answer: parseAcceptedAnswer(value.answer),
    };
  }
  throw new Error("Invalid room submission status.");
}

export function parseCreateRoomRequest(value: unknown): { displayName: string } | null {
  if (!isRecord(value) || typeof value.displayName !== "string") return null;
  const displayName = normalizeDisplayName(value.displayName);
  return displayName ? { displayName } : null;
}

export function parseJoinRoomRequest(value: unknown): { displayName: string } | null {
  return parseCreateRoomRequest(value);
}

export function parseRoomSubmitRequest(value: unknown): { answer: string } | null {
  if (!isRecord(value) || typeof value.answer !== "string") return null;
  const answer = value.answer.trim();
  if (answer.length < 1 || answer.length > 80 || controlCharacters.test(answer)) return null;
  return { answer };
}
