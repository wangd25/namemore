import { parseCategoryDraftId } from "@/lib/category-discovery-contract";
import { createCategoryAiDraft } from "@/lib/category-ai-server";
import {
  bankError,
  bankSuccess,
  invalidBankRequest,
} from "@/lib/category-bank-route";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ draftId: string }> },
) {
  const draftId = parseCategoryDraftId((await params).draftId);
  if (!draftId) return invalidBankRequest();
  try {
    return bankSuccess(await createCategoryAiDraft(draftId));
  } catch (error) {
    return bankError(error);
  }
}
