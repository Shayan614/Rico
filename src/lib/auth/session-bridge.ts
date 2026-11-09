import crypto from "crypto";
import { AuthUser, UserSession } from "./types";
import { db, users } from "@/db";
import { eq } from "drizzle-orm";
import { checkSupabaseSession } from "./supabase-verify";

export const SESSION_COOKIE_NAME = "rico_auth_session";
export const REFRESH_COOKIE_NAME = "rico_auth_refresh";
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

const SECRET_KEY =
  process.env.AUTH_SECRET ||
  process.env.SUPABASE_ANON_KEY ||
  "rico-paypal-ai-hackathon-secure-session-bridge-key-2026";

/** A separate 32-byte key per purpose, derived from the session secret. */
export function deriveAuthKey(purpose: string): Buffer {
  return crypto.createHash("sha256").update(`rico:${purpose}:${SECRET_KEY}`).digest();
}

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

    const given = Buffer.from(signature);
    const expected = Buffer.from(expectedSignature);
    if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
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
 * Bridge session for a real Supabase login. It carries Supabase's access token, so every request
 * can be checked against Supabase, and it expires with that token. The refresh token is kept apart,
 * in its own encrypted HttpOnly cookie (see session-refresh.ts).
 */
export function createSupabaseUserSession(
  user: AuthUser,
  supabaseSession: { access_token: string; expires_at?: number }
): UserSession {
  return {
    user,
    accessToken: supabaseSession.access_token,
    expiresAt: supabaseSession.expires_at ? supabaseSession.expires_at * 1000 : Date.now() + 3600 * 1000,
    isSimulated: false,
  };
}

/** What the browser may see: never a bearer token, since the cookie is HTTP-only for a reason. */
export function toPublicSession(session: UserSession): UserSession {
  return { user: session.user, accessToken: "", expiresAt: session.expiresAt, isSimulated: session.isSimulated };
}

/** App roles come only from app_metadata, which users cannot edit. user_metadata is user-editable. */
export function roleFromSupabaseUser(user: { app_metadata?: Record<string, unknown> }): AuthUser["role"] {
  return user.app_metadata?.role === "admin" ? "admin" : "user";
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

// Sandbox logins prove nothing about an email, and get a new ID each time. The judge is exempt.
const isSandboxUserId = (id: string) => /^usr_(?!judge_)/.test(id);
const sandboxEmail = (id: string) => `${id}@sandbox.invalid`;

/**
 * Makes sure this user has exactly one users row, keyed by their ID. Only a Supabase-verified
 * email is stored; sandbox and unconfirmed users get a placeholder, so nobody can squat an address.
 * A real account's email is never merged or taken.
 */
export async function ensureUserRow(user: AuthUser, emailVerified = !isSandboxUserId(user.id)): Promise<void> {
  const sandbox = !emailVerified || isSandboxUserId(user.id);
  const values = {
    id: user.id,
    email: sandbox ? sandboxEmail(user.id) : user.email,
    fullName: user.fullName || "Rico User",
    avatarUrl: user.avatarUrl || null,
    role: user.role === "judge" ? "judge" : "user",
  };

  await db.insert(users).values(values).onConflictDoNothing();
  const [row] = await db.select({ id: users.id }).from(users).where(eq(users.id, user.id)).limit(1);
  if (row) return;

  // The email is taken. An older sandbox row gives way; a real account does not.
  const [holder] = await db.select({ id: users.id }).from(users).where(eq(users.email, values.email)).limit(1);
  if (holder && isSandboxUserId(holder.id)) {
    await db.update(users).set({ email: sandboxEmail(holder.id) }).where(eq(users.id, holder.id));
    await db.insert(users).values(values).onConflictDoNothing();
    const [claimed] = await db.select({ id: users.id }).from(users).where(eq(users.id, user.id)).limit(1);
    if (claimed) return;
  }
  throw new Error("This email is already linked to another account.");
}

/**
 * Persist or synchronize user to the application `users` table
 */
export async function syncUserToDatabase(user: AuthUser): Promise<void> {
  try {
    const existing = await db.select().from(users).where(eq(users.id, user.id)).limit(1);

    if (existing.length === 0) {
      await ensureUserRow(user);
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
    console.warn("Failed to sync user to the database:", err);
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
  try {
    const { cookies } = await import("next/headers");
    const cookieStore = cookies();
    const cookieValue = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const session = extractSessionFromCookieValue(cookieValue);
    // A real user's cookie is only good while their Supabase session is live.
    if (session && (await checkSupabaseSession(session)) !== "valid") return null;
    return session;
  } catch {
    return null;
  }
}
