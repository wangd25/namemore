import {
  parseRoomGamePayload,
  parseRoomPayload,
  parseRoomSubmissionResult,
} from "@/lib/room-contract";
import { normalizeAnswer } from "@/lib/normalize";
import type {
  RoomGamePayload,
  RoomMode,
  RoomPayload,
  RoomSubmissionResult,
} from "@/lib/room-types";
import {
  RoomServiceError,
  roomServiceErrorFromPayload,
  roomServiceErrorFromRpcCode,
} from "@/lib/room-error";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureAnonymousIdentity } from "@/lib/supabase/session";

export { RoomServiceError } from "@/lib/room-error";

async function callRpc(name: string, args?: Record<string, string>): Promise<unknown> {
  try {
    const supabase = await createSupabaseServerClient();
    await ensureAnonymousIdentity(supabase);
    const { data, error } = await supabase.rpc(name, args);
    if (error) {
      throw roomServiceErrorFromRpcCode(error.code);
    }
    const payloadError = roomServiceErrorFromPayload(data);
    if (payloadError) throw payloadError;
    return data;
  } catch (error) {
    if (error instanceof RoomServiceError) throw error;
    throw new RoomServiceError(
      "room-unavailable",
      "Private rooms are temporarily unavailable.",
      503,
    );
  }
}

function parseTrustedRoom(value: unknown): RoomPayload {
  try {
    return parseRoomPayload(value);
  } catch {
    throw new RoomServiceError(
      "invalid-room-response",
      "The private room returned an invalid response.",
      502,
    );
  }
}

export async function createRoom(displayName: string, mode: RoomMode): Promise<RoomPayload> {
  return parseTrustedRoom(await callRpc("room_create", {
    p_display_name: displayName,
    p_mode: mode,
  }));
}

export async function getRoomStatus(roomCode: string): Promise<RoomPayload> {
  return parseTrustedRoom(await callRpc("room_get_status", { p_room_code: roomCode }));
}

export async function joinRoom(roomCode: string, displayName: string): Promise<RoomPayload> {
  return parseTrustedRoom(await callRpc("room_join", {
    p_room_code: roomCode,
    p_display_name: displayName,
  }));
}

export async function startRoom(roomCode: string): Promise<RoomPayload> {
  return parseTrustedRoom(await callRpc("room_start", { p_room_code: roomCode }));
}

export async function getRoomGame(roomCode: string): Promise<RoomGamePayload> {
  try {
    return parseRoomGamePayload(await callRpc("room_get_game", { p_room_code: roomCode }));
  } catch (error) {
    if (error instanceof RoomServiceError) throw error;
    throw new RoomServiceError("invalid-room-response", "The live room returned an invalid response.", 502);
  }
}

export async function submitRoomAnswer(
  roomCode: string,
  rawAnswer: string,
): Promise<RoomSubmissionResult> {
  const normalizedAnswer = normalizeAnswer(rawAnswer);
  if (!normalizedAnswer || normalizedAnswer.length > 80) {
    return { status: "invalid", serverNow: new Date().toISOString() };
  }
  try {
    return parseRoomSubmissionResult(await callRpc("room_submit_answer", {
      p_room_code: roomCode,
      p_normalized_answer: normalizedAnswer,
    }));
  } catch (error) {
    if (error instanceof RoomServiceError) throw error;
    throw new RoomServiceError("invalid-room-response", "The room answer returned an invalid response.", 502);
  }
}
