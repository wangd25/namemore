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

export type RoomApi = {
  create(displayName: string): Promise<RoomPayload>;
  getStatus(roomCode: string): Promise<RoomPayload>;
  join(roomCode: string, displayName: string): Promise<RoomPayload>;
  start(roomCode: string): Promise<RoomPayload>;
};
