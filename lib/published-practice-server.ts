import type { Category } from "@/lib/category-types";
import { parsePublishedPracticeCategory } from "@/lib/published-practice-contract";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureAnonymousIdentity } from "@/lib/supabase/session";

export async function getPublishedPracticeCategory(slug: string): Promise<Category | null> {
  try {
    const supabase = await createSupabaseServerClient();
    await ensureAnonymousIdentity(supabase);
    const { data, error } = await supabase.rpc("category_practice_get", { p_slug: slug });
    if (error?.code === "22023") return null;
    if (error) throw error;
    return parsePublishedPracticeCategory(data);
  } catch {
    return null;
  }
}
