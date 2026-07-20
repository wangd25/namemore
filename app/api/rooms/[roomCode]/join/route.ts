import { parseJoinRoomRequest, normalizeRoomCode } from "@/lib/room-contract";
import { readJsonBody } from "@/lib/daily-route";
import { invalidRoomRequest, roomError, roomSuccess } from "@/lib/room-route";
import { joinRoom } from "@/lib/room-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ roomCode: string }> }) {
  const roomCode = normalizeRoomCode((await context.params).roomCode);
  const input = parseJoinRoomRequest(await readJsonBody(request));
  if (!roomCode || !input) return invalidRoomRequest();
  try {
    return roomSuccess(await joinRoom(roomCode, input.displayName));
  } catch (error) {
    return roomError(error);
  }
}
