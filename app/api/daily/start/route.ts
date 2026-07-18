import { dailyError, dailySuccess } from "@/lib/daily-route";
import { startDailyAttempt } from "@/lib/daily-server";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    return dailySuccess(await startDailyAttempt());
  } catch (error) {
    return dailyError(error);
  }
}
