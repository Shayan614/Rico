import { NextResponse } from "next/server";
import { getServerSession, toPublicSession } from "@/lib/auth/session-bridge";
import {
  applyRefreshResult,
  clearLegacySupabaseCookies,
  refreshSessionFromRequest,
  type RefreshResult,
} from "@/lib/auth/session-refresh";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    let session = await getServerSession();

    // On page load after the access token ended, renew it from the refresh cookie.
    let refresh: RefreshResult | null = null;
    if (!session) {
      refresh = await refreshSessionFromRequest(request);
      if (refresh.status === "ok") session = refresh.session;
    }

    const response = NextResponse.json({
      authenticated: session !== null,
      session: session ? toPublicSession(session) : null,
      user: session?.user || null,
    });

    if (refresh) applyRefreshResult(response, refresh);
    clearLegacySupabaseCookies(request, response);
    return response;
  } catch (error: unknown) {
    console.error("Failed to fetch session:", error);
    return NextResponse.json(
      { authenticated: false, session: null, user: null },
      { status: 500 }
    );
  }
}
