import { reviewError, reviewSuccess } from "@/lib/category-review-route";
import { getCategoryReviewQueue } from "@/lib/category-review-server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return reviewSuccess(await getCategoryReviewQueue());
  } catch (error) {
    return reviewError(error);
  }
}
