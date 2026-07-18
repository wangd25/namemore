import { NextResponse } from "next/server";

import type { ApiResponse } from "@/lib/daily-types";
import { DailyServiceError } from "@/lib/daily-server";

const responseHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
};

export function dailySuccess<T>(data: T) {
  const payload: ApiResponse<T> = { ok: true, data };
  return NextResponse.json(payload, { headers: responseHeaders });
}

export function dailyError(error: unknown) {
  const serviceError =
    error instanceof DailyServiceError
      ? error
      : new DailyServiceError(
          "daily-unavailable",
          "The daily challenge is temporarily unavailable.",
          503,
        );
  const payload: ApiResponse<never> = {
    ok: false,
    error: { code: serviceError.code, message: serviceError.message },
  };
  return NextResponse.json(payload, {
    status: serviceError.httpStatus,
    headers: responseHeaders,
  });
}

export async function readJsonBody(request: Request): Promise<unknown> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 2_048) {
    return null;
  }
  try {
    const body = await request.text();
    if (body.length > 2_048) {
      return null;
    }
    return JSON.parse(body) as unknown;
  } catch {
    return null;
  }
}

export function invalidRequest() {
  const payload: ApiResponse<never> = {
    ok: false,
    error: { code: "invalid-request", message: "The request was invalid." },
  };
  return NextResponse.json(payload, {
    status: 400,
    headers: responseHeaders,
  });
}
