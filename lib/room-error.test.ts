import { describe, expect, it } from "vitest";

import {
  roomServiceErrorFromPayload,
  roomServiceErrorFromRpcCode,
} from "@/lib/room-error";

describe("room service errors", () => {
  it("maps committed room error payloads to safe HTTP errors", () => {
    const limited = roomServiceErrorFromPayload({ _roomError: "rate-limited" });
    expect(limited).toMatchObject({ code: "room-rate-limited", httpStatus: 429 });

    const missing = roomServiceErrorFromPayload({ _roomError: "not-found" });
    expect(missing).toMatchObject({ code: "room-not-found", httpStatus: 404 });
  });

  it("keeps the existing database error mapping and safe fallback", () => {
    expect(roomServiceErrorFromRpcCode("54000")).toMatchObject({
      code: "room-full",
      httpStatus: 409,
    });
    expect(roomServiceErrorFromRpcCode("unknown")).toMatchObject({
      code: "room-unavailable",
      httpStatus: 503,
    });
  });

  it("ignores normal room payloads", () => {
    expect(roomServiceErrorFromPayload({ room: { code: "ABCDEFGH" } })).toBeNull();
  });
});
