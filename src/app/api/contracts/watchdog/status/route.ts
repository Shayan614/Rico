import { NextResponse } from "next/server";
import { db } from "@/db";
import { mandates } from "@/db/schema";
import { watchdogEngine } from "@/lib/watchdog";
import { ContractRenewalInput } from "@/lib/watchdog/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const allMandates = await db.select().from(mandates);

    // Convert stored mandates into watchdog inputs for automated portfolio audit
    const inputs: ContractRenewalInput[] = allMandates.map((m) => ({
      id: m.id,
      service: m.service,
      currentPrice: m.lastScrapedPrice > 0 ? m.lastScrapedPrice : m.budgetCeiling * 0.8,
      budgetCeiling: m.budgetCeiling,
      currency: m.currency,
      renewalDate: m.nextRun || new Date(Date.now() + 15 * 86400000).toISOString().split("T")[0],
      type: m.category === "Subscription" ? "MONTHLY_RECURRING" : "ANNUAL_CONTRACT",
      mandateId: m.id,
    }));

    const summary = inputs.length > 0 ? await watchdogEngine.auditBatch(inputs) : null;

    return NextResponse.json({
      success: true,
      activeMandatesCount: allMandates.length,
      portfolioAudit: summary,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    return NextResponse.json(
      { success: false, error: err.message || "Failed to retrieve watchdog status" },
      { status: 500 }
    );
  }
}
