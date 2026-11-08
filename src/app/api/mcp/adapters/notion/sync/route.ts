import { NextRequest, NextResponse } from "next/server";
import { notionMCPAdapter } from "@/lib/mcp/adapters/notion";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { service, amount, currency, category, taxDeductible, databaseId, notes } = body;

    if (!service || amount === undefined) {
      return NextResponse.json(
        { success: false, error: "Missing required parameters: 'service' and 'amount'" },
        { status: 400 }
      );
    }

    const result = await notionMCPAdapter.syncExpensePage({
      service,
      amount: Number(amount),
      currency,
      category: category || "General",
      taxDeductible: Boolean(taxDeductible),
      databaseId,
      notes,
    });

    return NextResponse.json({
      success: result.success,
      result,
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    return NextResponse.json(
      { success: false, error: err.message || "Failed to sync Notion expense page" },
      { status: 500 }
    );
  }
}
