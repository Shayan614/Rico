export * from "./types";
export * from "./errors";
export * from "./oauth";
export * from "./orders";
export * from "./mcp-client";
export * from "./vault";

import { payPalOrders } from "./orders";
import { PayPalReceipt, FundingRail } from "./types";

/**
 * High-level helper to execute an autonomous payment mandate via Dual-Rail Rails
 */
export async function executeMandatePayment(params: {
  serviceName: string;
  verifiedPrice: number;
  budgetCeiling: number;
  currency?: string;
  mandateId?: string;
  fundingRail?: FundingRail | "AUTO";
  simulateDeclinePrimary?: boolean;
  paymentAttemptKey?: string;
}): Promise<{
  success: boolean;
  orderId: string;
  captureId: string;
  receipt: PayPalReceipt;
}> {
  // Safety guardrail check
  if (params.verifiedPrice > params.budgetCeiling) {
    throw new Error(
      `Guardrail blocked: Verified price ($${params.verifiedPrice.toFixed(
        2
      )}) exceeds authorized budget ceiling ($${params.budgetCeiling.toFixed(2)}).`
    );
  }

  // 1. Create Order via PayPal Orders API / MCP
  const order = await payPalOrders.createOrder({
    amount: params.verifiedPrice,
    currency: params.currency || "USD",
    serviceName: params.serviceName,
    mandateId: params.mandateId,
    fundingRail: params.fundingRail || "AUTO",
    paymentAttemptKey: params.paymentAttemptKey,
  });

  // 2. Capture Order with Dual-Rail Vault routing
  const { capture, receipt } = await payPalOrders.captureOrder(order.id, {
    serviceName: params.serviceName,
    verifiedPrice: params.verifiedPrice,
    budgetCeiling: params.budgetCeiling,
    fundingRail: params.fundingRail || "AUTO",
    simulateDeclinePrimary: params.simulateDeclinePrimary,
    paymentAttemptKey: params.paymentAttemptKey,
  });

  return {
    success: true,
    orderId: order.id,
    captureId: capture.id,
    receipt,
  };
}
