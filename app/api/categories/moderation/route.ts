import { moderationError, moderationSuccess } from "@/lib/category-moderation-route";
import { getCategoryModerationQueue } from "@/lib/category-moderation-server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return moderationSuccess(await getCategoryModerationQueue());
  } catch (error) {
    return moderationError(error);
  }
}
