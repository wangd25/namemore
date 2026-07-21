import { parseCategoryDraftId } from "@/lib/category-discovery-contract";
import { readCategoryJsonBody } from "@/lib/category-discovery-route";
import { parseCategoryReviewDecisionRequest } from "@/lib/category-review-contract";
import { invalidReviewRequest, reviewError, reviewSuccess } from "@/lib/category-review-route";
import { decideCategoryReview } from "@/lib/category-review-server";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ draftId: string }> },
) {
  const draftId = parseCategoryDraftId((await params).draftId);
  const input = parseCategoryReviewDecisionRequest(await readCategoryJsonBody(request));
  if (!draftId || !input) return invalidReviewRequest();
  try {
    return reviewSuccess(await decideCategoryReview(draftId, input));
  } catch (error) {
    return reviewError(error);
  }
}
