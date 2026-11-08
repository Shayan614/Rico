import { NextRequest, NextResponse } from "next/server";
import { slackMCPAdapter } from "@/lib/mcp/adapters/slack";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, message, severity, serviceName, amount, budgetCeiling, channel, actionButtons } = body;

    if (!title || !message) {
      return NextResponse.json(
        { success: false, error: "Missing required parameters: 'title' and 'message'" },
        { status: 400 }
      );
    }

    const result = await slackMCPAdapter.postAlert({
      title,
      message,
      severity,
      serviceName,
      amount,
      budgetCeiling,
      channel,
      actionButtons,
    });

    return NextResponse.json({
      success: result.success,
      result,
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    return NextResponse.json(
      { success: false, error: err.message || "Failed to dispatch Slack alert" },
      { status: 500 }
    );
  }
}
