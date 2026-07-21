import {
  parseCategoryBankPayload,
  parseCategoryBankQueuePayload,
} from "@/lib/category-bank-contract";
import type {
  CategoryBankPayload,
  CategoryBankQueuePayload,
  CategoryBankSaveInput,
} from "@/lib/category-bank-types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureAnonymousIdentity } from "@/lib/supabase/session";
import { getCategoryReviewerStatus } from "@/lib/category-review-server";

export class CategoryBankServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus: number,
  ) {
    super(message);
  }
}

export async function callCategoryBankRpc(name: string, args?: Record<string, unknown>): Promise<unknown> {
  try {
    const supabase = await createSupabaseServerClient();
    await ensureAnonymousIdentity(supabase);
    const { data, error } = await supabase.rpc(name, args);
    if (error) {
      const unauthorized = error.code === "42501";
      const invalid = error.code === "22023";
      const locked = error.code === "55000";
      throw new CategoryBankServiceError(
        unauthorized ? "reviewer-authorization-required" : invalid ? "invalid-category-bank" : locked ? "category-bank-locked" : "category-bank-unavailable",
        unauthorized
          ? "This private workspace is available only to assigned reviewers."
          : invalid
            ? "That answer bank contains invalid or colliding values."
            : locked
              ? "This answer bank is locked or being edited by another reviewer."
              : "The answer-bank workspace is temporarily unavailable.",
        unauthorized ? 403 : invalid ? 400 : locked ? 409 : 503,
      );
    }
    return data;
  } catch (error) {
    if (error instanceof CategoryBankServiceError) throw error;
    throw new CategoryBankServiceError(
      "category-bank-unavailable",
      "The answer-bank workspace is temporarily unavailable.",
      503,
    );
  }
}

export function parseCategoryBankResponse(value: unknown): CategoryBankPayload {
  try {
    return parseCategoryBankPayload(value);
  } catch {
    throw new CategoryBankServiceError(
      "invalid-category-bank-response",
      "The answer-bank workspace returned an invalid response.",
      502,
    );
  }
}

export async function getCategoryBankQueue(): Promise<CategoryBankQueuePayload> {
  const status = await getCategoryReviewerStatus();
  if (!status.authorized) return { ...status, drafts: [] };
  try {
    return parseCategoryBankQueuePayload(await callCategoryBankRpc("category_bank_queue"));
  } catch (error) {
    if (error instanceof CategoryBankServiceError) throw error;
    throw new CategoryBankServiceError(
      "invalid-category-bank-response",
      "The answer-bank workspace returned an invalid response.",
      502,
    );
  }
}

export async function openCategoryBank(draftId: string): Promise<CategoryBankPayload> {
  return parseCategoryBankResponse(await callCategoryBankRpc("category_bank_open", { p_draft_id: draftId }));
}

export async function saveCategoryBank(draftId: string, input: CategoryBankSaveInput): Promise<CategoryBankPayload> {
  return parseCategoryBankResponse(await callCategoryBankRpc("category_bank_save", {
    p_draft_id: draftId,
    p_snapshot_date: input.snapshotDate,
    p_time_limit_seconds: input.timeLimitSeconds,
    p_source_label: input.sourceLabel,
    p_source_url: input.sourceUrl,
    p_version_note: input.versionNote,
    p_answers: input.answers,
  }));
}

export async function freezeCategoryBank(draftId: string): Promise<CategoryBankPayload> {
  return parseCategoryBankResponse(await callCategoryBankRpc("category_bank_freeze", { p_draft_id: draftId }));
}

export async function startCategoryBankRevision(draftId: string): Promise<CategoryBankPayload> {
  return parseCategoryBankResponse(await callCategoryBankRpc("category_bank_start_revision", { p_draft_id: draftId }));
}
