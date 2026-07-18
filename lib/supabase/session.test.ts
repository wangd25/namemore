import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { ensureAnonymousIdentity } from "@/lib/supabase/session";

describe("ensureAnonymousIdentity", () => {
  it("reuses the existing cookie-backed identity", async () => {
    const signInAnonymously = vi.fn();
    const supabase = {
      auth: {
        getClaims: vi.fn().mockResolvedValue({ data: { claims: { sub: "existing-user" } } }),
        signInAnonymously,
      },
    } as unknown as SupabaseClient;

    await expect(ensureAnonymousIdentity(supabase)).resolves.toBe("existing-user");
    expect(signInAnonymously).not.toHaveBeenCalled();
  });

  it("creates an anonymous identity when no valid claims exist", async () => {
    const signInAnonymously = vi.fn().mockResolvedValue({
      data: { user: { id: "anonymous-user" } },
      error: null,
    });
    const supabase = {
      auth: {
        getClaims: vi.fn().mockResolvedValue({ data: { claims: null } }),
        signInAnonymously,
      },
    } as unknown as SupabaseClient;

    await expect(ensureAnonymousIdentity(supabase)).resolves.toBe("anonymous-user");
    expect(signInAnonymously).toHaveBeenCalledOnce();
  });

  it("fails closed when anonymous sign-in is unavailable", async () => {
    const supabase = {
      auth: {
        getClaims: vi.fn().mockResolvedValue({ data: null }),
        signInAnonymously: vi.fn().mockResolvedValue({
          data: { user: null },
          error: { message: "disabled" },
        }),
      },
    } as unknown as SupabaseClient;

    await expect(ensureAnonymousIdentity(supabase)).rejects.toThrow(
      "Anonymous session unavailable.",
    );
  });
});
