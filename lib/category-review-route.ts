import { NextResponse } from "next/server";

import { CategoryReviewServiceError } from "@/lib/category-review-server";
import type { ApiResponse } from "@/lib/daily-types";

const responseHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
};

export function reviewSuccess<T>(data: T) {
  const payload: ApiResponse<T> = { ok: true, data };
  return NextResponse.json(payload, { headers: responseHeaders });
}

export function reviewError(error: unknown) {
  const serviceError = error instanceof CategoryReviewServiceError
    ? error
    : new CategoryReviewServiceError(
        "category-review-unavailable",
        "Category review is temporarily unavailable.",
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

export function invalidReviewRequest() {
  const payload: ApiResponse<never> = {
    ok: false,
    error: { code: "invalid-request", message: "The review request was invalid." },
  };
  return NextResponse.json(payload, { status: 400, headers: responseHeaders });
}
