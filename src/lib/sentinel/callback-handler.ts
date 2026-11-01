import { db, mandates, transactions, auditLogs } from "@/db";
import { eq } from "drizzle-orm";
import { executeMandatePayment } from "@/lib/paypal";
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
  overridePrice?: number;
}): Promise<RemoteActionResult> {
  const { action, mandateId, alertId, overridePrice } = params;

  // 1. Fetch mandate from SQLite database
  const mandate = db
    .select()
    .from(mandates)
    .where(eq(mandates.id, mandateId))
    .get();

  if (!mandate) {
    throw new Error(`Mandate not found with id: ${mandateId}`);
  }

  const alert = alertId ? omnichannelAlertStore.getAlert(alertId) : undefined;
  const executionPrice =
    overridePrice ??
    alert?.newPrice ??
    (mandate.lastScrapedPrice > 0 ? mandate.lastScrapedPrice : mandate.budgetCeiling);

  const timestamp = new Date().toISOString();

  // 2. Action: 1-Click Cancel Subscription
  if (action === "cancel") {
    // Update mandate status to PAUSED in SQLite
    db.update(mandates)
      .set({
        status: "PAUSED",
        updatedAt: timestamp,
      })
      .where(eq(mandates.id, mandateId))
      .run();

    const logId = generateId("log");
    const detailMsg = `Subscription cancelled & mandate paused via Omnichannel Remote Action (Telegram/WhatsApp). No payment was captured.`;

    db.insert(auditLogs)
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
      })
      .run();

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

  // 3. Action: Pay with Backup Card (Visa via PayPal Vault)
  if (action === "backup_card") {
    const paymentResult = await executeMandatePayment({
      serviceName: mandate.service,
      verifiedPrice: executionPrice,
      budgetCeiling: Math.max(executionPrice, mandate.budgetCeiling),
      mandateId: mandate.id,
      fundingRail: "VISA",
    });

    const txId = generateId("tx");
    db.insert(transactions)
      .values({
        id: txId,
        mandateId: mandate.id,
        orderId: paymentResult.orderId,
        service: mandate.service,
        amount: executionPrice,
        currency: mandate.currency || "USD",
        status: "COMPLETED",
        receiptData: {
          ...paymentResult.receipt,
          fundingRail: "VISA",
        },
      })
      .run();

    // Restore mandate status back to ACTIVE and record verified price
    db.update(mandates)
      .set({
        status: "ACTIVE",
        lastScrapedPrice: executionPrice,
        updatedAt: timestamp,
      })
      .where(eq(mandates.id, mandateId))
      .run();

    const logId = generateId("log");
    const detailMsg = `Remote Payment Approved: Charged $${executionPrice.toFixed(
      2
    )} to Vaulted Backup Card (Visa •••• 4242) via PayPal Vault on remote button tap. Mandate restored to ACTIVE.`;

    db.insert(auditLogs)
      .values({
        id: logId,
        mandateId: mandate.id,
        eventType: "PAYMENT_CAPTURED",
        service: mandate.service,
        details: detailMsg,
        severity: "success",
        metadata: {
          action: "backup_card",
          fundingRail: "VISA",
          orderId: paymentResult.orderId,
          captureId: paymentResult.captureId,
          amount: executionPrice,
          source: "omnichannel_remote_callback",
        },
      })
      .run();

    await posthogServer.trackPaymentCompleted({
      service: mandate.service,
      amount: executionPrice,
      orderId: paymentResult.orderId,
      budgetCeiling: Math.max(executionPrice, mandate.budgetCeiling),
      savingsEnforced: 0,
      paymentMethod: "Vaulted Backup Card (Visa •••• 4242)",
    });

    if (alertId) {
      omnichannelAlertStore.resolveAlert(alertId, "backup_card", {
        orderId: paymentResult.orderId,
        transactionId: txId,
      });
    }

    return {
      success: true,
      action: "backup_card",
      mandateId,
      service: mandate.service,
      alertId,
      amount: executionPrice,
      orderId: paymentResult.orderId,
      captureId: paymentResult.captureId,
      fundingRail: "VISA",
      mandateStatus: "ACTIVE",
      message: `💳 Charged $${executionPrice.toFixed(
        2
      )} to backup Visa (PayPal Vault). Mandate for ${mandate.service} is ACTIVE.`,
      timestamp,
    };
  }

  // 4. Action: Approve One-Time (Primary PayPal Sandbox Wallet)
  const paymentResult = await executeMandatePayment({
    serviceName: mandate.service,
    verifiedPrice: executionPrice,
    budgetCeiling: Math.max(executionPrice, mandate.budgetCeiling),
    mandateId: mandate.id,
    fundingRail: "PAYPAL",
  });

  const txId = generateId("tx");
  db.insert(transactions)
    .values({
      id: txId,
      mandateId: mandate.id,
      orderId: paymentResult.orderId,
      service: mandate.service,
      amount: executionPrice,
      currency: mandate.currency || "USD",
      status: "COMPLETED",
      receiptData: {
        ...paymentResult.receipt,
        fundingRail: "PAYPAL",
      },
    })
    .run();

  // Restore mandate status back to ACTIVE and record verified price
  db.update(mandates)
    .set({
      status: "ACTIVE",
      lastScrapedPrice: executionPrice,
      updatedAt: timestamp,
    })
    .where(eq(mandates.id, mandateId))
    .run();

  const logId = generateId("log");
  const detailMsg = `Remote Payment Approved: Captured $${executionPrice.toFixed(
    2
  )} via PayPal Sandbox Wallet on remote button tap. Mandate restored to ACTIVE.`;

  db.insert(auditLogs)
    .values({
      id: logId,
      mandateId: mandate.id,
      eventType: "PAYMENT_CAPTURED",
      service: mandate.service,
      details: detailMsg,
      severity: "success",
      metadata: {
        action: "approve",
        fundingRail: "PAYPAL",
        orderId: paymentResult.orderId,
        captureId: paymentResult.captureId,
        amount: executionPrice,
        source: "omnichannel_remote_callback",
      },
    })
    .run();

  await posthogServer.trackPaymentCompleted({
    service: mandate.service,
    amount: executionPrice,
    orderId: paymentResult.orderId,
    budgetCeiling: Math.max(executionPrice, mandate.budgetCeiling),
    savingsEnforced: 0,
    paymentMethod: "PayPal Sandbox MCP Wallet",
  });

  if (alertId) {
    omnichannelAlertStore.resolveAlert(alertId, "approve", {
      orderId: paymentResult.orderId,
      transactionId: txId,
    });
  }

  return {
    success: true,
    action: "approve",
    mandateId,
    service: mandate.service,
    alertId,
    amount: executionPrice,
    orderId: paymentResult.orderId,
    captureId: paymentResult.captureId,
    fundingRail: "PAYPAL",
    mandateStatus: "ACTIVE",
    message: `✅ Approved! PayPal payment of $${executionPrice.toFixed(
      2
    )} captured. Mandate for ${mandate.service} is ACTIVE.`,
    timestamp,
  };
}
