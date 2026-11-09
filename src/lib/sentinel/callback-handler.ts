import { db, mandates, auditLogs } from "@/db";
import { and, eq } from "drizzle-orm";
import { executeMandatePayment } from "@/lib/paypal";
import { executeAtomicPaymentTransaction } from "@/lib/safety/atomic-transaction";
import { mandatePeriodKey } from "@/lib/safety/billing-period";
import { posthogServer } from "@/lib/telemetry/posthog-server";
import { omnichannelAlertStore } from "./omnichannel";
import { RemoteActionResult } from "./types";

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Executes remote omnichannel button actions triggered via Telegram webhook,
 * WhatsApp callback, Slack action, or the interactive simulator UI.
 */
export async function handleRemoteAction(params: {
  action: "approve" | "backup_card" | "cancel";
  mandateId: string;
  alertId?: string;
  /** The verified user acting. Never taken from the request body. */
  ownerId: string;
}): Promise<RemoteActionResult> {
  const { action, mandateId, alertId, ownerId } = params;

  // 1. Fetch mandate from SQLite database
  const [mandate] = await db
    .select()
    .from(mandates)
    .where(and(eq(mandates.id, mandateId), eq(mandates.ownerId, ownerId)))
    .limit(1);

  if (!mandate) {
    throw new Error(`Mandate not found with id: ${mandateId}`);
  }

  const alert = alertId ? omnichannelAlertStore.getAlert(alertId) : undefined;
  // Only server-recorded prices: the alert's, or the price Sentinel stored with the hold.
  const executionPrice = alert?.newPrice ?? mandate.lastScrapedPrice;

  const timestamp = new Date().toISOString();

  // 2. Action: 1-Click Cancel Subscription
  if (action === "cancel") {
    // Update mandate status to PAUSED in SQLite
    await db.update(mandates)
      .set({
        status: "PAUSED",
        updatedAt: timestamp,
      })
      .where(and(eq(mandates.id, mandateId), eq(mandates.ownerId, ownerId)));

    const logId = generateId("log");
    const detailMsg = `Subscription cancelled & mandate paused via Omnichannel Remote Action (Telegram/WhatsApp). No payment was captured.`;

    await db.insert(auditLogs)
      .values({
        id: logId,
        mandateId: mandate.id,
        eventType: "GUARDRAIL_BLOCKED",
        service: mandate.service,
        details: detailMsg,
        severity: "warning",
        metadata: {
          action: "cancel",
          source: "omnichannel_remote_callback",
          alertId,
        },
      });

    if (alertId) {
      omnichannelAlertStore.resolveAlert(alertId, "cancel");
    }

    return {
      success: true,
      action: "cancel",
      mandateId,
      service: mandate.service,
      alertId,
      mandateStatus: "PAUSED",
      message: `🛑 Subscription cancelled. Mandate for ${mandate.service} is now paused.`,
      timestamp,
    };
  }

  // 3. Actions: Approve (primary wallet) or Pay with Backup Card (Visa via PayPal Vault)
  const refuse = (message: string): RemoteActionResult => ({
    success: false,
    action,
    mandateId,
    service: mandate.service,
    alertId,
    mandateStatus: mandate.status,
    message,
    timestamp,
  });

  if (alertId && (!alert || alert.mandateId !== mandateId)) {
    return refuse("This alert could not be verified for this mandate. No payment was made.");
  }
  if (alert && alert.status !== "PENDING") {
    return refuse("This alert has already been resolved. No payment was made.");
  }
  if (!alert && mandate.status !== "ANOMALY_HOLD") {
    return refuse("This mandate has no payment awaiting approval. No payment was made.");
  }
  if (!(executionPrice > 0)) {
    return refuse("No verified price is available. No payment was made.");
  }

  const isBackupCard = action === "backup_card";
  const fundingRail = isBackupCard ? "VISA" : "PAYPAL";
  // Both buttons, every alert and every hold share the mandate's billing-period key, so approvals
  // can never add a second charge for the same period.
  const idempotencyKey = mandatePeriodKey(mandate);

  const atomicResult = await executeAtomicPaymentTransaction({
    mandateId: mandate.id,
    ownerId,
    orderId: `ORD-${Date.now()}`,
    idempotencyKey,
    serviceName: mandate.service,
    amount: executionPrice,
    currency: mandate.currency || "USD",
    budgetCeiling: mandate.budgetCeiling,
    allowedMandateStatuses: alert ? ["ACTIVE", "ANOMALY_HOLD"] : ["ANOMALY_HOLD"],
    mandateStatusOnCommit: "ACTIVE",
    auditDetails: isBackupCard
      ? `Remote Payment Approved: Charged $${executionPrice.toFixed(
          2
        )} to Vaulted Backup Card (Visa •••• 4242) via PayPal Vault on remote button tap. Mandate restored to ACTIVE.`
      : `Remote Payment Approved: Captured $${executionPrice.toFixed(
          2
        )} via PayPal Sandbox Wallet on remote button tap. Mandate restored to ACTIVE.`,
    auditMetadata: { action, fundingRail, source: "omnichannel_remote_callback", alertId },
    executePaymentFn: async () => {
      const payment = await executeMandatePayment({
        serviceName: mandate.service,
        verifiedPrice: executionPrice,
        budgetCeiling: mandate.budgetCeiling,
        currency: mandate.currency || "USD",
        mandateId: mandate.id,
        fundingRail,
        paymentAttemptKey: idempotencyKey,
      });
      return { ...payment, receipt: { ...payment.receipt, fundingRail } };
    },
  });

  if (!atomicResult.success) {
    return refuse(atomicResult.message);
  }

  await posthogServer.trackPaymentCompleted({
    service: mandate.service,
    amount: executionPrice,
    orderId: atomicResult.orderId,
    budgetCeiling: mandate.budgetCeiling,
    savingsEnforced: 0,
    paymentMethod: isBackupCard ? "Vaulted Backup Card (Visa •••• 4242)" : "PayPal Sandbox MCP Wallet",
  });

  if (alertId) {
    omnichannelAlertStore.resolveAlert(alertId, action, {
      orderId: atomicResult.orderId,
      transactionId: atomicResult.transactionId,
    });
  }

  return {
    success: true,
    action,
    mandateId,
    service: mandate.service,
    alertId,
    amount: executionPrice,
    orderId: atomicResult.orderId,
    captureId: atomicResult.captureId,
    fundingRail,
    mandateStatus: "ACTIVE",
    message: isBackupCard
      ? `💳 Charged $${executionPrice.toFixed(2)} to backup Visa (PayPal Vault). Mandate for ${mandate.service} is ACTIVE.`
      : `✅ Approved! PayPal payment of $${executionPrice.toFixed(2)} captured. Mandate for ${mandate.service} is ACTIVE.`,
    timestamp,
  };
}
