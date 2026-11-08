import { NextResponse } from "next/server";
import { checkAdaptersHealth } from "@/lib/mcp/adapters";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const health = checkAdaptersHealth();
    return NextResponse.json({
      success: true,
      count: health.length,
      adapters: health,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    return NextResponse.json(
      { success: false, error: err.message || "Failed to inspect adapters health" },
      { status: 500 }
    );
  }
}
