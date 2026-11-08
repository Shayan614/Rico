import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { mandates, auditLogs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { omnichannelAlertStore } from "@/lib/sentinel";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { mandateId, service, action, reason } = body;

    if (!mandateId && !service) {
      return NextResponse.json(
        { success: false, error: "Missing required parameter: 'mandateId' or 'service'" },
        { status: 400 }
      );
    }

    let updatedMandate = null;

    if (mandateId) {
      if (action === "PAUSE_MANDATE" || action === "CANCEL_TRIAL") {
        await db
          .update(mandates)
          .set({ status: "PAUSED", updatedAt: new Date().toISOString() })
          .where(eq(mandates.id, mandateId));

        const records = await db
          .select()
          .from(mandates)
          .where(eq(mandates.id, mandateId));
        updatedMandate = records[0];
      }
    }

    // Log to audit logs
    const logId = `audit_rem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    await db.insert(auditLogs).values({
      id: logId,
      mandateId: mandateId || null,
      eventType: "ANOMALY_DETECTED",
      service: service || updatedMandate?.service || "ContractWatchdog",
      details: `Watchdog remediation applied: action=${action || "PAUSE_MANDATE"}. Reason: ${reason || "Budget risk or trial expiry"}`,
      severity: "warning",
      metadata: {
        action,
        reason,
        mandateId,
      },
    });

    // Save alert in omnichannel alert store
    if (mandateId) {
      omnichannelAlertStore.saveAlert({
        id: `alert_wd_${Date.now()}`,
        mandateId,
        service: service || updatedMandate?.service || "ContractWatchdog",
        oldPrice: updatedMandate?.lastScrapedPrice || 0,
        newPrice: updatedMandate?.budgetCeiling || 0,
        jumpPercent: 0,
        budgetCeiling: updatedMandate?.budgetCeiling || 0,
        currency: updatedMandate?.currency || "USD",
        channel: "slack",
        status: "APPROVED",
        timestamp: new Date().toISOString(),
        message: `Watchdog remediation action ${action} executed successfully.`,
      });
    }

    return NextResponse.json({
      success: true,
      action: action || "PAUSE_MANDATE",
      mandate: updatedMandate,
      remediatedAt: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    return NextResponse.json(
      { success: false, error: err.message || "Failed to execute watchdog remediation" },
      { status: 500 }
    );
  }
}
