import { NextResponse } from "next/server";
import {
  SESSION_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  extractSessionFromCookieValue,
} from "@/lib/auth/session-bridge";
import { revokeSupabaseSession } from "@/lib/auth/supabase-verify";
import { refreshSessionFromRequest } from "@/lib/auth/session-refresh";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    // Revokes the Supabase session inside the bridge cookie, so a copy of it stops working.
    const cookie = (request.headers.get("cookie") ?? "")
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`));
    let bridged = extractSessionFromCookieValue(
      cookie ? decodeURIComponent(cookie.slice(SESSION_COOKIE_NAME.length + 1)) : null
    );
    // Revoking needs a live access token, so an expired one is renewed first.
    if (!bridged) {
      const refreshed = await refreshSessionFromRequest(request);
      if (refreshed.status === "ok") bridged = refreshed.session;
    }
    if (bridged) {
      try {
        await revokeSupabaseSession(bridged);
      } catch (err) {
        console.warn("Supabase session revocation failed:", err);
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
