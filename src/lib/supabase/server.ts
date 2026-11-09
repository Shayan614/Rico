import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "./client";

/**
 * A stateless Supabase client for server routes. It must never persist a session: a cookie-backed
 * client would write the refresh token to sb-* cookies that browser scripts can read.
 */
export function getSupabaseServerClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) return null;

  try {
    return createClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        // As before: confirmation links carry a one-time code, never tokens in the URL.
        flowType: "pkce",
      },
    });
  } catch (err) {
    console.warn("Failed to initialize Supabase server client:", err);
    return null;
  }
}
