import { NextResponse } from "next/server";

import { CategoryBankServiceError } from "@/lib/category-bank-server";
import type { ApiResponse } from "@/lib/daily-types";

const responseHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
};

export function bankSuccess<T>(data: T) {
  const payload: ApiResponse<T> = { ok: true, data };
  return NextResponse.json(payload, { headers: responseHeaders });
}

export function bankError(error: unknown) {
  const serviceError = error instanceof CategoryBankServiceError
    ? error
    : new CategoryBankServiceError(
        "category-bank-unavailable",
        "The answer-bank workspace is temporarily unavailable.",
        503,
      );
  const payload: ApiResponse<never> = {
    ok: false,
    error: { code: serviceError.code, message: serviceError.message },
  };
  return NextResponse.json(payload, { status: serviceError.httpStatus, headers: responseHeaders });
}

export function invalidBankRequest() {
  const payload: ApiResponse<never> = {
    ok: false,
    error: { code: "invalid-request", message: "The answer-bank request was invalid." },
  };
  return NextResponse.json(payload, { status: 400, headers: responseHeaders });
}
