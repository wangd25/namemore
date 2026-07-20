import { normalizeRoomCode, parseRoomSubmitRequest } from "@/lib/room-contract";
import {
  invalidRoomRequest,
  readRoomJsonBody,
  roomError,
  roomSuccess,
} from "@/lib/room-route";
import { submitRoomAnswer } from "@/lib/room-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ roomCode: string }> }) {
  const roomCode = normalizeRoomCode((await context.params).roomCode);
  const input = parseRoomSubmitRequest(await readRoomJsonBody(request));
  if (!roomCode || !input) return invalidRoomRequest();
  try {
    return roomSuccess(await submitRoomAnswer(roomCode, input.answer));
  } catch (error) {
    return roomError(error);
  }
}
