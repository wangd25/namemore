import { parseSubmitRequest } from "@/lib/daily-contract";
import {
  dailyError,
  dailySuccess,
  invalidRequest,
  readJsonBody,
} from "@/lib/daily-route";
import { submitDailyAnswer } from "@/lib/daily-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const input = parseSubmitRequest(await readJsonBody(request));
  if (!input) {
    return invalidRequest();
  }
  try {
    return dailySuccess(await submitDailyAnswer(input.attemptId, input.answer));
  } catch (error) {
    return dailyError(error);
  }
}
