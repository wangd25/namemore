import { NextResponse } from "next/server";

import type { ApiResponse } from "@/lib/daily-types";
import { RoomServiceError } from "@/lib/room-server";

const responseHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
};

export function roomSuccess<T>(data: T) {
  const payload: ApiResponse<T> = { ok: true, data };
  return NextResponse.json(payload, { headers: responseHeaders });
}

export function roomError(error: unknown) {
  const serviceError = error instanceof RoomServiceError
    ? error
    : new RoomServiceError("room-unavailable", "Private rooms are temporarily unavailable.", 503);
  const payload: ApiResponse<never> = {
    ok: false,
    error: { code: serviceError.code, message: serviceError.message },
  };
  return NextResponse.json(payload, { status: serviceError.httpStatus, headers: responseHeaders });
}

export function invalidRoomRequest() {
  const payload: ApiResponse<never> = {
    ok: false,
    error: { code: "invalid-room-request", message: "That room request is invalid." },
  };
  return NextResponse.json(payload, { status: 400, headers: responseHeaders });
}
