import { parseCategoryDraftId } from "@/lib/category-discovery-contract";
import {
  categoryError,
  categorySuccess,
  invalidCategoryRequest,
} from "@/lib/category-discovery-route";
import { submitCategoryDraft } from "@/lib/category-discovery-server";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ draftId: string }> },
) {
  const draftId = parseCategoryDraftId((await params).draftId);
  if (!draftId) return invalidCategoryRequest();
  try {
    return categorySuccess(await submitCategoryDraft(draftId));
  } catch (error) {
    return categoryError(error);
  }
}
