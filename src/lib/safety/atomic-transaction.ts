import { db, mandates, transactions, auditLogs, type ReceiptData } from "@/db";
import { posthogServer } from "@/lib/telemetry/posthog-server";
import { eq, and, desc } from "drizzle-orm";
import {
  AtomicPaymentExecutionParams,
  AtomicPaymentExecutionResult,
  DoubleBillingCheckResult,
} from "./types";

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

// In-Memory Concurrency Locks (prevents concurrent race-conditions)
interface ActiveLock {
  key: string;
  timestamp: number;
  timer: NodeJS.Timeout;
}
const activeLocks = new Map<string, ActiveLock>();
const DEFAULT_LOCK_TTL_MS = 30000; // 30 seconds

/**
 * Acquire in-flight lock for order / mandate / idempotency key.
 * Returns true if lock was acquired, false if already in-flight.
 */
function acquireLock(key: string, ttlMs: number = DEFAULT_LOCK_TTL_MS): boolean {
  if (activeLocks.has(key)) {
    return false;
  }

  const timer = setTimeout(() => {
    activeLocks.delete(key);
  }, ttlMs);

  activeLocks.set(key, {
    key,
    timestamp: Date.now(),
    timer,
  });

  return true;
}

/**
 * Release an active in-flight lock.
 */
function releaseLock(key: string): void {
  const lock = activeLocks.get(key);
  if (lock) {
    clearTimeout(lock.timer);
    activeLocks.delete(key);
  }
}

/**
 * Utility to clear all locks (useful for test resets).
 */
export function clearAllPaymentLocks(): void {
  activeLocks.forEach((lock) => {
    clearTimeout(lock.timer);
  });
  activeLocks.clear();
}

/**
 * Verify whether an order, idempotency key, or mandate is eligible for billing.
 * Checks for:
 * 1. Existing finalized transactions with the same orderId or idempotencyKey
 * 2. Rapid re-billing of the same mandate within a cooldown window (default: 300s / 5m)
 */
export async function checkDoubleBilling(
  params: {
    orderId?: string;
    idempotencyKey?: string;
    mandateId?: string;
    cooldownSeconds?: number;
    allowDuplicateWithinWindow?: boolean;
  }
): Promise<DoubleBillingCheckResult> {
  const {
    orderId,
    idempotencyKey,
    mandateId,
    cooldownSeconds = 300,
    allowDuplicateWithinWindow = false,
  } = params;

  // 1. Check for duplicate orderId
  if (orderId) {
    const existingByOrder = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.orderId, orderId),
          eq(transactions.status, "COMPLETED")
        )
      )
      .limit(1);

    if (existingByOrder.length > 0) {
      const match = existingByOrder[0];
      return {
        allowed: false,
        reason: `DOUBLE_BILLING_BLOCKED: Order "${orderId}" has already been processed and completed (Transaction: ${match.id}). Duplicate payment rejected.`,
        existingTransactionId: match.id,
      };
    }
  }

  // 2. Check for duplicate idempotencyKey
  if (idempotencyKey) {
    const existingByIdempotency = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.idempotencyKey, idempotencyKey),
          eq(transactions.status, "COMPLETED")
        )
      )
      .limit(1);

    if (existingByIdempotency.length > 0) {
      const match = existingByIdempotency[0];
      return {
        allowed: false,
        reason: `DOUBLE_BILLING_BLOCKED: Idempotency key "${idempotencyKey}" was already used for transaction "${match.id}". Duplicate payment rejected.`,
        existingTransactionId: match.id,
      };
    }
  }

  // 3. Check for rapid recurring mandate double-billing within cooldown window
  if (mandateId && !allowDuplicateWithinWindow) {
    const recentMandateTxs = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.mandateId, mandateId),
          eq(transactions.status, "COMPLETED")
        )
      )
      .orderBy(desc(transactions.createdAt))
      .limit(1);

    if (recentMandateTxs.length > 0) {
      const recentTx = recentMandateTxs[0];
      const rawDate = recentTx.createdAt || recentTx.timestamp;
      let txTime = new Date(rawDate).getTime();
      if (isNaN(txTime)) {
        txTime = new Date(rawDate.replace(" ", "T") + "Z").getTime();
      }
      const now = Date.now();
      const elapsedSeconds = Math.max(0, Math.floor((now - txTime) / 1000));

      if (elapsedSeconds < cooldownSeconds) {
        const remainingSeconds = cooldownSeconds - elapsedSeconds;
        return {
          allowed: false,
          reason: `DOUBLE_BILLING_BLOCKED: Mandate "${mandateId}" (${recentTx.service}) was already charged $${recentTx.amount.toFixed(
            2
          )} ${recentTx.currency} ${elapsedSeconds}s ago. Double-charge prevented (Cooldown window: ${cooldownSeconds}s, remaining: ${remainingSeconds}s).`,
          existingTransactionId: recentTx.id,
          cooldownRemainingSeconds: remainingSeconds,
        };
      }
    }
  }

  return { allowed: true };
}

/**
 * Master Atomic Transaction Wrapper & Double-Billing Guard
 *
 * Guarantees:
 * 1. Mutual exclusion: prevents concurrent race conditions with in-flight locks
 * 2. Double-billing guard: verifies orderId, idempotencyKey, and mandate cooldown
 * 3. Atomic execution: wraps SQLite writes in a transaction so either everything commits
 *    or the entire state rolls back with zero partial writes
 * 4. Comprehensive audit logging and PostHog telemetry
 */
export async function executeAtomicPaymentTransaction(
  params: AtomicPaymentExecutionParams
): Promise<AtomicPaymentExecutionResult> {
  const {
    mandateId,
    orderId,
    serviceName,
    amount,
    currency = "USD",
    budgetCeiling,
    idempotencyKey,
    cooldownSeconds = 300,
    allowDuplicateWithinWindow = false,
    receiptData,
    executePaymentFn,
  } = params;

  const lockKey = idempotencyKey
    ? `idemp:${idempotencyKey}`
    : mandateId
    ? `mandate:${mandateId}`
    : orderId
    ? `order:${orderId}`
    : `svc:${serviceName}`;

  // Step 1: Concurrency In-Flight Lock
  const lockAcquired = acquireLock(lockKey);
  if (!lockAcquired) {
    const lockErrorMsg = `DOUBLE_BILLING_BLOCKED: A payment execution is already in-flight for "${lockKey}". Concurrent duplicate rejected.`;

    await db.insert(auditLogs).values({
      id: generateId("log"),
      mandateId: mandateId || null,
      eventType: "DOUBLE_BILLING_BLOCKED",
      service: serviceName,
      details: lockErrorMsg,
      severity: "danger",
      metadata: { orderId, idempotencyKey, mandateId, reason: "CONCURRENT_IN_FLIGHT" },
    });

    return {
      success: false,
      orderId,
      status: "BLOCKED",
      message: lockErrorMsg,
    };
  }

  try {
    // Step 2: Double-Billing Pre-Flight Check
    const doubleBillingCheck = await checkDoubleBilling({
      orderId,
      idempotencyKey,
      mandateId,
      cooldownSeconds,
      allowDuplicateWithinWindow,
    });

    if (!doubleBillingCheck.allowed) {
      const blockedReason = doubleBillingCheck.reason || "Double billing guard rejected execution.";

      // Audit log double billing block
      await db.insert(auditLogs).values({
        id: generateId("log"),
        mandateId: mandateId || null,
        eventType: "DOUBLE_BILLING_BLOCKED",
        service: serviceName,
        details: blockedReason,
        severity: "danger",
        metadata: {
          orderId,
          idempotencyKey,
          mandateId,
          existingTransactionId: doubleBillingCheck.existingTransactionId,
          cooldownRemaining: doubleBillingCheck.cooldownRemainingSeconds,
        },
      });

      // PostHog telemetry for blocked double billing
      await posthogServer.trackGuardrailBlocked({
        service: serviceName,
        attemptedPrice: amount,
        budgetCeiling,
        exceededBy: 0,
        reason: blockedReason,
      });

      return {
        success: false,
        orderId,
        status: "BLOCKED",
        message: blockedReason,
        transactionId: doubleBillingCheck.existingTransactionId,
      };
    }

    // Step 3: Hard Budget Ceiling Validation Check
    if (amount > budgetCeiling) {
      const budgetBlockedMsg = `GUARDRAIL BLOCKED: Amount $${amount.toFixed(
        2
      )} exceeds authorized budget ceiling $${budgetCeiling.toFixed(2)}.`;

      await db.insert(auditLogs).values({
        id: generateId("log"),
        mandateId: mandateId || null,
        eventType: "GUARDRAIL_BLOCKED",
        service: serviceName,
        details: budgetBlockedMsg,
        severity: "danger",
        metadata: { amount, budgetCeiling, orderId },
      });

      return {
        success: false,
        orderId,
        status: "BLOCKED",
        message: budgetBlockedMsg,
      };
    }

    // Step 4: Execute External Payment (if execution function supplied)
    let finalReceipt = receiptData;
    let finalOrderId = orderId;

    if (executePaymentFn) {
      try {
        const paymentResult = await executePaymentFn();
        finalReceipt = paymentResult.receipt;
        if (paymentResult.orderId && paymentResult.orderId !== orderId) {
          finalOrderId = paymentResult.orderId;
          const postPaymentCheck = await checkDoubleBilling({ orderId: finalOrderId });
          if (!postPaymentCheck.allowed) {
            return {
              success: false,
              orderId: finalOrderId,
              status: "BLOCKED",
              message: postPaymentCheck.reason || `DOUBLE_BILLING_BLOCKED: Order "${finalOrderId}" already processed.`,
              transactionId: postPaymentCheck.existingTransactionId,
            };
          }
        }
      } catch (paymentErr: unknown) {
        const errMsg = paymentErr instanceof Error ? paymentErr.message : String(paymentErr);
        const paymentFailMsg = `Payment execution failed: ${errMsg}`;

        await db.insert(auditLogs).values({
          id: generateId("log"),
          mandateId: mandateId || null,
          eventType: "GUARDRAIL_BLOCKED",
          service: serviceName,
          details: paymentFailMsg,
          severity: "danger",
          metadata: { orderId, amount, error: errMsg },
        });

        return {
          success: false,
          orderId,
          status: "FAILED",
          message: paymentFailMsg,
          error: errMsg,
          rolledBack: true,
        };
      }
    }

    // Step 5: Atomic SQLite Database Transaction Commit
    const transactionId = generateId("tx");
    const logId = generateId("log");

    const atomicResult = db.transaction((tx) => {
      // 1. Insert Transaction Record
      const isoNow = new Date().toISOString();
      const [newTx] = tx
        .insert(transactions)
        .values({
          id: transactionId,
          mandateId: mandateId || null,
          orderId: finalOrderId,
          idempotencyKey: idempotencyKey || null,
          service: serviceName,
          amount,
          currency,
          status: "COMPLETED",
          timestamp: isoNow,
          createdAt: isoNow,
          receiptData: (finalReceipt as ReceiptData) || null,
        })
        .returning()
        .all();

      // 2. Update Mandate (if mandateId is present)
      if (mandateId) {
        tx.update(mandates)
          .set({
            lastScrapedPrice: amount,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(mandates.id, mandateId))
          .run();
      }

      // 3. Insert Audit Log
      tx.insert(auditLogs)
        .values({
          id: logId,
          mandateId: mandateId || null,
          eventType: "PAYMENT_CAPTURED",
          service: serviceName,
          details: `Atomic Payment Secured: ${serviceName} ($${amount.toFixed(
            2
          )} ${currency}) via Order ${finalOrderId}. Mandate state updated atomically.`,
          severity: "success",
          metadata: {
            transactionId,
            orderId: finalOrderId,
            amount,
            currency,
            budgetCeiling,
            idempotencyKey,
          },
        })
        .run();

      return newTx;
    });

    return {
      success: true,
      transactionId: atomicResult.id,
      orderId: finalOrderId,
      status: "COMPLETED",
      message: `Atomic payment successfully executed and persisted for ${serviceName}.`,
      receiptData: finalReceipt,
      rolledBack: false,
    };
  } catch (error: unknown) {
    // If the database transaction throws, better-sqlite3 automatically rolls back
    console.error("Atomic transaction wrapper error (state rolled back):", error);
    const errString = error instanceof Error ? error.message : String(error);

    try {
      await db.insert(auditLogs).values({
        id: generateId("log"),
        mandateId: mandateId || null,
        eventType: "GUARDRAIL_BLOCKED",
        service: serviceName,
        details: `Atomic transaction failed and rolled back cleanly: ${errString}`,
        severity: "danger",
        metadata: { orderId, amount, error: errString },
      });
    } catch (auditErr) {
      console.error("Failed to write rollback audit log:", auditErr);
    }

    return {
      success: false,
      orderId,
      status: "FAILED",
      message: `Atomic transaction rolled back: ${errString}`,
      error: errString,
      rolledBack: true,
    };
  } finally {
    // Step 6: Always release the in-flight concurrency lock
    releaseLock(lockKey);
  }
}
