import { parseApiResponse } from "@/lib/daily-contract";
import {
  parseRoomGamePayload,
  parseRoomPayload,
  parseRoomSubmissionResult,
} from "@/lib/room-contract";
import type { RoomApi } from "@/lib/room-types";

async function request<T>(path: string, init: RequestInit, parser: (value: unknown) => T) {
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
    cache: "no-store",
  });
  const payload = parseApiResponse(await response.json(), parser);
  if (!payload.ok) throw new Error(payload.error.message);
  return payload.data;
}

export const roomApi: RoomApi = {
  create(displayName, mode) {
    return request("/api/rooms", { method: "POST", body: JSON.stringify({ displayName, mode }) }, parseRoomPayload);
  },
  getStatus(roomCode) {
    return request(`/api/rooms/${encodeURIComponent(roomCode)}`, { method: "GET" }, parseRoomPayload);
  },
  join(roomCode, displayName) {
    return request(`/api/rooms/${encodeURIComponent(roomCode)}/join`, {
      method: "POST",
      body: JSON.stringify({ displayName }),
    }, parseRoomPayload);
  },
  start(roomCode) {
    return request(`/api/rooms/${encodeURIComponent(roomCode)}/start`, { method: "POST" }, parseRoomPayload);
  },
  getGame(roomCode) {
    return request(`/api/rooms/${encodeURIComponent(roomCode)}/game`, { method: "GET" }, parseRoomGamePayload);
  },
  submit(roomCode, answer) {
    return request(`/api/rooms/${encodeURIComponent(roomCode)}/submit-answer`, {
      method: "POST",
      body: JSON.stringify({ answer }),
    }, parseRoomSubmissionResult);
  },
};
