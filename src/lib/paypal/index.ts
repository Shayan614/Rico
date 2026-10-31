export * from "./types";
export * from "./oauth";
export * from "./orders";
export * from "./mcp-client";

import { payPalOrders } from "./orders";
import { PayPalReceipt } from "./types";

/**
 * High-level helper to execute an autonomous payment mandate
 */
export async function executeMandatePayment(params: {
  serviceName: string;
  verifiedPrice: number;
  budgetCeiling: number;
  currency?: string;
  mandateId?: string;
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
  });

  // 2. Capture Order
  const { capture, receipt } = await payPalOrders.captureOrder(order.id, {
    serviceName: params.serviceName,
    verifiedPrice: params.verifiedPrice,
    budgetCeiling: params.budgetCeiling,
  });

  return {
    success: true,
    orderId: order.id,
    captureId: capture.id,
    receipt,
  };
}
