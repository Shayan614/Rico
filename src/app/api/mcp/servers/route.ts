import { NextResponse } from "next/server";
import { universalMCPClient } from "@/lib/mcp";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const servers = universalMCPClient.listServers();
    return NextResponse.json({
      success: true,
      count: servers.length,
      servers,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    return NextResponse.json(
      { success: false, error: err.message || "Failed to list MCP servers" },
      { status: 500 }
    );
  }
}
