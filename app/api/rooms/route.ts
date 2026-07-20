import { parseCreateRoomRequest } from "@/lib/room-contract";
import { readJsonBody } from "@/lib/daily-route";
import { invalidRoomRequest, roomError, roomSuccess } from "@/lib/room-route";
import { createRoom } from "@/lib/room-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const input = parseCreateRoomRequest(await readJsonBody(request));
  if (!input) return invalidRoomRequest();
  try {
    return roomSuccess(await createRoom(input.displayName));
  } catch (error) {
    return roomError(error);
  }
}
