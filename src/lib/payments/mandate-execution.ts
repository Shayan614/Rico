import crypto from "crypto";
import { and, eq, inArray } from "drizzle-orm";
import { type MandateRecord } from "@/db";
import { getPaymentLedger } from "@/lib/safety/atomic-transaction";
import { priceWorker } from "@/lib/browser";
import { executeMandatePayment, payPalOAuth, type PayPalReceipt } from "@/lib/paypal";
import { executeAtomicPaymentTransaction } from "@/lib/safety";
import { getOwnedMandate } from "@/lib/safety/mandate-access";
import { billingPeriodLabel, billingPeriodOf, mandatePeriodKey } from "@/lib/safety/billing-period";

/**
 * Manual mandate execution in two explicit steps:
 *   1. quoteMandatePayment: checks the user's own mandate and the verified price, and returns what
 *      would be charged plus a short-lived signed confirmation token. Nothing is charged.
 *   2. executeConfirmedMandatePayment: charges only with a valid token for this user, and only if
 *      the mandate, price, currency and billing period still match what the user confirmed.
 * Chat and the Run Now button both go through these. Neither ever pays without step 2.
 */

export const CONFIRMATION_TTL_MS = 5 * 60 * 1000;

export interface PaymentQuote {
  mandateId: string;
  service: string;
  amount: number;
  currency: string;
  budgetCeiling: number;
  billingPeriod: string;
  periodLabel: string;
  priceSource: string;
  confirmToken: string;
  expiresAt: number;
}

export type QuoteResult =
  | { ok: true; quote: PaymentQuote }
  | { ok: false; code: QuoteRefusal; message: string };

type QuoteRefusal =
  | "NOT_FOUND"
  | "NOT_ACTIVE"
  | "ALREADY_PAID"
  | "IN_PROGRESS"
  | "OVER_BUDGET"
  | "PRICE_UNVERIFIED"
  | "CONFIG";

export type ExecuteResult =
  | {
      ok: true;
      status: "COMPLETED";
      message: string;
      transactionId?: string;
      orderId: string;
      receipt: PayPalReceipt | null;
    }
  | {
      ok: false;
      status:
        | QuoteRefusal
        | "INVALID_CONFIRMATION"
        | "CONFIRMATION_EXPIRED"
        | "PRICE_CHANGED"
        | "BLOCKED"
        | "FAILED"
        | "NEEDS_RECONCILIATION";
      message: string;
    };

interface TokenPayload {
  v: 1;
  u: string; // owner
  m: string; // mandate
  a: number; // amount in cents
  c: string; // currency
  k: string; // billing period key
  exp: number;
}

// Without AUTH_SECRET (local mock only) tokens are signed with a per-process key.
const processSecret = crypto.randomBytes(32).toString("hex");

function signingKey(): Buffer | null {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    let realMode = false;
    try {
      realMode = payPalOAuth.getMode() === "real";
    } catch {
      return null;
    }
    if (process.env.NODE_ENV === "production" || realMode) return null;
  }
  return crypto.createHash("sha256").update(`rico-payment-confirmation:${secret || processSecret}`).digest();
}

function signToken(payload: TokenPayload, key: Buffer): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = crypto.createHmac("sha256", key).update(body).digest("base64url");
  return `${body}.${mac}`;
}

function verifyToken(token: unknown, key: Buffer): TokenPayload | null {
  if (typeof token !== "string" || token.length > 2048) return null;
  const [body, mac, extra] = token.split(".");
  if (!body || !mac || extra !== undefined) return null;
  const expected = Buffer.from(crypto.createHmac("sha256", key).update(body).digest("base64url"));
  const given = Buffer.from(mac);
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as TokenPayload;
    if (p.v !== 1 || typeof p.u !== "string" || typeof p.m !== "string" || !Number.isInteger(p.a)) return null;
    return p;
  } catch {
    return null;
  }
}

const cents = (amount: number) => Math.round(amount * 100);

/**
 * An active (PENDING or COMPLETED) charge for this mandate in the current period. The period key
 * is enforced by a unique index. Payments recorded before period keys existed (agent:, savings:,
 * alert:, hold: keys) are matched by date, so they also count for their period.
 */
async function existingPeriodCharge(key: string, mandate?: MandateRecord) {
  const { ledgerDb, ledgerTransactions: t } = getPaymentLedger();
  const [row] = await ledgerDb
    .select({ id: t.id, status: t.status })
    .from(t)
    .where(and(eq(t.idempotencyKey, key), inArray(t.status, ["PENDING", "COMPLETED"])))
    .limit(1);
  if (row || !mandate) return row;

  const current = billingPeriodLabel(mandate.recurrence);
  const legacy = await ledgerDb
    .select({ id: t.id, status: t.status, key: t.idempotencyKey, timestamp: t.timestamp, createdAt: t.createdAt })
    .from(t)
    .where(and(eq(t.mandateId, mandate.id), inArray(t.status, ["PENDING", "COMPLETED"])));
  return legacy.find((r) => {
    if (r.key?.startsWith("period:")) return false;
    const raw = r.createdAt || r.timestamp;
    let when = new Date(raw);
    if (Number.isNaN(when.getTime())) when = new Date(String(raw).replace(" ", "T") + "Z");
    return !Number.isNaN(when.getTime()) && billingPeriodLabel(mandate.recurrence, when) === current;
  });
}

function alreadyPaidMessage(mandate: MandateRecord, status: string, period: string) {
  return status === "PENDING"
    ? `A payment for ${mandate.service} in this billing period (${period}) is already in progress. No new payment was made.`
    : `${mandate.service} was already paid for this billing period (${period}). No new payment was made.`;
}

async function verifiedPrice(mandate: MandateRecord) {
  const scrape = await priceWorker.scrapeMerchantPrice(mandate.service, mandate.merchantUrl || undefined);
  if (scrape.source !== "live_browser" && payPalOAuth.getMode() === "real") {
    return { ok: false as const, message: "The merchant price could not be verified live. No payment was made." };
  }
  if (!(scrape.price > 0)) {
    return { ok: false as const, message: "No verified price is available. No payment was made." };
  }
  return { ok: true as const, price: Number(scrape.price.toFixed(2)), currency: scrape.currency || mandate.currency || "USD", source: scrape.source };
}

export async function quoteMandatePayment(mandateId: string, ownerId: string): Promise<QuoteResult> {
  const key = signingKey();
  if (!key) return { ok: false, code: "CONFIG", message: "Payment confirmation is not configured." };

  const mandate = mandateId ? await getOwnedMandate(mandateId, ownerId) : undefined;
  if (!mandate) return { ok: false, code: "NOT_FOUND", message: "Spending rule not found." };
  if (mandate.status !== "ACTIVE") {
    return { ok: false, code: "NOT_ACTIVE", message: `${mandate.service} is ${mandate.status} and cannot be run.` };
  }

  const periodKey = mandatePeriodKey(mandate);
  const periodLabel = billingPeriodLabel(mandate.recurrence);
  const existing = await existingPeriodCharge(periodKey, mandate);
  if (existing) {
    return {
      ok: false,
      code: existing.status === "PENDING" ? "IN_PROGRESS" : "ALREADY_PAID",
      message: alreadyPaidMessage(mandate, existing.status, periodLabel),
    };
  }

  const price = await verifiedPrice(mandate);
  if (!price.ok) return { ok: false, code: "PRICE_UNVERIFIED", message: price.message };
  if (price.price > mandate.budgetCeiling) {
    return {
      ok: false,
      code: "OVER_BUDGET",
      message: `${mandate.service} costs $${price.price.toFixed(2)}, above your $${mandate.budgetCeiling.toFixed(2)} budget ceiling. No payment was made.`,
    };
  }

  const expiresAt = Date.now() + CONFIRMATION_TTL_MS;
  const confirmToken = signToken(
    { v: 1, u: ownerId, m: mandate.id, a: cents(price.price), c: price.currency, k: periodKey, exp: expiresAt },
    key
  );
  return {
    ok: true,
    quote: {
      mandateId: mandate.id,
      service: mandate.service,
      amount: price.price,
      currency: price.currency,
      budgetCeiling: mandate.budgetCeiling,
      billingPeriod: billingPeriodOf(mandate.recurrence),
      periodLabel,
      priceSource: price.source,
      confirmToken,
      expiresAt,
    },
  };
}

export async function executeConfirmedMandatePayment(
  confirmToken: unknown,
  ownerId: string,
  fundingRail: "PAYPAL" | "VISA" = "PAYPAL"
): Promise<ExecuteResult> {
  const key = signingKey();
  if (!key) return { ok: false, status: "CONFIG", message: "Payment confirmation is not configured." };

  const token = verifyToken(confirmToken, key);
  // A token for another user is treated exactly like a forged one.
  if (!token || token.u !== ownerId) {
    return { ok: false, status: "INVALID_CONFIRMATION", message: "This confirmation is not valid. No payment was made." };
  }
  if (token.exp < Date.now()) {
    return { ok: false, status: "CONFIRMATION_EXPIRED", message: "This confirmation has expired. Please review the payment again. No payment was made." };
  }

  const mandate = await getOwnedMandate(token.m, ownerId);
  if (!mandate) return { ok: false, status: "NOT_FOUND", message: "Spending rule not found. No payment was made." };
  if (mandate.status !== "ACTIVE") {
    return { ok: false, status: "NOT_ACTIVE", message: `${mandate.service} is ${mandate.status}. No payment was made.` };
  }

  const periodKey = mandatePeriodKey(mandate);
  const periodLabel = billingPeriodLabel(mandate.recurrence);
  if (periodKey !== token.k) {
    return { ok: false, status: "CONFIRMATION_EXPIRED", message: "The billing period has changed since you confirmed. Please review the payment again. No payment was made." };
  }
  const existing = await existingPeriodCharge(periodKey, mandate);
  if (existing) {
    return {
      ok: false,
      status: existing.status === "PENDING" ? "IN_PROGRESS" : "ALREADY_PAID",
      message: alreadyPaidMessage(mandate, existing.status, periodLabel),
    };
  }

  // The confirmed amount must still be the verified price and within the stored ceiling.
  const price = await verifiedPrice(mandate);
  if (!price.ok) return { ok: false, status: "PRICE_UNVERIFIED", message: price.message };
  if (cents(price.price) !== token.a || price.currency !== token.c) {
    return {
      ok: false,
      status: "PRICE_CHANGED",
      message: `The price of ${mandate.service} changed from $${(token.a / 100).toFixed(2)} to $${price.price.toFixed(2)}. Please review it again. No payment was made.`,
    };
  }
  if (price.price > mandate.budgetCeiling) {
    return { ok: false, status: "OVER_BUDGET", message: `$${price.price.toFixed(2)} exceeds the $${mandate.budgetCeiling.toFixed(2)} budget ceiling. No payment was made.` };
  }

  const result = await executeAtomicPaymentTransaction({
    mandateId: mandate.id,
    ownerId,
    orderId: `ORD-${Date.now()}`,
    idempotencyKey: periodKey,
    serviceName: mandate.service,
    amount: price.price,
    currency: price.currency,
    budgetCeiling: mandate.budgetCeiling,
    allowedMandateStatuses: ["ACTIVE"],
    auditDetails: `User-confirmed payment: ${mandate.service} $${price.price.toFixed(2)} ${price.currency} for billing period ${periodLabel}.`,
    auditMetadata: { source: "user_confirmed_execution", billingPeriod: periodLabel, fundingRail },
    executePaymentFn: () =>
      executeMandatePayment({
        serviceName: mandate.service,
        verifiedPrice: price.price,
        budgetCeiling: mandate.budgetCeiling,
        currency: price.currency,
        mandateId: mandate.id,
        fundingRail,
        paymentAttemptKey: periodKey,
      }),
  });

  if (result.success) {
    return {
      ok: true,
      status: "COMPLETED",
      message: `Paid $${price.price.toFixed(2)} ${price.currency} for ${mandate.service} (billing period ${periodLabel}).`,
      transactionId: result.transactionId,
      orderId: result.orderId,
      receipt: (result.receiptData as unknown as PayPalReceipt) ?? null,
    };
  }

  if (result.status === "NEEDS_RECONCILIATION") {
    return { ok: false, status: "NEEDS_RECONCILIATION", message: result.message };
  }
  // A concurrent request may have taken the period first: report that clearly.
  const raced = await existingPeriodCharge(periodKey, mandate);
  if (raced) {
    return {
      ok: false,
      status: raced.status === "PENDING" ? "IN_PROGRESS" : "ALREADY_PAID",
      message: alreadyPaidMessage(mandate, raced.status, periodLabel),
    };
  }
  return { ok: false, status: result.status === "BLOCKED" ? "BLOCKED" : "FAILED", message: result.message };
}
