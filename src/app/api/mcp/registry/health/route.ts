import { NextResponse } from "next/server";
import { mcpServerRegistry } from "@/lib/mcp";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const healthSummary = await mcpServerRegistry.healthCheckAll();
    return NextResponse.json({
      success: true,
      summary: healthSummary,
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    return NextResponse.json(
      { success: false, error: err.message || "Failed to run registry health check" },
      { status: 500 }
    );
  }
}
