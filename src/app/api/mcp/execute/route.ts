import { NextRequest, NextResponse } from "next/server";
import { universalMCPClient } from "@/lib/mcp";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { toolName, args, bypassGuardrails } = body;

    if (!toolName) {
      return NextResponse.json(
        { success: false, error: "Missing required parameter: 'toolName'" },
        { status: 400 }
      );
    }

    const result = await universalMCPClient.callTool(toolName, args || {}, {
      bypassGuardrails,
    });

    return NextResponse.json({
      success: result.success,
      result,
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    return NextResponse.json(
      { success: false, error: err.message || "Failed to execute MCP tool" },
      { status: 500 }
    );
  }
}
