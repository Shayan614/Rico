import crypto from "crypto";
import { AuthUser, UserSession } from "./types";
import { db, users } from "@/db";
import { eq } from "drizzle-orm";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const SESSION_COOKIE_NAME = "rico_auth_session";
export const REFRESH_COOKIE_NAME = "rico_auth_refresh";
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

const SECRET_KEY =
  process.env.AUTH_SECRET ||
  process.env.SUPABASE_ANON_KEY ||
  "rico-paypal-ai-hackathon-secure-session-bridge-key-2026";

/**
 * Sign a payload with HMAC-SHA256
 */
function signPayload(payloadString: string): string {
  return crypto.createHmac("sha256", SECRET_KEY).update(payloadString).digest("base64url");
}

/**
 * Verify HMAC-SHA256 signed payload
 */
function verifyPayload(tokenString: string): UserSession | null {
  try {
    const parts = tokenString.split(".");
    if (parts.length !== 2) return null;

    const [encodedPayload, signature] = parts;
    const expectedSignature = signPayload(encodedPayload);

    if (signature !== expectedSignature) {
      return null;
    }

    const jsonString = Buffer.from(encodedPayload, "base64url").toString("utf8");
    const session: UserSession = JSON.parse(jsonString);

    if (!session || !session.expiresAt || session.expiresAt < Date.now()) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

/**
 * Serialize a session into a tamper-proof signed cookie string
 */
export function serializeSessionToken(session: UserSession): string {
  const jsonString = JSON.stringify(session);
  const encodedPayload = Buffer.from(jsonString, "utf8").toString("base64url");
  const signature = signPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

/**
 * Generate a 1-click Judge evaluator session (0 external setup required)
 */
export function getJudgeDemoSession(): UserSession {
  const user: AuthUser = {
    id: "usr_judge_paypal_hackathon",
    email: "judge@paypal-hackathon.ai",
    fullName: "Judge Evaluator",
    avatarUrl: "/brand-rico-mark.png",
    role: "judge",
  };

  const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;
  const rawSession: UserSession = {
    user,
    accessToken: `token_demo_${Date.now()}`,
    expiresAt,
    isSimulated: true,
  };

  rawSession.accessToken = serializeSessionToken(rawSession);
  return rawSession;
}

/**
 * Create a new user session from user profile
 */
export function createUserSession(user: AuthUser, isSimulated: boolean = true): UserSession {
  const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;
  const rawSession: UserSession = {
    user,
    accessToken: "",
    expiresAt,
    isSimulated,
  };

  rawSession.accessToken = serializeSessionToken(rawSession);
  return rawSession;
}

/**
 * Persist or synchronize user to local SQLite `users` table
 */
export async function syncUserToDatabase(user: AuthUser): Promise<void> {
  try {
    const existing = await db.select().from(users).where(eq(users.id, user.id)).limit(1);

    if (existing.length === 0) {
      await db.insert(users).values({
        id: user.id,
        email: user.email,
        fullName: user.fullName || "Rico User",
        avatarUrl: user.avatarUrl || null,
        role: user.role || "user",
      });
    } else {
      await db
        .update(users)
        .set({
          fullName: user.fullName || existing[0].fullName,
          avatarUrl: user.avatarUrl || existing[0].avatarUrl,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(users.id, user.id));
    }
  } catch (err) {
    console.warn("Failed to sync user to local SQLite database:", err);
  }
}

/**
 * Extract and validate session from raw cookie string or dictionary
 */
export function extractSessionFromCookieValue(cookieValue?: string | null): UserSession | null {
  if (!cookieValue || cookieValue.trim().length === 0) return null;
  return verifyPayload(cookieValue.trim());
}

/**
 * Standard cookie configuration for HTTP-only session cookies
 */
export function getSessionCookieOptions(maxAgeSeconds: number = SESSION_TTL_SECONDS) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

/**
 * Server-side session resolver for Next.js App Router (Server Components / Actions)
 */
export async function getServerSession(): Promise<UserSession | null> {
  // 1. Try Live Supabase Auth if configured
  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabaseServerClient();
      if (supabase) {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user && user.email) {
          const authUser: AuthUser = {
            id: user.id,
            email: user.email,
            fullName: user.user_metadata?.full_name || user.email.split("@")[0],
            avatarUrl: user.user_metadata?.avatar_url,
            role: (user.user_metadata?.role as "user" | "admin" | "judge") || "user",
          };

          return {
            user: authUser,
            accessToken: "live_supabase_token",
            expiresAt: Date.now() + 3600 * 1000,
            isSimulated: false,
          };
        }
      }
    } catch {
      // Fall through to cookie bridge
    }
  }

  // 2. Read from Next.js server cookie store
  try {
    const { cookies } = await import("next/headers");
    const cookieStore = cookies();
    const cookieValue = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    return extractSessionFromCookieValue(cookieValue);
  } catch {
    return null;
  }
}
