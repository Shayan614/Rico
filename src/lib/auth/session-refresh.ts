import crypto from "crypto";
import type { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  REFRESH_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  createSupabaseUserSession,
  deriveAuthKey,
  extractSessionFromCookieValue,
  getSessionCookieOptions,
  roleFromSupabaseUser,
  serializeSessionToken,
} from "./session-bridge";
import type { AuthUser, UserSession } from "./types";

/**
 * Keeps real users signed in past access-token expiry. The Supabase refresh token lives only in
 * one HttpOnly cookie, encrypted and bound to its user. Scripts can never read it, and every
 * refreshed session must come back for that same user.
 */

const REFRESH_COOKIE_SECONDS = 30 * 24 * 60 * 60;
const REFRESH_TIMEOUT_MS = 8000;

interface SupabaseTokens {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  expires_in?: number;
  user?: {
    id: string;
    email?: string;
    app_metadata?: Record<string, unknown>;
    user_metadata?: Record<string, unknown>;
  };
}

type Exchange = { kind: "ok"; tokens: SupabaseTokens } | { kind: "invalid" } | { kind: "unavailable" };

export type RefreshResult =
  | { status: "ok"; session: UserSession; sealedRefresh: string }
  | { status: "none" | "invalid" | "unavailable" };

const sealKey = () => deriveAuthKey("refresh-cookie");

export function sealRefreshToken(userId: string, refreshToken: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", sealKey(), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify({ u: userId, rt: refreshToken }), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}

function openRefreshToken(value: string): { u: string; rt: string } | null {
  try {
    const raw = Buffer.from(value, "base64url");
    if (raw.length <= 28) return null;
    const decipher = crypto.createDecipheriv("aes-256-gcm", sealKey(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    const text = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
    const parsed = JSON.parse(text) as { u?: unknown; rt?: unknown };
    return typeof parsed.u === "string" && typeof parsed.rt === "string" ? { u: parsed.u, rt: parsed.rt } : null;
  } catch {
    return null;
  }
}

function readCookie(request: Request, name: string): string | null {
  const part = (request.headers.get("cookie") ?? "")
    .split(";")
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${name}=`));
  if (!part) return null;
  try {
    return decodeURIComponent(part.slice(name.length + 1));
  } catch {
    return null;
  }
}

async function callSupabase(refreshToken: string): Promise<Exchange> {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
  try {
    const res = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { "content-type": "application/json", apikey: anonKey },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: "no-store",
      signal: AbortSignal.timeout(REFRESH_TIMEOUT_MS),
    });
    if (res.ok) {
      const tokens = (await res.json()) as SupabaseTokens;
      return tokens.access_token && tokens.refresh_token ? { kind: "ok", tokens } : { kind: "unavailable" };
    }
    return res.status >= 400 && res.status < 500 && res.status !== 429 ? { kind: "invalid" } : { kind: "unavailable" };
  } catch {
    return { kind: "unavailable" };
  }
}

// Supabase rotates refresh tokens, so parallel requests from one browser share a single exchange.
const inFlight = new Map<string, Promise<Exchange>>();

function exchangeRefreshToken(refreshToken: string): Promise<Exchange> {
  const key = crypto.createHash("sha256").update(refreshToken).digest("hex");
  let pending = inFlight.get(key);
  if (!pending) {
    pending = callSupabase(refreshToken).finally(() => inFlight.delete(key));
    inFlight.set(key, pending);
  }
  return pending;
}

/** Uses this request's refresh cookie to start a new session for the same user. */
export async function refreshSessionFromRequest(request: Request): Promise<RefreshResult> {
  const cookie = readCookie(request, REFRESH_COOKIE_NAME);
  if (!cookie || !isSupabaseConfigured()) return { status: "none" };

  const sealed = openRefreshToken(cookie);
  if (!sealed) return { status: "invalid" };

  // A live session for someone else means these cookies do not belong together.
  const current = extractSessionFromCookieValue(readCookie(request, SESSION_COOKIE_NAME));
  if (current && current.user.id !== sealed.u) return { status: "invalid" };

  const result = await exchangeRefreshToken(sealed.rt);
  if (result.kind !== "ok") return { status: result.kind };

  const { tokens } = result;
  if (tokens.user?.id !== sealed.u || !tokens.user.email) return { status: "invalid" };

  const authUser: AuthUser = {
    id: tokens.user.id,
    email: tokens.user.email,
    fullName: (tokens.user.user_metadata?.full_name as string | undefined) || tokens.user.email.split("@")[0],
    avatarUrl: tokens.user.user_metadata?.avatar_url as string | undefined,
    role: roleFromSupabaseUser(tokens.user),
  };
  const expiresAt = tokens.expires_at ?? Math.floor(Date.now() / 1000) + (tokens.expires_in ?? 3600);
  return {
    status: "ok",
    session: createSupabaseUserSession(authUser, { access_token: tokens.access_token, expires_at: expiresAt }),
    sealedRefresh: sealRefreshToken(authUser.id, tokens.refresh_token),
  };
}

function setSessionCookies(response: NextResponse, session: UserSession, sealedRefresh: string): void {
  response.cookies.set(
    SESSION_COOKIE_NAME,
    serializeSessionToken(session),
    // The access cookie lasts as long as the Supabase access token it carries.
    getSessionCookieOptions(Math.max(60, Math.floor((session.expiresAt - Date.now()) / 1000)))
  );
  response.cookies.set(REFRESH_COOKIE_NAME, sealedRefresh, getSessionCookieOptions(REFRESH_COOKIE_SECONDS));
}

/** Sets the access and refresh cookies after a real Supabase login or signup. */
export function setSupabaseSessionCookies(response: NextResponse, session: UserSession, refreshToken: string): void {
  setSessionCookies(response, session, sealRefreshToken(session.user.id, refreshToken));
}

/** Removes the refresh cookie, so a sandbox login cannot later refresh into an earlier account. */
export function clearRefreshCookie(response: NextResponse): void {
  response.cookies.set(REFRESH_COOKIE_NAME, "", getSessionCookieOptions(0));
}

/** Applies a refresh result: new cookies on success, none left once the session has ended. */
export function applyRefreshResult(response: NextResponse, result: RefreshResult): void {
  if (result.status === "ok") {
    setSessionCookies(response, result.session, result.sealedRefresh);
  } else if (result.status === "invalid") {
    response.cookies.set(SESSION_COOKIE_NAME, "", getSessionCookieOptions(0));
    clearRefreshCookie(response);
  }
}

/** Removes the script-readable sb-* session cookies that older logins left in the browser. */
export function clearLegacySupabaseCookies(request: Request, response: NextResponse): void {
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const name = part.trim().split("=")[0];
    if (/^sb-.+-auth-token/.test(name)) {
      response.cookies.set(name, "", { path: "/", maxAge: 0 });
    }
  }
}
