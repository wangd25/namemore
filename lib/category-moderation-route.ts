import { NextResponse } from "next/server";

import { CategoryModerationServiceError } from "@/lib/category-moderation-server";
import type { ApiResponse } from "@/lib/daily-types";

const responseHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
};

export function moderationSuccess<T>(data: T) {
  const payload: ApiResponse<T> = { ok: true, data };
  return NextResponse.json(payload, { headers: responseHeaders });
}

export function moderationError(error: unknown) {
  const serviceError = error instanceof CategoryModerationServiceError
    ? error
    : new CategoryModerationServiceError(
        "category-moderation-unavailable",
        "Category moderation is temporarily unavailable.",
        503,
      );
  const payload: ApiResponse<never> = {
    ok: false,
    error: { code: serviceError.code, message: serviceError.message },
  };
  return NextResponse.json(payload, { status: serviceError.httpStatus, headers: responseHeaders });
}

export function invalidModerationRequest() {
  const payload: ApiResponse<never> = {
    ok: false,
    error: { code: "invalid-request", message: "The moderation request was invalid." },
  };
  return NextResponse.json(payload, { status: 400, headers: responseHeaders });
}
