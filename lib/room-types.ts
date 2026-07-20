export type RoomStatus = "waiting" | "active" | "completed" | "cancelled";
export type RoomMode = "private-race";

export type RoomCategory = {
  slug: string;
  version: number;
  title: string;
  prompt: string;
  timeLimitSeconds: number;
};

export type RoomParticipant = {
  id: string;
  displayName: string;
  isHost: boolean;
  joinedAt: string;
  connected: boolean;
};

export type RoomMembership = {
  playerId: string;
  displayName: string;
  isHost: boolean;
};

export type Room = {
  code: string;
  status: RoomStatus;
  mode: RoomMode;
  capacity: number;
  playerCount: number;
  createdAt: string;
  startedAt: string | null;
  deadlineAt: string | null;
  endedAt: string | null;
  category: RoomCategory;
  membership: RoomMembership | null;
  participants: readonly RoomParticipant[];
};

export type RoomPayload = {
  serverNow: string;
  room: Room;
};

export type RoomAcceptedAnswer = {
  id: string;
  canonicalText: string;
  teamCode: NbaTeamCode;
  acceptedAt: string;
};

export type RoomGamePlayer = {
  id: string;
  displayName: string;
  isHost: boolean;
  joinedAt: string;
  connected: boolean;
  score: number;
  rank: number;
  isTied: boolean;
  answers: readonly RoomAcceptedAnswer[] | null;
};

export type RoomGame = {
  code: string;
  status: "active" | "completed";
  mode: RoomMode;
  startedAt: string;
  deadlineAt: string;
  endedAt: string | null;
  category: RoomCategory;
  membership: RoomMembership;
  players: readonly RoomGamePlayer[];
};

export type RoomGamePayload = {
  serverNow: string;
  game: RoomGame;
};

export type RoomSubmissionResult =
  | {
      status: "accepted" | "duplicate";
      serverNow: string;
      score: number;
      answer: RoomAcceptedAnswer;
    }
  | { status: "invalid"; serverNow: string }
  | { status: "rate-limited"; serverNow: string }
  | { status: "round-ended"; serverNow: string; game: RoomGame };

export type RoomApi = {
  create(displayName: string): Promise<RoomPayload>;
  getStatus(roomCode: string): Promise<RoomPayload>;
  join(roomCode: string, displayName: string): Promise<RoomPayload>;
  start(roomCode: string): Promise<RoomPayload>;
  getGame(roomCode: string): Promise<RoomGamePayload>;
  submit(roomCode: string, answer: string): Promise<RoomSubmissionResult>;
};
import type { NbaTeamCode } from "@/lib/category-types";
