import { NextResponse } from "next/server";
import {
  createSupabaseUserSession,
  roleFromSupabaseUser,
  toPublicSession,
  createUserSession,
  getJudgeDemoSession,
  syncUserToDatabase,
  SESSION_COOKIE_NAME,
  getSessionCookieOptions,
} from "@/lib/auth/session-bridge";
import { clearRefreshCookie, setSupabaseSessionCookies } from "@/lib/auth/session-refresh";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, isDemo } = body;

    // 1. One-Click Judge Demo Login
    if (isDemo || email === "judge@paypal-hackathon.ai") {
      const demoSession = getJudgeDemoSession();
      await syncUserToDatabase(demoSession.user);

      const response = NextResponse.json({
        success: true,
        session: toPublicSession(demoSession),
        user: demoSession.user,
        message: "Judge Evaluator session initialized successfully.",
      });

      response.cookies.set(
        SESSION_COOKIE_NAME,
        demoSession.accessToken,
        getSessionCookieOptions()
      );
      clearRefreshCookie(response);

      return response;
    }

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required." },
        { status: 400 }
      );
    }

    // 2. Live Supabase Auth Login (if configured)
    if (isSupabaseConfigured() && password) {
      const supabase = getSupabaseServerClient();
      if (supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 401 });
        }

        if (data.user && data.session) {
          const authUser = {
            id: data.user.id,
            email: data.user.email || email,
            fullName: data.user.user_metadata?.full_name || email.split("@")[0],
            avatarUrl: data.user.user_metadata?.avatar_url,
            role: roleFromSupabaseUser(data.user),
          };

          await syncUserToDatabase(authUser);

          const liveSession = createSupabaseUserSession(authUser, data.session);

          const response = NextResponse.json({
            success: true,
            session: toPublicSession(liveSession),
            user: authUser,
          });

          setSupabaseSessionCookies(response, liveSession, data.session.refresh_token);

          return response;
        }
      }
    }

    // 3. Fallback Sandbox / Dev Auth (Immediate Zero-Setup Login)
    const simulatedUser = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      email: email.trim().toLowerCase(),
      fullName: email.split("@")[0],
      avatarUrl: "/brand-rico-mark.png",
      role: "user" as const,
    };

    const session = createUserSession(simulatedUser, true);
    await syncUserToDatabase(simulatedUser);

    const response = NextResponse.json({
      success: true,
      session: toPublicSession(session),
      user: simulatedUser,
      message: "Sandbox authentication session created.",
    });

    response.cookies.set(
      SESSION_COOKIE_NAME,
      session.accessToken,
      getSessionCookieOptions()
    );
    clearRefreshCookie(response);

    return response;
  } catch (error: unknown) {
    console.error("Login failed:", error);
    const message = error instanceof Error ? error.message : "Authentication failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
