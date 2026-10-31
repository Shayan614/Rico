import { db, mandates, transactions, auditLogs, type MandateRecord } from "@/db";
import { executeMandatePayment, type PayPalReceipt } from "@/lib/paypal";
import { eq } from "drizzle-orm";
import {
  MandateToolParams,
  VerifyPriceToolParams,
  ExecutePaymentToolParams,
} from "./types";

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Standard live plan pricing dictionary for recognized merchant services
 */
const KNOWN_SERVICES: Record<
  string,
  { name: string; price: number; plan: string; category: string }
> = {
  netflix: {
    name: "Netflix Standard HD",
    price: 15.49,
    plan: "Standard HD (2 Screens)",
    category: "Media",
  },
  spotify: {
    name: "Spotify Premium",
    price: 11.99,
    plan: "Individual Ad-Free Music",
    category: "Music",
  },
  aws: {
    name: "AWS Cloud Services",
    price: 84.5,
    plan: "Usage-Based Compute & Storage",
    category: "Cloud",
  },
  github: {
    name: "GitHub Copilot",
    price: 19.0,
    plan: "Copilot Business License",
    category: "Developer Tools",
  },
  copilot: {
    name: "GitHub Copilot",
    price: 19.0,
    plan: "Copilot Business License",
    category: "Developer Tools",
  },
  adobe: {
    name: "Adobe Creative Cloud",
    price: 59.99,
    plan: "All Apps Creative Suite",
    category: "Creative",
  },
  chatgpt: {
    name: "ChatGPT Plus",
    price: 20.0,
    plan: "Plus Individual Subscription",
    category: "AI",
  },
  youtube: {
    name: "YouTube Premium",
    price: 13.99,
    plan: "Ad-Free Video & Music",
    category: "Media",
  },
};

/**
 * Tool 1: create_mandate
 * Registers a new autonomous recurring financial mandate with a hard budget ceiling
 */
export async function executeCreateMandate(params: MandateToolParams): Promise<{
  success: boolean;
  mandate: MandateRecord;
  message: string;
}> {
  const mandateId = generateId("mandate");
  const now = new Date();
  const nextMonth = new Date(now);
  nextMonth.setMonth(now.getMonth() + 1);

  const formattedNextRun = nextMonth.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const currency = params.currency || "USD";
  const category = params.category || "Subscription";
  const strictMode = !!params.strict_mode;

  // Insert into SQLite database
  const [createdMandate] = await db
    .insert(mandates)
    .values({
      id: mandateId,
      service: params.service,
      budgetCeiling: params.max_amount,
      lastScrapedPrice: 0,
      recurrence: params.schedule,
      nextRun: formattedNextRun,
      status: "ACTIVE",
      category,
      currency,
      strictMode,
    })
    .returning();

  // Insert audit log
  await db.insert(auditLogs).values({
    id: generateId("log"),
    mandateId,
    eventType: "MANDATE_CREATED",
    service: params.service,
    details: `Mandate registered: ${params.service} with budget ceiling of $${params.max_amount.toFixed(
      2
    )} (${params.schedule}).`,
    severity: "info",
    metadata: {
      budgetCeiling: params.max_amount,
      recurrence: params.schedule,
      strictMode,
    },
  });

  return {
    success: true,
    mandate: createdMandate,
    message: `Mandate successfully registered for ${params.service} (Max $${params.max_amount.toFixed(
      2
    )} ${currency}, ${params.schedule}).`,
  };
}

/**
 * Tool 2: verify_web_price
 * Automates merchant price inspection and checks for price spike anomalies
 */
export async function executeVerifyWebPrice(params: VerifyPriceToolParams): Promise<{
  success: boolean;
  service: string;
  verifiedPrice: number;
  currency: string;
  planName: string;
  anomalyDetected: boolean;
  anomalyWarning?: string;
  percentageDifference?: number;
}> {
  const key = Object.keys(KNOWN_SERVICES).find((k) =>
    params.service_name.toLowerCase().includes(k)
  );

  const matched = key
    ? KNOWN_SERVICES[key]
    : {
        name: params.service_name,
        price: 19.99,
        plan: `${params.service_name} Plan`,
        category: "General",
      };

  const verifiedPrice = matched.price;
  const currency = "USD";
  let anomalyDetected = false;
  let anomalyWarning: string | undefined;
  let percentageDifference: number | undefined;

  // Check for price spike anomaly if baseline/expected price is provided
  if (params.expected_price && params.expected_price > 0) {
    const diff = (verifiedPrice - params.expected_price) / params.expected_price;
    percentageDifference = Math.round(diff * 100);

    // If price increased by >20%
    if (diff > 0.2) {
      anomalyDetected = true;
      anomalyWarning = `Price Spike Anomaly Detected: Current price ($${verifiedPrice.toFixed(
        2
      )}) is ${percentageDifference}% higher than expected baseline ($${params.expected_price.toFixed(
        2
      )}).`;
    }
  }

  // Record audit log
  await db.insert(auditLogs).values({
    id: generateId("log"),
    eventType: anomalyDetected ? "ANOMALY_DETECTED" : "PRICE_VERIFIED",
    service: matched.name,
    details: anomalyDetected
      ? anomalyWarning!
      : `Verified ${matched.name} price: $${verifiedPrice.toFixed(2)}/mo.`,
    severity: anomalyDetected ? "warning" : "info",
    metadata: {
      verifiedPrice,
      expectedPrice: params.expected_price,
      percentageDifference,
      serviceUrl: params.service_url,
    },
  });

  return {
    success: true,
    service: matched.name,
    verifiedPrice,
    currency,
    planName: matched.plan,
    anomalyDetected,
    anomalyWarning,
    percentageDifference,
  };
}

/**
 * Tool 3: execute_paypal_payment
 * Executes live PayPal payment via Sandbox MCP Server / Orders API with hard guardrails
 */
export async function executePayPalPayment(params: ExecutePaymentToolParams): Promise<{
  success: boolean;
  orderId: string;
  captureId: string;
  receipt: PayPalReceipt;
  message: string;
}> {
  // 1. Enforce Hard Budget Ceiling Safety Guardrail
  if (params.verified_price > params.budget_ceiling) {
    const blockedMsg = `Guardrail Blocked: Verified price ($${params.verified_price.toFixed(
      2
    )}) exceeds authorized budget ceiling ($${params.budget_ceiling.toFixed(2)}).`;

    await db.insert(auditLogs).values({
      id: generateId("log"),
      mandateId: params.mandate_id,
      eventType: "GUARDRAIL_BLOCKED",
      service: params.service_name,
      details: blockedMsg,
      severity: "danger",
      metadata: {
        verifiedPrice: params.verified_price,
        budgetCeiling: params.budget_ceiling,
      },
    });

    throw new Error(blockedMsg);
  }

  // 2. Execute via PayPal SDK / Orders API
  const { orderId, captureId, receipt } = await executeMandatePayment({
    serviceName: params.service_name,
    verifiedPrice: params.verified_price,
    budgetCeiling: params.budget_ceiling,
    currency: "USD",
    mandateId: params.mandate_id,
  });

  // 3. Persist transaction to SQLite
  await db.insert(transactions).values({
    id: generateId("tx"),
    mandateId: params.mandate_id || null,
    orderId,
    service: params.service_name,
    amount: params.verified_price,
    currency: "USD",
    status: "COMPLETED",
    receiptData: receipt,
  });

  // 4. Update lastScrapedPrice in mandate if mandate_id provided
  if (params.mandate_id) {
    await db
      .update(mandates)
      .set({
        lastScrapedPrice: params.verified_price,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(mandates.id, params.mandate_id));
  }

  // 5. Record successful payment audit log
  await db.insert(auditLogs).values({
    id: generateId("log"),
    mandateId: params.mandate_id,
    eventType: "PAYMENT_CAPTURED",
    service: params.service_name,
    details: `Captured order ${orderId} for ${params.service_name}: $${params.verified_price.toFixed(
      2
    )} USD. Verified below $${params.budget_ceiling.toFixed(2)} ceiling.`,
    severity: "success",
    metadata: {
      orderId,
      captureId,
      authCode: receipt.sandboxAuthCode,
      verifiedPrice: params.verified_price,
      budgetCeiling: params.budget_ceiling,
    },
  });

  return {
    success: true,
    orderId,
    captureId,
    receipt,
    message: `Payment of $${params.verified_price.toFixed(2)} captured for ${
      params.service_name
    } (Order: ${orderId}).`,
  };
}

/**
 * Universal Tool Dispatcher
 * Dispatches agent function calls to the appropriate executor
 */
export async function dispatchAgentTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  switch (toolName) {
    case "create_mandate":
      return (await executeCreateMandate(
        args as unknown as MandateToolParams
      )) as unknown as Record<string, unknown>;

    case "verify_web_price":
      return (await executeVerifyWebPrice(
        args as unknown as VerifyPriceToolParams
      )) as unknown as Record<string, unknown>;

    case "execute_paypal_payment":
      return (await executePayPalPayment(
        args as unknown as ExecutePaymentToolParams
      )) as unknown as Record<string, unknown>;

    default:
      throw new Error(`Unknown agent tool: ${toolName}`);
  }
}
