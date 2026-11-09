import { createHash } from "crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { UserSession } from "./types";

export type SupabaseCheck = "valid" | "invalid" | "unavailable";

// Short, so a logout or revocation on another server instance takes effect within this time.
const CACHE_MS = Number(process.env.SUPABASE_SESSION_CACHE_MS ?? 30_000);
const cache = new Map<string, { userId: string; until: number }>();
let client: SupabaseClient | null = null;

const tokenKey = (token: string) => createHash("sha256").update(token).digest("hex");

function getClient(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    client = createClient(url!, anonKey!, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return client;
}

/**
 * Asks Supabase whether a real user's session is still live: not expired, logged out, revoked or
 * deleted, and belonging to the same user. Sandbox sessions never reach Supabase and are not checked.
 */
export async function checkSupabaseSession(session: UserSession): Promise<SupabaseCheck> {
  if (session.isSimulated || !isSupabaseConfigured()) return "valid";
  const token = session.accessToken;
  if (!token) return "invalid";

  const key = tokenKey(token);
  const cached = cache.get(key);
  if (cached && cached.until > Date.now()) {
    return cached.userId === session.user.id ? "valid" : "invalid";
  }

  try {
    const { data, error } = await getClient().auth.getUser(token);
    if (error) {
      const status = (error as { status?: number }).status;
      return status && status >= 400 && status < 500 ? "invalid" : "unavailable";
    }
    if (!data.user || data.user.id !== session.user.id) return "invalid";
    cache.set(key, { userId: data.user.id, until: Date.now() + CACHE_MS });
    return "valid";
  } catch {
    return "unavailable";
  }
}

/** Ends this Supabase session server-side, so a copied cookie stops working after logout. */
export async function revokeSupabaseSession(session: UserSession): Promise<void> {
  if (session.isSimulated || !isSupabaseConfigured() || !session.accessToken) return;
  cache.delete(tokenKey(session.accessToken));
  const { error } = await getClient().auth.admin.signOut(session.accessToken, "local");
  if (error) throw error;
}
