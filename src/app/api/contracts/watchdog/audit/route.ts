import { NextRequest, NextResponse } from "next/server";
import { watchdogEngine } from "@/lib/watchdog";
import { ContractRenewalInput } from "@/lib/watchdog/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { items, contract, priority } = body;

    // 1. Batch audit mode
    if (Array.isArray(items)) {
      const summary = await watchdogEngine.auditBatch(items, { priority });
      return NextResponse.json({
        success: true,
        mode: "BATCH",
        summary,
      });
    }

    // 2. Single contract audit mode
    const targetInput: ContractRenewalInput = contract || body;

    if (!targetInput.service || !targetInput.renewalDate) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required parameters: 'service' and 'renewalDate'",
        },
        { status: 400 }
      );
    }

    const audit = await watchdogEngine.auditContract(targetInput);

    return NextResponse.json({
      success: true,
      mode: "SINGLE",
      audit,
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    return NextResponse.json(
      { success: false, error: err.message || "Failed to audit contract" },
      { status: 500 }
    );
  }
}
