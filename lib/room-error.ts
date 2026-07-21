export class RoomServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus: number,
  ) {
    super(message);
  }
}

const rpcErrors: Record<string, { code: string; message: string; status: number }> = {
  "22023": { code: "invalid-room-request", message: "That room request is invalid.", status: 400 },
  P0002: { code: "room-not-found", message: "That private room doesn’t exist.", status: 404 },
  "42501": { code: "room-unavailable", message: "That room action isn’t available to you.", status: 403 },
  "55000": { code: "room-locked", message: "That private room has already started.", status: 409 },
  "54000": { code: "room-full", message: "That private room is full.", status: 409 },
};

const payloadErrors: Record<string, { code: string; message: string; status: number }> = {
  "rate-limited": {
    code: "room-rate-limited",
    message: "Too many room requests. Please wait a few minutes and try again.",
    status: 429,
  },
  "not-found": { code: "room-not-found", message: "That private room doesn’t exist.", status: 404 },
  "membership-unavailable": {
    code: "room-unavailable",
    message: "That room action isn’t available to you.",
    status: 403,
  },
  locked: { code: "room-locked", message: "That private room has already started.", status: 409 },
  full: { code: "room-full", message: "That private room is full.", status: 409 },
};

function makeServiceError(
  mapped: { code: string; message: string; status: number } | undefined,
): RoomServiceError {
  return new RoomServiceError(
    mapped?.code ?? "room-unavailable",
    mapped?.message ?? "Private rooms are temporarily unavailable.",
    mapped?.status ?? 503,
  );
}

export function roomServiceErrorFromRpcCode(code: string): RoomServiceError {
  return makeServiceError(rpcErrors[code]);
}

export function roomServiceErrorFromPayload(value: unknown): RoomServiceError | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const errorCode = (value as Record<string, unknown>)._roomError;
  if (typeof errorCode !== "string") return null;
  return makeServiceError(payloadErrors[errorCode]);
}
