import { NextResponse } from "next/server";
import {
  createSupabaseUserSession,
  roleFromSupabaseUser,
  toPublicSession,
  createUserSession,
  serializeSessionToken,
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
    const { email, password, fullName } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    // 1. Live Supabase Signup if configured
    if (isSupabaseConfigured() && password) {
      const supabase = getSupabaseServerClient();
      if (supabase) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: fullName || email.split("@")[0] },
          },
        });

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }

        if (data.user) {
          const authUser = {
            id: data.user.id,
            email: data.user.email || email,
            fullName: fullName || email.split("@")[0],
            avatarUrl: "/brand-rico-mark.png",
            role: roleFromSupabaseUser(data.user),
          };

          // No Supabase session means the email is unconfirmed (or the address is already
          // registered): a mock-only session, and no users row with an unverified email.
          if (data.session) {
            await syncUserToDatabase(authUser);
          }
          const session = data.session
            ? createSupabaseUserSession(authUser, data.session)
            : createUserSession(authUser, true);
          const response = NextResponse.json({
            success: true,
            session: toPublicSession(session),
            user: authUser,
            message: data.session
              ? "Account created successfully."
              : "Check your email to confirm your account, then sign in.",
            needsEmailConfirmation: !data.session,
          });

          if (data.session) {
            setSupabaseSessionCookies(response, session, data.session.refresh_token);
          } else {
            response.cookies.set(SESSION_COOKIE_NAME, serializeSessionToken(session), getSessionCookieOptions());
            clearRefreshCookie(response);
          }

          return response;
        }
      }
    }

    // 2. Sandbox Signup
    const newUser = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      email: email.trim().toLowerCase(),
      fullName: fullName || email.split("@")[0],
      avatarUrl: "/brand-rico-mark.png",
      role: "user" as const,
    };

    const session = createUserSession(newUser, true);
    await syncUserToDatabase(newUser);

    const response = NextResponse.json({
      success: true,
      session: toPublicSession(session),
      user: newUser,
      message: "Account created successfully.",
    });

    response.cookies.set(
      SESSION_COOKIE_NAME,
      session.accessToken,
      getSessionCookieOptions()
    );
    clearRefreshCookie(response);

    return response;
  } catch (error: unknown) {
    console.error("Signup failed:", error);
    const message = error instanceof Error ? error.message : "Signup failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
