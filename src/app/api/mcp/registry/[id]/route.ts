import { NextRequest, NextResponse } from "next/server";
import { mcpServerRegistry } from "@/lib/mcp";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const server = mcpServerRegistry.getServer(id);

    if (!server) {
      return NextResponse.json(
        { success: false, error: `MCP Server '${id}' not found` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      server,
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    return NextResponse.json(
      { success: false, error: err.message || "Failed to retrieve MCP server" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json();

    const updated = await mcpServerRegistry.updateServer(id, body);

    return NextResponse.json({
      success: true,
      server: updated,
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    return NextResponse.json(
      { success: false, error: err.message || "Failed to update MCP server" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const removed = mcpServerRegistry.unregisterServer(id);

    if (!removed) {
      return NextResponse.json(
        { success: false, error: `MCP Server '${id}' could not be removed or does not exist` },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `MCP Server '${id}' unregistered successfully`,
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    return NextResponse.json(
      { success: false, error: err.message || "Failed to unregister MCP server" },
      { status: 500 }
    );
  }
}
