import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session-bridge";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession();

    return NextResponse.json({
      authenticated: session !== null,
      session,
      user: session?.user || null,
    });
  } catch (error: unknown) {
    console.error("Failed to fetch session:", error);
    return NextResponse.json(
      { authenticated: false, session: null, user: null },
      { status: 500 }
    );
  }
}
