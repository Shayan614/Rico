import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE_NAME = "rico_auth_session";

function parseSessionToken(tokenString?: string) {
  if (!tokenString) return null;
  try {
    const parts = tokenString.split(".");
    if (parts.length !== 2) return null;

    // Decode base64url payload using Edge-compatible standard API
    const base64 = parts[0].replace(/-/g, "+").replace(/_/g, "/");
    const jsonString = atob(base64);
    const session = JSON.parse(jsonString);

    if (!session || !session.expiresAt || session.expiresAt < Date.now()) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Read session cookie
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = parseSessionToken(sessionCookie);

  if (session && session.user) {
    // Inject user identity headers for downstream server components and API routes
    response.headers.set("x-user-id", session.user.id);
    response.headers.set("x-user-email", session.user.email);
    response.headers.set("x-user-role", session.user.role);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, images, fonts
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff|woff2)$).*)",
  ],
};
