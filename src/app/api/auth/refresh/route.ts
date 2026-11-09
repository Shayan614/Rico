import { NextResponse } from "next/server";
import { toPublicSession } from "@/lib/auth/session-bridge";
import { applyRefreshResult, refreshSessionFromRequest } from "@/lib/auth/session-refresh";

export const dynamic = "force-dynamic";

/** Renews a real session from its HttpOnly refresh cookie. No token is ever returned in the body. */
export async function POST(request: Request) {
  const result = await refreshSessionFromRequest(request);

  let response: NextResponse;
  if (result.status === "ok") {
    response = NextResponse.json({
      success: true,
      session: toPublicSession(result.session),
      user: result.session.user,
    });
  } else if (result.status === "unavailable") {
    response = NextResponse.json({ error: "Sign-in could not be renewed. Try again shortly." }, { status: 503 });
  } else {
    response = NextResponse.json({ error: "Your session has ended. Please sign in again." }, { status: 401 });
  }

  applyRefreshResult(response, result);
  return response;
}
