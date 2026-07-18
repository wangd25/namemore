import { parseStartRequest } from "@/lib/daily-contract";
import {
  dailyError,
  dailySuccess,
  invalidRequest,
  readJsonBody,
} from "@/lib/daily-route";
import { startDailyAttempt } from "@/lib/daily-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const input = parseStartRequest(await readJsonBody(request));
  if (!input) {
    return invalidRequest();
  }
  try {
    return dailySuccess(await startDailyAttempt(input.displayName));
  } catch (error) {
    return dailyError(error);
  }
}
