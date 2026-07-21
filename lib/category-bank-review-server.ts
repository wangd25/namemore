import {
  parseCategoryBankDecisionPayload,
  parseCategoryBankReviewQueuePayload,
} from "@/lib/category-bank-review-contract";
import type {
  CategoryBankDecisionInput,
  CategoryBankDecisionPayload,
  CategoryBankReviewQueuePayload,
} from "@/lib/category-bank-review-types";
import {
  callCategoryBankRpc,
  CategoryBankServiceError,
} from "@/lib/category-bank-server";
import { getCategoryReviewerStatus } from "@/lib/category-review-server";

export async function getCategoryBankReviewQueue(): Promise<CategoryBankReviewQueuePayload> {
  const status = await getCategoryReviewerStatus();
  if (!status.authorized) return { ...status, banks: [] };
  try {
    return parseCategoryBankReviewQueuePayload(await callCategoryBankRpc("category_bank_review_queue"));
  } catch (error) {
    if (error instanceof CategoryBankServiceError) throw error;
    throw new CategoryBankServiceError(
      "invalid-category-bank-review-response",
      "The answer-bank review queue returned an invalid response.",
      502,
    );
  }
}

export async function decideCategoryBank(
  draftId: string,
  input: CategoryBankDecisionInput,
): Promise<CategoryBankDecisionPayload> {
  try {
    return parseCategoryBankDecisionPayload(await callCategoryBankRpc("category_bank_review_decide", {
      p_draft_id: draftId,
      p_decision: input.decision,
      p_note: input.note,
    }));
  } catch (error) {
    if (error instanceof CategoryBankServiceError) throw error;
    throw new CategoryBankServiceError(
      "invalid-category-bank-review-response",
      "The answer-bank decision returned an invalid response.",
      502,
    );
  }
}
