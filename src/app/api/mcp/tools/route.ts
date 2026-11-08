import { NextResponse } from "next/server";
import { universalMCPClient } from "@/lib/mcp";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const tools = universalMCPClient.listAllTools();
    const geminiTools = universalMCPClient.formatToolsForGemini();
    const openAITools = universalMCPClient.formatToolsForOpenAI();

    return NextResponse.json({
      success: true,
      count: tools.length,
      tools,
      schemas: {
        gemini: geminiTools,
        openai: openAITools,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    return NextResponse.json(
      { success: false, error: err.message || "Failed to list MCP tools" },
      { status: 500 }
    );
  }
}
