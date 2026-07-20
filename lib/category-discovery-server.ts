import {
  parseCategoryDiscoveryPayload,
  parseCategoryDraftPayload,
} from "@/lib/category-discovery-contract";
import type {
  CategoryDiscoveryPayload,
  CategoryDraftPayload,
} from "@/lib/category-discovery-types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureAnonymousIdentity } from "@/lib/supabase/session";

export class CategoryDiscoveryServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus: number,
  ) {
    super(message);
  }
}

async function callRpc(name: string, args?: Record<string, string>): Promise<unknown> {
  try {
    const supabase = await createSupabaseServerClient();
    await ensureAnonymousIdentity(supabase);
    const { data, error } = await supabase.rpc(name, args);
    if (error) {
      const invalid = error.code === "22023";
      const limited = error.code === "54000";
      throw new CategoryDiscoveryServiceError(
        invalid ? "invalid-category-request" : limited ? "draft-rate-limited" : "category-discovery-unavailable",
        invalid
          ? "That category request is invalid."
          : limited
            ? "You’ve reached the current draft limit. Try again later."
            : "Category discovery is temporarily unavailable.",
        invalid ? 400 : limited ? 429 : 503,
      );
    }
    return data;
  } catch (error) {
    if (error instanceof CategoryDiscoveryServiceError) throw error;
    throw new CategoryDiscoveryServiceError(
      "category-discovery-unavailable",
      "Category discovery is temporarily unavailable.",
      503,
    );
  }
}

export async function getCategoryDiscovery(query: string): Promise<CategoryDiscoveryPayload> {
  try {
    return parseCategoryDiscoveryPayload(
      await callRpc("category_discover", { p_query: query }),
    );
  } catch (error) {
    if (error instanceof CategoryDiscoveryServiceError) throw error;
    throw new CategoryDiscoveryServiceError(
      "invalid-category-response",
      "Category discovery returned an invalid response.",
      502,
    );
  }
}

export async function createCategoryDraft(input: {
  prompt: string;
  sourceNotes: string;
  coverageNotes: string;
}): Promise<CategoryDraftPayload> {
  try {
    return parseCategoryDraftPayload(
      await callRpc("category_create_draft", {
        p_prompt: input.prompt,
        p_source_notes: input.sourceNotes,
        p_coverage_notes: input.coverageNotes,
      }),
    );
  } catch (error) {
    if (error instanceof CategoryDiscoveryServiceError) throw error;
    throw new CategoryDiscoveryServiceError(
      "invalid-category-response",
      "The category draft returned an invalid response.",
      502,
    );
  }
}
