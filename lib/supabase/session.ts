import type { SupabaseClient } from "@supabase/supabase-js";

export async function ensureAnonymousIdentity(
  supabase: SupabaseClient,
): Promise<string> {
  const { data: claimsData } = await supabase.auth.getClaims();
  const subject = claimsData?.claims?.sub;
  if (typeof subject === "string" && subject.length > 0) {
    return subject;
  }

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user) {
    throw new Error("Anonymous session unavailable.");
  }
  return data.user.id;
}
