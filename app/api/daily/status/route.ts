import { dailyError, dailySuccess } from "@/lib/daily-route";
import { getDailyStatus } from "@/lib/daily-server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return dailySuccess(await getDailyStatus());
  } catch (error) {
    return dailyError(error);
  }
}
