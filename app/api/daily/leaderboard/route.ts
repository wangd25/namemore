import { dailyError, dailySuccess } from "@/lib/daily-route";
import { getDailyLeaderboard } from "@/lib/daily-server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return dailySuccess(await getDailyLeaderboard());
  } catch (error) {
    return dailyError(error);
  }
}
