import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, REFRESH_COOKIE_NAME } from "@/lib/auth/session-bridge";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseServerClient();
        if (supabase) {
          await supabase.auth.signOut();
        }
      } catch (err) {
        console.warn("Supabase live signOut error:", err);
      }
    }

    const response = NextResponse.json({
      success: true,
      message: "Logged out successfully.",
    });

    response.cookies.set(SESSION_COOKIE_NAME, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    response.cookies.set(REFRESH_COOKIE_NAME, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (error: unknown) {
    console.error("Logout error:", error);
    return NextResponse.json({ error: "Logout failed" }, { status: 500 });
  }
}
