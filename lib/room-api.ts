import { parseApiResponse } from "@/lib/daily-contract";
import { parseRoomPayload } from "@/lib/room-contract";
import type { RoomApi } from "@/lib/room-types";

async function request(path: string, init: RequestInit) {
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
    cache: "no-store",
  });
  const payload = parseApiResponse(await response.json(), parseRoomPayload);
  if (!payload.ok) throw new Error(payload.error.message);
  return payload.data;
}

export const roomApi: RoomApi = {
  create(displayName) {
    return request("/api/rooms", { method: "POST", body: JSON.stringify({ displayName }) });
  },
  getStatus(roomCode) {
    return request(`/api/rooms/${encodeURIComponent(roomCode)}`, { method: "GET" });
  },
  join(roomCode, displayName) {
    return request(`/api/rooms/${encodeURIComponent(roomCode)}/join`, {
      method: "POST",
      body: JSON.stringify({ displayName }),
    });
  },
  start(roomCode) {
    return request(`/api/rooms/${encodeURIComponent(roomCode)}/start`, { method: "POST" });
  },
};
