import { parseFinishRequest } from "@/lib/daily-contract";
import {
  dailyError,
  dailySuccess,
  invalidRequest,
  readJsonBody,
} from "@/lib/daily-route";
import { finishDailyAttempt } from "@/lib/daily-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const input = parseFinishRequest(await readJsonBody(request));
  if (!input) {
    return invalidRequest();
  }
  try {
    return dailySuccess(await finishDailyAttempt(input.attemptId));
  } catch (error) {
    return dailyError(error);
  }
}
