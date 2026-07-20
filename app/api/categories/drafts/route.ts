import { parseCategoryDraftRequest } from "@/lib/category-discovery-contract";
import {
  categoryError,
  categorySuccess,
  invalidCategoryRequest,
  readCategoryJsonBody,
} from "@/lib/category-discovery-route";
import { createCategoryDraft, listCategoryDrafts } from "@/lib/category-discovery-server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return categorySuccess(await listCategoryDrafts());
  } catch (error) {
    return categoryError(error);
  }
}

export async function POST(request: Request) {
  const input = parseCategoryDraftRequest(await readCategoryJsonBody(request));
  if (!input) return invalidCategoryRequest();
  try {
    return categorySuccess(await createCategoryDraft(input));
  } catch (error) {
    return categoryError(error);
  }
}
