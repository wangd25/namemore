import {
  parseCategoryDraftId,
  parseCategoryDraftRequest,
} from "@/lib/category-discovery-contract";
import {
  categoryError,
  categorySuccess,
  invalidCategoryRequest,
  readCategoryJsonBody,
} from "@/lib/category-discovery-route";
import { updateCategoryDraft } from "@/lib/category-discovery-server";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ draftId: string }> },
) {
  const draftId = parseCategoryDraftId((await params).draftId);
  const input = parseCategoryDraftRequest(await readCategoryJsonBody(request));
  if (!draftId || !input) return invalidCategoryRequest();
  try {
    return categorySuccess(await updateCategoryDraft(draftId, input));
  } catch (error) {
    return categoryError(error);
  }
}
