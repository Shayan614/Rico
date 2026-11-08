import { NextRequest, NextResponse } from "next/server";
import { universalMCPClient } from "@/lib/mcp";
import { MCPServerConfig } from "@/lib/mcp/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, name, endpointUrl, transport, authToken, headers } = body;

    if (!endpointUrl) {
      return NextResponse.json(
        { success: false, error: "Missing required parameter: 'endpointUrl'" },
        { status: 400 }
      );
    }

    const serverId = id || `mcp_${Date.now()}`;
    const serverName = name || `MCP Server (${new URL(endpointUrl).hostname})`;

    const config: MCPServerConfig = {
      id: serverId,
      name: serverName,
      endpointUrl,
      transport: transport || "HTTP",
      authToken,
      headers,
    };

    const serverState = await universalMCPClient.connectServer(config);

    return NextResponse.json({
      success: serverState.status === "CONNECTED",
      serverState,
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    return NextResponse.json(
      { success: false, error: err.message || "Failed to connect MCP server" },
      { status: 500 }
    );
  }
}
