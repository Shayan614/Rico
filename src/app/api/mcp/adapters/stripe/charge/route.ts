import { NextRequest, NextResponse } from "next/server";
import { stripeMCPAdapter } from "@/lib/mcp/adapters/stripe";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { amount, serviceName, currency, budgetCeiling, customerId, paymentMethodId, idempotencyKey } = body;

    if (!amount || !serviceName) {
      return NextResponse.json(
        { success: false, error: "Missing required parameters: 'amount' and 'serviceName'" },
        { status: 400 }
      );
    }

    const result = await stripeMCPAdapter.createCharge({
      amount: Number(amount),
      serviceName,
      currency,
      budgetCeiling: budgetCeiling ? Number(budgetCeiling) : undefined,
      customerId,
      paymentMethodId,
      idempotencyKey,
    });

    return NextResponse.json({
      success: result.success,
      result,
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    return NextResponse.json(
      { success: false, error: err.message || "Failed to execute Stripe charge" },
      { status: 500 }
    );
  }
}
