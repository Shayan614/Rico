import {
  executeAtomicPaymentTransaction,
  clearAllPaymentLocks,
} from "./atomic-transaction";
import { db, mandates, transactions } from "@/db";
import { eq } from "drizzle-orm";

async function runAtomicTransactionTests() {
  console.log("==================================================");
  console.log("🔒 Testing Atomic Transaction & Double-Billing Guard");
  console.log("==================================================");

  clearAllPaymentLocks();

  // Test Mandate Setup
  const testMandateId = `mandate-test-${Date.now()}`;
  await db.insert(mandates).values({
    id: testMandateId,
    service: "Netflix Test Mandate",
    budgetCeiling: 25.0,
    lastScrapedPrice: 0,
    recurrence: "Monthly",
    nextRun: "Dec 1, 2026",
    status: "ACTIVE",
    category: "Streaming",
    currency: "USD",
  });

  // [Test 1] Successful Atomic Payment & Commit
  console.log("\n[Test 1] Testing Successful Atomic Payment Execution & Commit...");
  const orderId1 = `ORD-TEST-1-${Date.now()}`;
  const result1 = await executeAtomicPaymentTransaction({
    mandateId: testMandateId,
    orderId: orderId1,
    serviceName: "Netflix Test Mandate",
    amount: 15.49,
    budgetCeiling: 25.0,
    currency: "USD",
    receiptData: {
      orderId: orderId1,
      paymentMethod: "PAYPAL",
      status: "COMPLETED",
    },
  });

  console.log("   Result:", {
    success: result1.success,
    status: result1.status,
    txId: result1.transactionId,
  });

  if (!result1.success || result1.status !== "COMPLETED") {
    throw new Error("Test 1 Failed: Atomic transaction did not complete!");
  }

  // Verify DB state
  const [persistedTx] = await db
    .select()
    .from(transactions)
    .where(eq(transactions.orderId, orderId1));

  if (!persistedTx || persistedTx.amount !== 15.49) {
    throw new Error("Test 1 Failed: Transaction was not persisted in database!");
  }

  const [updatedMandate] = await db
    .select()
    .from(mandates)
    .where(eq(mandates.id, testMandateId));

  if (!updatedMandate || updatedMandate.lastScrapedPrice !== 15.49) {
    throw new Error("Test 1 Failed: Mandate lastScrapedPrice was not updated atomically!");
  }
  console.log("✅ Test 1 Passed: Transaction committed, mandate updated atomically.");

  // [Test 2] Double-Billing Guard: Duplicate Order ID
  console.log("\n[Test 2] Testing Double-Billing Guard on Duplicate Order ID...");
  const duplicateOrderAttempt = await executeAtomicPaymentTransaction({
    mandateId: testMandateId,
    orderId: orderId1, // Re-submitting the exact same orderId!
    serviceName: "Netflix Test Mandate",
    amount: 15.49,
    budgetCeiling: 25.0,
    currency: "USD",
  });

  console.log("   Result:", {
    success: duplicateOrderAttempt.success,
    status: duplicateOrderAttempt.status,
    message: duplicateOrderAttempt.message,
  });

  if (duplicateOrderAttempt.success || duplicateOrderAttempt.status !== "BLOCKED") {
    throw new Error("Test 2 Failed: Double billing guard should have BLOCKED duplicate orderId!");
  }
  console.log("✅ Test 2 Passed: Duplicate order ID blocked with DOUBLE_BILLING_BLOCKED.");

  // [Test 3] Double-Billing Guard: Idempotency Key
  console.log("\n[Test 3] Testing Double-Billing Guard on Duplicate Idempotency Key...");
  const idempotencyKey = `idem-key-${Date.now()}`;
  const orderId2 = `ORD-TEST-2-${Date.now()}`;

  const firstIdempotentTx = await executeAtomicPaymentTransaction({
    orderId: orderId2,
    idempotencyKey,
    serviceName: "Figma Professional",
    amount: 12.0,
    budgetCeiling: 20.0,
  });

  if (!firstIdempotentTx.success) {
    throw new Error("Test 3 Setup Failed: Initial idempotent transaction failed!");
  }

  // Attempt duplicate with same idempotency key but different order ID
  const duplicateIdempotencyAttempt = await executeAtomicPaymentTransaction({
    orderId: `ORD-TEST-NEW-${Date.now()}`,
    idempotencyKey,
    serviceName: "Figma Professional",
    amount: 12.0,
    budgetCeiling: 20.0,
  });

  console.log("   Duplicate Idempotency Result:", {
    success: duplicateIdempotencyAttempt.success,
    status: duplicateIdempotencyAttempt.status,
    message: duplicateIdempotencyAttempt.message,
  });

  if (duplicateIdempotencyAttempt.success || duplicateIdempotencyAttempt.status !== "BLOCKED") {
    throw new Error("Test 3 Failed: Idempotency key duplicate should be BLOCKED!");
  }
  console.log("✅ Test 3 Passed: Re-use of idempotency key blocked.");

  // [Test 4] Double-Billing Guard: Mandate Rapid Re-Billing Cooldown Window
  console.log("\n[Test 4] Testing Rapid Re-Billing Cooldown on Same Mandate...");
  const orderId3 = `ORD-TEST-3-${Date.now()}`;
  const rapidRebillAttempt = await executeAtomicPaymentTransaction({
    mandateId: testMandateId, // Same mandate charged 2 seconds ago in Test 1
    orderId: orderId3, // Brand new orderId
    serviceName: "Netflix Test Mandate",
    amount: 15.49,
    budgetCeiling: 25.0,
    cooldownSeconds: 300, // 5 min cooldown
  });

  console.log("   Rapid Re-Bill Result:", {
    success: rapidRebillAttempt.success,
    status: rapidRebillAttempt.status,
    message: rapidRebillAttempt.message,
  });

  if (rapidRebillAttempt.success || rapidRebillAttempt.status !== "BLOCKED") {
    throw new Error("Test 4 Failed: Rapid re-billing on same mandate should be BLOCKED!");
  }
  console.log("✅ Test 4 Passed: Mandate cooldown prevented duplicate subscription billing.");

  // [Test 5] Atomic Rollback on Failure
  console.log("\n[Test 5] Testing Atomic Rollback on Payment Failure...");
  const orderIdFail = `ORD-FAIL-${Date.now()}`;
  const txCountBefore = (await db.select().from(transactions)).length;

  const failResult = await executeAtomicPaymentTransaction({
    mandateId: testMandateId,
    orderId: orderIdFail,
    serviceName: "Netflix Test Mandate",
    amount: 15.49,
    budgetCeiling: 25.0,
    allowDuplicateWithinWindow: true,
    executePaymentFn: async () => {
      // Simulate external API network failure / timeout
      throw new Error("SIMULATED_PAYPAL_API_TIMEOUT: 504 Gateway Timeout");
    },
  });

  console.log("   Failure Result:", {
    success: failResult.success,
    status: failResult.status,
    rolledBack: failResult.rolledBack,
    error: failResult.error,
  });

  if (failResult.success || !failResult.rolledBack) {
    throw new Error("Test 5 Failed: Failed payment must report rolledBack: true!");
  }

  const txCountAfter = (await db.select().from(transactions)).length;
  if (txCountAfter !== txCountBefore) {
    throw new Error("Test 5 Failed: Phantom transaction was recorded despite rollback!");
  }
  console.log("✅ Test 5 Passed: Zero phantom records created; database state cleanly rolled back.");

  // [Test 6] Concurrency Race Condition Guard (Promise.all)
  console.log("\n[Test 6] Testing Concurrency In-Flight Lock with Simultaneous Requests...");
  const concurrentMandateId = `mandate-concurrent-${Date.now()}`;
  await db.insert(mandates).values({
    id: concurrentMandateId,
    service: "Concurrent Test Service",
    budgetCeiling: 50.0,
    lastScrapedPrice: 0,
    recurrence: "Monthly",
    nextRun: "Dec 1, 2026",
    status: "ACTIVE",
    category: "Cloud",
    currency: "USD",
  });

  const [req1, req2] = await Promise.all([
    executeAtomicPaymentTransaction({
      mandateId: concurrentMandateId,
      orderId: `ORD-CONC-1-${Date.now()}`,
      serviceName: "Concurrent Test Service",
      amount: 20.0,
      budgetCeiling: 50.0,
      executePaymentFn: async () => {
        await new Promise((r) => setTimeout(r, 40));
        return {
          orderId: `ORD-CONC-1-${Date.now()}`,
          captureId: "CAP-CONC-1",
          receipt: { status: "COMPLETED" },
        };
      },
    }),
    executeAtomicPaymentTransaction({
      mandateId: concurrentMandateId,
      orderId: `ORD-CONC-2-${Date.now()}`,
      serviceName: "Concurrent Test Service",
      amount: 20.0,
      budgetCeiling: 50.0,
      executePaymentFn: async () => {
        await new Promise((r) => setTimeout(r, 40));
        return {
          orderId: `ORD-CONC-2-${Date.now()}`,
          captureId: "CAP-CONC-2",
          receipt: { status: "COMPLETED" },
        };
      },
    }),
  ]);

  console.log("   Concurrent Results:", {
    req1: { success: req1.success, status: req1.status },
    req2: { success: req2.success, status: req2.status },
  });

  const blockedReq = !req1.success ? req1 : !req2.success ? req2 : null;
  const passedReq = req1.success ? req1 : req2.success ? req2 : null;

  if (!blockedReq || !passedReq || blockedReq.status !== "BLOCKED") {
    throw new Error("Test 6 Failed: Concurrency lock failed to block simultaneous duplicate execution!");
  }
  console.log("✅ Test 6 Passed: Mutual exclusion in-flight lock blocked concurrent duplicate.");

  await db.delete(mandates).where(eq(mandates.id, concurrentMandateId));

  // Clean up test mandate
  await db.delete(mandates).where(eq(mandates.id, testMandateId));

  console.log("\n==================================================");
  console.log("🎉 ALL 6 Atomic Transaction & Guard Tests PASSED!");
  console.log("==================================================");
}

runAtomicTransactionTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Atomic transaction test failed:", err);
    process.exit(1);
  });
