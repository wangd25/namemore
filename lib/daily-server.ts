import {
  parseDailyFinishPayload,
  parseDailyStatusPayload,
  parseDailySubmissionResult,
} from "@/lib/daily-contract";
import type {
  DailyFinishPayload,
  DailyStatusPayload,
  DailySubmissionResult,
} from "@/lib/daily-types";
import { normalizeAnswer } from "@/lib/normalize";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureAnonymousIdentity } from "@/lib/supabase/session";

export class DailyServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus: number,
  ) {
    super(message);
  }
}

async function callRpc(
  name: string,
  args?: Record<string, string>,
): Promise<unknown> {
  try {
    const supabase = await createSupabaseServerClient();
    await ensureAnonymousIdentity(supabase);
    const { data, error } = await supabase.rpc(name, args);
    if (error) {
      const isForbidden = error.code === "42501";
      throw new DailyServiceError(
        isForbidden ? "attempt-unavailable" : "daily-unavailable",
        isForbidden
          ? "That daily attempt is unavailable."
          : "The daily challenge is temporarily unavailable.",
        isForbidden ? 403 : 503,
      );
    }
    return data;
  } catch (error) {
    if (error instanceof DailyServiceError) {
      throw error;
    }
    throw new DailyServiceError(
      "daily-unavailable",
      "The daily challenge is temporarily unavailable.",
      503,
    );
  }
}

function parseTrustedResult<T>(
  value: unknown,
  parser: (input: unknown) => T,
): T {
  try {
    return parser(value);
  } catch {
    throw new DailyServiceError(
      "invalid-daily-response",
      "The daily challenge returned an invalid response.",
      502,
    );
  }
}

export async function getDailyStatus(): Promise<DailyStatusPayload> {
  return parseTrustedResult(await callRpc("daily_get_status"), parseDailyStatusPayload);
}

export async function startDailyAttempt(): Promise<DailyStatusPayload> {
  return parseTrustedResult(await callRpc("daily_start_attempt"), parseDailyStatusPayload);
}

export async function submitDailyAnswer(
  attemptId: string,
  rawAnswer: string,
): Promise<DailySubmissionResult> {
  const normalizedAnswer = normalizeAnswer(rawAnswer);
  if (!normalizedAnswer || normalizedAnswer.length > 80) {
    return { status: "invalid", serverNow: new Date().toISOString() };
  }
  return parseTrustedResult(
    await callRpc("daily_submit_answer", {
      p_attempt_id: attemptId,
      p_normalized_answer: normalizedAnswer,
    }),
    parseDailySubmissionResult,
  );
}

export async function finishDailyAttempt(
  attemptId: string,
): Promise<DailyFinishPayload> {
  return parseTrustedResult(
    await callRpc("daily_finish_attempt", { p_attempt_id: attemptId }),
    parseDailyFinishPayload,
  );
}
