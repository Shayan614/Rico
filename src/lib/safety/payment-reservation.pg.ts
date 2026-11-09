/**
 * PostgreSQL payment reservation and finalization. Not wired into the running app.
 *
 * Sequence: reserve a PENDING row (commit) -> call PayPal with no transaction open
 * -> finalize in one transaction. The database cannot reverse a PayPal capture, so
 * a capture whose finalize fails stays PENDING for manual reconciliation.
 */
import { randomUUID } from "crypto";
import { and, eq, inArray } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "../../db/schema.pg";
import { auditLogs, mandates, transactions, type ReceiptData } from "../../db/schema.pg";

export type PaymentDb = PostgresJsDatabase<typeof schema>;

/** Throw this only when the provider confirms no money moved. Any other error means "unknown". */
export class DefinitePaymentFailure extends Error {}

/** One alert may produce at most one successful charge, whichever button is tapped. */
export function alertPaymentKey(alertId: string): string {
  return `alert:${alertId}`;
}

export interface ReservedPaymentParams {
  /** Must identify the logical charge and stay the same across retries. */
  idempotencyKey: string;
  mandateId?: string;
  /** With allowedMandateStatuses, the stored mandate must belong to this user. */
  ownerId?: string;
  serviceName: string;
  amount: number;
  currency?: string;
  budgetCeiling: number;
  cooldownSeconds?: number;
  allowDuplicateWithinWindow?: boolean;
  mandateStatusOnCommit?: "ACTIVE" | "PAUSED" | "ANOMALY_HOLD";
  /** When set, the stored mandate must exist in one of these states and its own ceiling applies. */
  allowedMandateStatuses?: Array<"ACTIVE" | "PAUSED" | "ANOMALY_HOLD">;
  auditDetails?: string;
  auditMetadata?: Record<string, unknown>;
  executePayment: () => Promise<{ orderId: string; captureId?: string; receipt: ReceiptData }>;
}

export type ReservedPaymentResult =
  | { status: "COMPLETED"; transactionId: string; orderId: string; captureId?: string; receipt: ReceiptData }
  | {
      status: "BLOCKED";
      reason: "DUPLICATE_KEY" | "MANDATE_IN_FLIGHT" | "MANDATE_COOLDOWN" | "BUDGET_EXCEEDED" | "MANDATE_NOT_ELIGIBLE";
      message: string;
      existingTransactionId?: string;
    }
  | { status: "DECLINED"; transactionId: string; message: string }
  | {
      status: "NEEDS_RECONCILIATION";
      transactionId: string;
      /** CAPTURED: money moved. UNKNOWN: it may have. DECLINED: it did not, but the row could not be released. */
      paymentOutcome: "CAPTURED" | "UNKNOWN" | "DECLINED";
      orderId?: string;
      message: string;
    };

type Blocked = Extract<ReservedPaymentResult, { status: "BLOCKED" }>;

function generateId(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Audit failures are logged but never change a payment result. */
async function writeAudit(
  db: PaymentDb,
  entry: Omit<typeof auditLogs.$inferInsert, "id">
): Promise<void> {
  try {
    await db.insert(auditLogs).values({ id: generateId("log"), ...entry });
  } catch (error) {
    console.error("Failed to write payment audit log:", errorMessage(error));
  }
}

/** Seconds since the mandate's newest COMPLETED charge; null if never charged. Unreadable dates count as just now. */
function secondsSinceLatest(createdAtValues: string[]): number | null {
  if (createdAtValues.length === 0) return null;
  const times = createdAtValues.map((raw) =>
    new Date(raw.includes("T") ? raw : `${raw.replace(" ", "T")}Z`).getTime()
  );
  if (times.some(Number.isNaN)) return 0;
  return Math.max(0, Math.floor((Date.now() - Math.max(...times)) / 1000));
}

/** Atomically takes the reservation, or returns why it could not. */
async function reserve(
  db: PaymentDb,
  params: ReservedPaymentParams,
  key: string,
  transactionId: string
): Promise<Blocked | null> {
  const { mandateId, serviceName, amount, currency = "USD" } = params;
  const { cooldownSeconds = 300, allowDuplicateWithinWindow = false } = params;

  return db.transaction(async (tx) => {
    // The row lock stops a cancel or hold from racing this check. The caller's ceiling is not trusted.
    if (params.allowedMandateStatuses) {
      const [mandate] = mandateId
        ? await tx
            .select({ status: mandates.status, budgetCeiling: mandates.budgetCeiling, ownerId: mandates.ownerId })
            .from(mandates)
            .where(eq(mandates.id, mandateId))
            .for("update")
        : [];
      if (!mandate || mandate.ownerId !== params.ownerId) {
        return {
          status: "BLOCKED" as const,
          reason: "MANDATE_NOT_ELIGIBLE" as const,
          message: `GUARDRAIL BLOCKED: Mandate "${mandateId}" was not found.`,
        };
      }
      if (!params.allowedMandateStatuses.includes(mandate.status)) {
        return {
          status: "BLOCKED" as const,
          reason: "MANDATE_NOT_ELIGIBLE" as const,
          message: `GUARDRAIL BLOCKED: Mandate "${mandateId}" is not eligible for this payment (${mandate.status}).`,
        };
      }
      if (amount > mandate.budgetCeiling) {
        return {
          status: "BLOCKED" as const,
          reason: "BUDGET_EXCEEDED" as const,
          message: `GUARDRAIL BLOCKED: Amount ${amount.toFixed(2)} exceeds budget ceiling ${mandate.budgetCeiling.toFixed(2)}.`,
        };
      }
    }

    // Waits for a competing uncommitted reservation, then inserts nothing if that one committed.
    const [reserved] = await tx
      .insert(transactions)
      .values({
        id: transactionId,
        mandateId: mandateId ?? null,
        orderId: `pending:${transactionId}`,
        idempotencyKey: key,
        service: serviceName,
        amount,
        currency,
        status: "PENDING",
      })
      .onConflictDoNothing()
      .returning({ id: transactions.id });

    if (!reserved) {
      const [sameKey] = await tx
        .select({ id: transactions.id })
        .from(transactions)
        .where(
          and(
            eq(transactions.idempotencyKey, key),
            inArray(transactions.status, ["PENDING", "COMPLETED"])
          )
        )
        .limit(1);
      if (sameKey) {
        return {
          status: "BLOCKED" as const,
          reason: "DUPLICATE_KEY" as const,
          message: `DOUBLE_BILLING_BLOCKED: Idempotency key "${key}" is already in use.`,
          existingTransactionId: sameKey.id,
        };
      }
      return {
        status: "BLOCKED" as const,
        reason: "MANDATE_IN_FLIGHT" as const,
        message: `DOUBLE_BILLING_BLOCKED: Another payment is unresolved for mandate "${mandateId}".`,
      };
    }

    // Only COMPLETED rows count, so this request's own PENDING row can never match.
    if (mandateId && !allowDuplicateWithinWindow) {
      const completed = await tx
        .select({ createdAt: transactions.createdAt })
        .from(transactions)
        .where(and(eq(transactions.mandateId, mandateId), eq(transactions.status, "COMPLETED")));
      const elapsed = secondsSinceLatest(completed.map((row) => row.createdAt));
      if (elapsed !== null && elapsed < cooldownSeconds) {
        await tx.delete(transactions).where(eq(transactions.id, transactionId));
        return {
          status: "BLOCKED" as const,
          reason: "MANDATE_COOLDOWN" as const,
          message: `DOUBLE_BILLING_BLOCKED: Mandate "${mandateId}" was charged ${elapsed}s ago (cooldown ${cooldownSeconds}s).`,
        };
      }
    }
    return null;
  });
}

async function finalize(
  db: PaymentDb,
  params: ReservedPaymentParams,
  transactionId: string,
  payment: { orderId: string; captureId?: string; receipt: ReceiptData }
): Promise<void> {
  const { mandateId, serviceName, amount, currency = "USD", mandateStatusOnCommit } = params;
  const now = new Date().toISOString();

  await db.transaction(async (tx) => {
    // Same lock order as reserve(): mandate first. Otherwise the two can deadlock after a capture.
    if (mandateId) {
      await tx.select({ id: mandates.id }).from(mandates).where(eq(mandates.id, mandateId)).for("update");
    }

    const updated = await tx
      .update(transactions)
      .set({
        status: "COMPLETED",
        orderId: payment.orderId,
        receiptData: payment.receipt,
        timestamp: now,
        createdAt: now,
      })
      .where(and(eq(transactions.id, transactionId), eq(transactions.status, "PENDING")))
      .returning({ id: transactions.id });
    if (updated.length !== 1) {
      throw new Error(`Reservation ${transactionId} is no longer PENDING`);
    }

    if (mandateId) {
      await tx
        .update(mandates)
        .set({
          lastScrapedPrice: amount,
          updatedAt: now,
          ...(mandateStatusOnCommit ? { status: mandateStatusOnCommit } : {}),
        })
        .where(eq(mandates.id, mandateId));
    }

    await tx.insert(auditLogs).values({
      id: generateId("log"),
      mandateId: mandateId ?? null,
      eventType: "PAYMENT_CAPTURED",
      service: serviceName,
      details:
        params.auditDetails ??
        `Payment captured: ${serviceName} (${amount.toFixed(2)} ${currency}) via order ${payment.orderId}.`,
      severity: "success",
      metadata: { ...params.auditMetadata, transactionId, orderId: payment.orderId, captureId: payment.captureId, amount, currency },
    });
  });
}

/**
 * Rejects (before any charge) on invalid input or if the reservation query fails.
 * All outcomes after the reservation are returned as a result, never thrown.
 */
export async function executeReservedPayment(
  db: PaymentDb,
  params: ReservedPaymentParams
): Promise<ReservedPaymentResult> {
  const { mandateId, serviceName, amount, budgetCeiling } = params;

  const key = typeof params.idempotencyKey === "string" ? params.idempotencyKey.trim() : "";
  if (!key) {
    throw new Error("executeReservedPayment requires a stable idempotencyKey");
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("executeReservedPayment requires a positive amount");
  }

  const auditBase = { mandateId: mandateId ?? null, service: serviceName };

  if (amount > budgetCeiling) {
    const message = `GUARDRAIL BLOCKED: Amount ${amount.toFixed(2)} exceeds budget ceiling ${budgetCeiling.toFixed(2)}.`;
    await writeAudit(db, {
      ...auditBase,
      eventType: "GUARDRAIL_BLOCKED",
      details: message,
      severity: "danger",
      metadata: { idempotencyKey: key, amount, budgetCeiling },
    });
    return { status: "BLOCKED", reason: "BUDGET_EXCEEDED", message };
  }

  const transactionId = generateId("tx");
  const blocked = await reserve(db, params, key, transactionId);
  if (blocked) {
    await writeAudit(db, {
      ...auditBase,
      eventType: "DOUBLE_BILLING_BLOCKED",
      details: blocked.message,
      severity: "danger",
      metadata: { idempotencyKey: key, reason: blocked.reason, existingTransactionId: blocked.existingTransactionId },
    });
    return blocked;
  }

  const needsReconciliation = async (
    paymentOutcome: "CAPTURED" | "UNKNOWN" | "DECLINED",
    cause: string,
    orderId?: string
  ): Promise<ReservedPaymentResult> => {
    const message = `Payment ${transactionId} needs reconciliation (outcome: ${paymentOutcome}): ${cause}`;
    await writeAudit(db, {
      ...auditBase,
      eventType: "MANUAL_APPROVAL_REQUIRED",
      details: message,
      severity: "danger",
      metadata: { transactionId, idempotencyKey: key, paymentOutcome, orderId, reason: "PAYMENT_RECONCILIATION" },
    });
    return { status: "NEEDS_RECONCILIATION", transactionId, paymentOutcome, orderId, message };
  };

  let payment: Awaited<ReturnType<ReservedPaymentParams["executePayment"]>>;
  try {
    payment = await params.executePayment();
  } catch (error) {
    if (!(error instanceof DefinitePaymentFailure)) {
      return needsReconciliation("UNKNOWN", errorMessage(error));
    }
    const message = `Payment declined: ${error.message}`;
    try {
      await db
        .update(transactions)
        .set({ status: "BLOCKED" })
        .where(and(eq(transactions.id, transactionId), eq(transactions.status, "PENDING")));
    } catch (releaseError) {
      return needsReconciliation("DECLINED", `could not release reservation: ${errorMessage(releaseError)}`);
    }
    await writeAudit(db, {
      ...auditBase,
      eventType: "GUARDRAIL_BLOCKED",
      details: message,
      severity: "danger",
      metadata: { transactionId, idempotencyKey: key, reason: "PAYMENT_DECLINED" },
    });
    return { status: "DECLINED", transactionId, message };
  }

  try {
    await finalize(db, params, transactionId, payment);
  } catch (error) {
    // Keep PayPal's evidence on the PENDING row if possible; the row stays PENDING either way.
    try {
      await db
        .update(transactions)
        .set({ receiptData: payment.receipt })
        .where(and(eq(transactions.id, transactionId), eq(transactions.status, "PENDING")));
    } catch (evidenceError) {
      console.error("Failed to store capture evidence:", errorMessage(evidenceError));
    }
    return needsReconciliation("CAPTURED", errorMessage(error), payment.orderId);
  }

  return {
    status: "COMPLETED",
    transactionId,
    orderId: payment.orderId,
    captureId: payment.captureId,
    receipt: payment.receipt,
  };
}
