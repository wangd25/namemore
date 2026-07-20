import { NextResponse } from "next/server";

import { CategoryDiscoveryServiceError } from "@/lib/category-discovery-server";
import type { ApiResponse } from "@/lib/daily-types";

const responseHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
};

export function categorySuccess<T>(data: T) {
  const payload: ApiResponse<T> = { ok: true, data };
  return NextResponse.json(payload, { headers: responseHeaders });
}

export function categoryError(error: unknown) {
  const serviceError = error instanceof CategoryDiscoveryServiceError
    ? error
    : new CategoryDiscoveryServiceError(
        "category-discovery-unavailable",
        "Category discovery is temporarily unavailable.",
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

export async function readCategoryJsonBody(request: Request): Promise<unknown> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 2_048) return null;
  try {
    const body = await request.text();
    return body.length <= 2_048 ? JSON.parse(body) as unknown : null;
  } catch {
    return null;
  }
}

export function invalidCategoryRequest() {
  const payload: ApiResponse<never> = {
    ok: false,
    error: { code: "invalid-request", message: "The category request was invalid." },
  };
  return NextResponse.json(payload, { status: 400, headers: responseHeaders });
}
