import {
  parseCategoryPublicationPayload,
  parseCategoryPublicationQueuePayload,
  parseCategoryPublicationRelease,
  parseCategoryPublisherStatusPayload,
} from "@/lib/category-publication-contract";
import type {
  CategoryPublicationInput,
  CategoryPublicationCorrectionInput,
  CategoryPublicationPayload,
  CategoryPublicationQueuePayload,
  CategoryPublicationRelease,
  CategoryPublisherStatusPayload,
} from "@/lib/category-publication-types";
import { CategoryBankServiceError } from "@/lib/category-bank-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureAnonymousIdentity } from "@/lib/supabase/session";

export class CategoryPublicationServiceError extends CategoryBankServiceError {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus: number,
  ) { super(code, message, httpStatus); }
}

async function callPublicationRpc(name: string, args?: Record<string, unknown>): Promise<unknown> {
  try {
    const supabase = await createSupabaseServerClient();
    await ensureAnonymousIdentity(supabase);
    const { data, error } = await supabase.rpc(name, args);
    if (error) {
      const unauthorized = error.code === "42501";
      const invalid = error.code === "22023";
      const locked = error.code === "55000";
      const conflict = error.code === "23505";
      throw new CategoryPublicationServiceError(
        unauthorized
          ? "publisher-authorization-required"
          : invalid
            ? "invalid-category-publication"
            : locked
              ? "category-publication-locked"
              : conflict
                ? "category-publication-conflict"
                : "category-publication-unavailable",
        unauthorized
          ? "This private workspace is available only to assigned publishers."
          : invalid
            ? "That publication contains invalid values."
            : locked
              ? "This approved bank is no longer available to publish."
              : conflict
                ? "The release changed before this operation completed. Reload and try again."
                : "Category publishing is temporarily unavailable.",
        unauthorized ? 403 : invalid ? 400 : locked || conflict ? 409 : 503,
      );
    }
    return data;
  } catch (error) {
    if (error instanceof CategoryPublicationServiceError) throw error;
    throw new CategoryPublicationServiceError(
      "category-publication-unavailable",
      "Category publishing is temporarily unavailable.",
      503,
    );
  }
}

export async function getCategoryPublisherStatus(): Promise<CategoryPublisherStatusPayload> {
  try {
    return parseCategoryPublisherStatusPayload(await callPublicationRpc("category_publisher_status"));
  } catch (error) {
    if (error instanceof CategoryPublicationServiceError) throw error;
    throw new CategoryPublicationServiceError(
      "invalid-category-publication-response",
      "Category publishing returned an invalid response.",
      502,
    );
  }
}

export async function getCategoryPublicationQueue(): Promise<CategoryPublicationQueuePayload> {
  const status = await getCategoryPublisherStatus();
  if (!status.authorized) return { ...status, banks: [], releases: [] };
  try {
    return parseCategoryPublicationQueuePayload(await callPublicationRpc("category_publication_queue"));
  } catch (error) {
    if (error instanceof CategoryPublicationServiceError) throw error;
    throw new CategoryPublicationServiceError(
      "invalid-category-publication-response",
      "The publishing queue returned an invalid response.",
      502,
    );
  }
}

export async function requestCategoryPublicationCorrection(
  publicationId: string,
  input: CategoryPublicationCorrectionInput,
): Promise<CategoryPublicationRelease> {
  try {
    return parseCategoryPublicationRelease(await callPublicationRpc("category_publication_request_correction", {
      p_publication_id: publicationId,
      p_reason: input.reason,
    }));
  } catch (error) {
    if (error instanceof CategoryPublicationServiceError) throw error;
    throw new CategoryPublicationServiceError(
      "invalid-category-publication-response",
      "The correction request returned an invalid response.",
      502,
    );
  }
}

export async function publishApprovedCategoryBank(
  draftId: string,
  input: CategoryPublicationInput,
): Promise<CategoryPublicationPayload> {
  try {
    return parseCategoryPublicationPayload(await callPublicationRpc("category_publish_approved_bank", {
      p_draft_id: draftId,
      p_slug: input.slug,
      p_title: input.title,
      p_summary: input.summary,
      p_coverage_note: input.coverageNote,
    }));
  } catch (error) {
    if (error instanceof CategoryPublicationServiceError) throw error;
    throw new CategoryPublicationServiceError(
      "invalid-category-publication-response",
      "The published category returned an invalid response.",
      502,
    );
  }
}
