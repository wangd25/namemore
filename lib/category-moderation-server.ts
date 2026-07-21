import {
  parseCategoryModerationDecisionPayload,
  parseCategoryModerationQueuePayload,
  parseCategoryModeratorStatusPayload,
  parseCategoryReportReceipt,
} from "@/lib/category-moderation-contract";
import type {
  CategoryModerationDecisionInput,
  CategoryModerationDecisionPayload,
  CategoryModerationQueuePayload,
  CategoryModeratorStatusPayload,
  CategoryReportInput,
  CategoryReportReceipt,
} from "@/lib/category-moderation-types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureAnonymousIdentity } from "@/lib/supabase/session";

export class CategoryModerationServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus: number,
  ) {
    super(message);
  }
}

async function callModerationRpc(name: string, args?: Record<string, string>): Promise<unknown> {
  try {
    const supabase = await createSupabaseServerClient();
    await ensureAnonymousIdentity(supabase);
    const { data, error } = await supabase.rpc(name, args);
    if (error) {
      const unauthorized = error.code === "42501";
      const invalid = error.code === "22023";
      const duplicate = error.code === "23505";
      const limited = error.code === "54000";
      const stale = error.code === "55000";
      throw new CategoryModerationServiceError(
        unauthorized
          ? "moderator-authorization-required"
          : invalid
            ? "invalid-category-moderation-request"
            : duplicate
              ? "category-report-already-pending"
              : limited
                ? "category-report-rate-limited"
                : stale
                  ? "category-report-already-reviewed"
                  : "category-moderation-unavailable",
        unauthorized
          ? "This private workspace is available only to assigned moderators."
          : invalid
            ? "That category report or moderation decision is invalid."
            : duplicate
              ? "You already have a report pending for this category version."
              : limited
                ? "You’ve reached the current report limit. Try again later."
                : stale
                  ? "That report has already been reviewed."
                  : "Category moderation is temporarily unavailable.",
        unauthorized ? 403 : invalid ? 400 : duplicate || stale ? 409 : limited ? 429 : 503,
      );
    }
    return data;
  } catch (error) {
    if (error instanceof CategoryModerationServiceError) throw error;
    throw new CategoryModerationServiceError(
      "category-moderation-unavailable",
      "Category moderation is temporarily unavailable.",
      503,
    );
  }
}

export async function createCategoryReport(input: CategoryReportInput): Promise<CategoryReportReceipt> {
  try {
    return parseCategoryReportReceipt(await callModerationRpc("category_report_create", {
      p_slug: input.slug,
      p_reason: input.reason,
      p_detail: input.detail,
    }));
  } catch (error) {
    if (error instanceof CategoryModerationServiceError) throw error;
    throw new CategoryModerationServiceError("invalid-category-moderation-response", "The category report returned an invalid response.", 502);
  }
}

export async function getCategoryModeratorStatus(): Promise<CategoryModeratorStatusPayload> {
  try {
    return parseCategoryModeratorStatusPayload(await callModerationRpc("category_moderator_status"));
  } catch (error) {
    if (error instanceof CategoryModerationServiceError) throw error;
    throw new CategoryModerationServiceError("invalid-category-moderation-response", "Category moderation returned an invalid response.", 502);
  }
}

export async function getCategoryModerationQueue(): Promise<CategoryModerationQueuePayload> {
  const status = await getCategoryModeratorStatus();
  if (!status.authorized) return { ...status, reports: [] };
  try {
    return parseCategoryModerationQueuePayload(await callModerationRpc("category_moderation_queue"));
  } catch (error) {
    if (error instanceof CategoryModerationServiceError) throw error;
    throw new CategoryModerationServiceError("invalid-category-moderation-response", "The moderation queue returned an invalid response.", 502);
  }
}

export async function decideCategoryReport(
  reportId: string,
  input: CategoryModerationDecisionInput,
): Promise<CategoryModerationDecisionPayload> {
  try {
    return parseCategoryModerationDecisionPayload(await callModerationRpc("category_moderation_decide", {
      p_report_id: reportId,
      p_outcome: input.outcome,
      p_note: input.note,
    }));
  } catch (error) {
    if (error instanceof CategoryModerationServiceError) throw error;
    throw new CategoryModerationServiceError("invalid-category-moderation-response", "The moderation decision returned an invalid response.", 502);
  }
}
