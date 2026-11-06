import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { type SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "./client";

export function getSupabaseServerClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) return null;

  try {
    const cookieStore = cookies();

    return createServerClient(url, anonKey, {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Can throw in Server Component render, handled in Route Handlers & Middleware
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options, maxAge: 0 });
          } catch {
            // Can throw in Server Component render, handled in Route Handlers & Middleware
          }
        },
      },
    });
  } catch (err) {
    console.warn("Failed to initialize Supabase server client:", err);
    return null;
  }
}
