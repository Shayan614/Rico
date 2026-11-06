import { db, mandates, auditLogs, type MandateRecord } from "@/db";
import { executeMandatePayment, type PayPalReceipt } from "@/lib/paypal";
import { priceWorker } from "@/lib/browser";
import { personaSavingsOptimizer } from "@/lib/savings";
import { executeAtomicPaymentTransaction } from "@/lib/safety";
import {
  MandateToolParams,
  VerifyPriceToolParams,
  ExecutePaymentToolParams,
} from "./types";

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

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
  // Execute real Playwright browser scraping worker
  const scrapeResult = await priceWorker.scrapeMerchantPrice(
    params.service_name,
    params.service_url
  );

  const verifiedPrice = scrapeResult.price;
  const currency = scrapeResult.currency || "USD";
  const planName = scrapeResult.planName;
  const service = scrapeResult.service;

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
    service: service,
    details: anomalyDetected
      ? anomalyWarning!
      : `Verified ${service} price: $${verifiedPrice.toFixed(2)}/mo (${scrapeResult.source}).`,
    severity: anomalyDetected ? "warning" : "info",
    metadata: {
      verifiedPrice,
      expectedPrice: params.expected_price,
      percentageDifference,
      serviceUrl: params.service_url || scrapeResult.url,
      source: scrapeResult.source,
      confidence: scrapeResult.confidence,
    },
  });

  return {
    success: true,
    service: service,
    verifiedPrice,
    currency,
    planName: planName,
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
  const tempOrderId = `ORD-${Date.now()}`;

  // Execute payment wrapped in the Atomic Transaction Wrapper & Double-Billing Guard
  const atomicResult = await executeAtomicPaymentTransaction({
    mandateId: params.mandate_id,
    orderId: tempOrderId,
    serviceName: params.service_name,
    amount: params.verified_price,
    budgetCeiling: params.budget_ceiling,
    currency: "USD",
    executePaymentFn: async () => {
      const res = await executeMandatePayment({
        serviceName: params.service_name,
        verifiedPrice: params.verified_price,
        budgetCeiling: params.budget_ceiling,
        currency: "USD",
        mandateId: params.mandate_id,
        fundingRail: params.funding_rail || "AUTO",
      });
      return res;
    },
  });

  if (!atomicResult.success) {
    throw new Error(atomicResult.message);
  }

  const receipt = (atomicResult.receiptData as unknown as PayPalReceipt) || null;
  const orderId = atomicResult.orderId;
  const captureId = receipt?.captureId || receipt?.sandboxAuthCode || "";

  return {
    success: true,
    orderId,
    captureId,
    receipt,
    message: atomicResult.message,
  };
}

export async function executeCompareMultiServicePrices(params: {
  services: string[];
  category?: string;
}): Promise<Record<string, unknown>> {
  const targets = (params.services || ["Netflix", "Spotify"]).map((s) => ({ service: s }));
  const result = await priceWorker.executeParallelPriceVerification(targets);

  await db.insert(auditLogs).values({
    id: generateId("log"),
    eventType: "PRICE_VERIFIED",
    service: targets.map((t) => t.service).join(", "),
    details: `Parallel Helper Bots checked ${result.bots.length} merchants simultaneously. Lowest price: ${
      result.bestDeal ? `${result.bestDeal.service} ($${result.bestDeal.price.toFixed(2)})` : "Verified"
    }.`,
    severity: "info",
    metadata: {
      batchId: result.batchId,
      botCount: result.bots.length,
      bestDeal: result.bestDeal,
      type: "PARALLEL_VERIFICATION",
    },
  });

  return {
    success: true,
    comparison: result,
    bestDeal: result.bestDeal,
    summary: `Parallel Helper Bots verified ${result.bots.length} merchants simultaneously. Best rate: ${result.bestDeal?.service} at $${result.bestDeal?.price.toFixed(2)}/mo.`,
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

    case "compare_multi_service_prices":
      return await executeCompareMultiServicePrices(
        args as unknown as { services: string[]; category?: string }
      );

    case "check_persona_savings":
      return (await personaSavingsOptimizer.probePersonaSavings({
        serviceName: String(args.service_name || ""),
        currentPrice: Number(args.current_price || 0),
        persona: (args.persona as "STARTUP_FOUNDER" | "STUDENT" | "DEVELOPER_SMB") || undefined,
        mandateId: args.mandate_id ? String(args.mandate_id) : undefined,
      })) as unknown as Record<string, unknown>;

    case "execute_paypal_payment":
      return (await executePayPalPayment(
        args as unknown as ExecutePaymentToolParams
      )) as unknown as Record<string, unknown>;

    default:
      throw new Error(`Unknown agent tool: ${toolName}`);
  }
}

