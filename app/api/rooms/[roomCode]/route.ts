import { normalizeRoomCode } from "@/lib/room-contract";
import { invalidRoomRequest, roomError, roomSuccess } from "@/lib/room-route";
import { getRoomStatus } from "@/lib/room-server";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ roomCode: string }> }) {
  const roomCode = normalizeRoomCode((await context.params).roomCode);
  if (!roomCode) return invalidRoomRequest();
  try {
    return roomSuccess(await getRoomStatus(roomCode));
  } catch (error) {
    return roomError(error);
  }
}
