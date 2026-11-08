import { NextRequest, NextResponse } from "next/server";
import { mcpServerRegistry } from "@/lib/mcp";
import { MCPServerStatus } from "@/lib/mcp/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category") || undefined;
    const status = (searchParams.get("status") as MCPServerStatus) || undefined;
    const enabled = searchParams.get("enabled") !== null
      ? searchParams.get("enabled") === "true"
      : undefined;

    const servers = mcpServerRegistry.listServers({ category, status, enabled });
    const allTools = mcpServerRegistry.getAllDiscoveredTools();

    return NextResponse.json({
      success: true,
      count: servers.length,
      totalToolsDiscovered: allTools.length,
      servers,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    return NextResponse.json(
      { success: false, error: err.message || "Failed to list MCP registry servers" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, endpointUrl, transport, category, authToken, headers, timeoutMs } = body;

    if (!name || !endpointUrl) {
      return NextResponse.json(
        { success: false, error: "Missing required parameters: 'name' and 'endpointUrl'" },
        { status: 400 }
      );
    }

    const record = await mcpServerRegistry.registerServer({
      name,
      endpointUrl,
      transport,
      category,
      authToken,
      headers,
      timeoutMs,
    });

    return NextResponse.json({
      success: true,
      server: record,
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    return NextResponse.json(
      { success: false, error: err.message || "Failed to register MCP server endpoint" },
      { status: 500 }
    );
  }
}
