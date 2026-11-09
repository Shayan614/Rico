import { NextResponse } from "next/server";
import { payPalOAuth } from "@/lib/paypal";
import { ensureUserRow, extractSessionFromCookieValue, SESSION_COOKIE_NAME } from "./session-bridge";
import { checkSupabaseSession } from "./supabase-verify";
import type { UserSession } from "./types";

type SessionCheck =
  | { ok: true; session: UserSession }
  | { ok: false; response: NextResponse };

const deny = (error: string, status: number): SessionCheck => ({
  ok: false,
  response: NextResponse.json({ error }, { status }),
});

/**
 * Verifies the signed session cookie and, for real users, that their Supabase session is still
 * live. This proves who is calling; each route must still limit data to that user's own mandates.
 */
export async function requireSession(request: Request): Promise<SessionCheck> {
  let mode: "real" | "mock";
  try {
    mode = payPalOAuth.getMode();
  } catch {
    return deny("Payments are not configured.", 503);
  }

  // Without AUTH_SECRET, cookies are signed with a public default or the anon key.
  if (
    !process.env.AUTH_SECRET &&
    (process.env.NODE_ENV === "production" || mode === "real")
  ) {
    return deny("Authentication is not configured.", 503);
  }

  const cookie = (request.headers.get("cookie") ?? "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`));
  const session = extractSessionFromCookieValue(
    cookie ? decodeURIComponent(cookie.slice(SESSION_COOKIE_NAME.length + 1)) : null
  );
  if (!session) return deny("Authentication required.", 401);

  const live = await checkSupabaseSession(session);
  if (live === "invalid") return deny("Your session has ended. Please sign in again.", 401);
  if (live === "unavailable") return deny("Sign-in could not be verified. Try again shortly.", 503);

  // Anyone can get a simulated demo session, so it must never reach real PayPal.
  if (session.isSimulated && mode === "real") {
    return deny("Demo sessions cannot make real payments.", 403);
  }
  return { ok: true, session };
}

/** Mandates reference users, so the verified user must have a row before creating one. */
export async function ensureOwnerRecord(session: UserSession): Promise<void> {
  await ensureUserRow(session.user, !session.isSimulated);
}
