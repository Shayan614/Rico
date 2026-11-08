import { NextRequest, NextResponse } from "next/server";
import { mcpServerRegistry } from "@/lib/mcp";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const refreshed = await mcpServerRegistry.refreshServer(id);

    return NextResponse.json({
      success: true,
      server: refreshed,
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    return NextResponse.json(
      { success: false, error: err.message || "Failed to refresh MCP server" },
      { status: 500 }
    );
  }
}
