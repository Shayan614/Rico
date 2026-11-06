import { createBrowserClient } from "@supabase/ssr";
import { type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  return Boolean(
    url &&
    url.trim().length > 10 &&
    !url.includes("your-supabase-url") &&
    anonKey &&
    anonKey.trim().length > 10 &&
    !anonKey.includes("your-anon-key")
  );
}

export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (typeof window === "undefined") return null;

  if (browserClient) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (isSupabaseConfigured() && url && anonKey) {
    try {
      browserClient = createBrowserClient(url, anonKey);
      return browserClient;
    } catch (err) {
      console.warn("Failed to initialize Supabase browser client:", err);
      return null;
    }
  }

  return null;
}
