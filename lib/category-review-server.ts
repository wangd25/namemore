import {
  parseCategoryReviewDecisionPayload,
  parseCategoryReviewerStatusPayload,
  parseCategoryReviewQueuePayload,
} from "@/lib/category-review-contract";
import type {
  CategoryReviewDecisionPayload,
  CategoryReviewerStatusPayload,
  CategoryReviewQueuePayload,
} from "@/lib/category-review-types";
import type { CategoryDraftReviewDecision } from "@/lib/category-discovery-types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureAnonymousIdentity } from "@/lib/supabase/session";

export class CategoryReviewServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus: number,
  ) {
    super(message);
  }
}

async function callReviewRpc(name: string, args?: Record<string, string>): Promise<unknown> {
  try {
    const supabase = await createSupabaseServerClient();
    await ensureAnonymousIdentity(supabase);
    const { data, error } = await supabase.rpc(name, args);
    if (error) {
      const unauthorized = error.code === "42501";
      const invalid = error.code === "22023";
      const stale = error.code === "55000";
      throw new CategoryReviewServiceError(
        unauthorized
          ? "reviewer-authorization-required"
          : invalid
            ? "invalid-review-decision"
            : stale
              ? "review-no-longer-pending"
              : "category-review-unavailable",
        unauthorized
          ? "This private workspace is available only to assigned reviewers."
          : invalid
            ? "That review decision is invalid."
            : stale
              ? "This draft is no longer pending review."
              : "Category review is temporarily unavailable.",
        unauthorized ? 403 : invalid ? 400 : stale ? 409 : 503,
      );
    }
    return data;
  } catch (error) {
    if (error instanceof CategoryReviewServiceError) throw error;
    throw new CategoryReviewServiceError(
      "category-review-unavailable",
      "Category review is temporarily unavailable.",
      503,
    );
  }
}

export async function getCategoryReviewerStatus(): Promise<CategoryReviewerStatusPayload> {
  try {
    return parseCategoryReviewerStatusPayload(await callReviewRpc("category_reviewer_status"));
  } catch (error) {
    if (error instanceof CategoryReviewServiceError) throw error;
    throw new CategoryReviewServiceError(
      "invalid-category-review-response",
      "Category review returned an invalid response.",
      502,
    );
  }
}

export async function getCategoryReviewQueue(): Promise<CategoryReviewQueuePayload> {
  const status = await getCategoryReviewerStatus();
  if (!status.authorized) return { ...status, drafts: [] };
  try {
    return parseCategoryReviewQueuePayload(await callReviewRpc("category_review_queue"));
  } catch (error) {
    if (error instanceof CategoryReviewServiceError) throw error;
    throw new CategoryReviewServiceError(
      "invalid-category-review-response",
      "Category review returned an invalid response.",
      502,
    );
  }
}

export async function decideCategoryReview(
  draftId: string,
  input: { decision: CategoryDraftReviewDecision; note: string },
): Promise<CategoryReviewDecisionPayload> {
  try {
    return parseCategoryReviewDecisionPayload(
      await callReviewRpc("category_review_decide", {
        p_draft_id: draftId,
        p_decision: input.decision,
        p_note: input.note,
      }),
    );
  } catch (error) {
    if (error instanceof CategoryReviewServiceError) throw error;
    throw new CategoryReviewServiceError(
      "invalid-category-review-response",
      "Category review returned an invalid response.",
      502,
    );
  }
}
