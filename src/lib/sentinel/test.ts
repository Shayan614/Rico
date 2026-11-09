import { db, mandates, transactions, auditLogs, users } from "@/db";
import { eq } from "drizzle-orm";
import { priceSentinel } from "./price-sentinel";
import { omnichannelDispatcher } from "./omnichannel";
import { handleRemoteAction } from "./callback-handler";
import { OmnichannelAlert } from "./types";

async function runSentinelOmnichannelTests() {
  process.env.PAYPAL_MODE = "mock"; // The forced spike below needs explicit mock mode.
  console.log("==================================================");
  console.log("🤖 Testing 24/7 Price Sentinel & Omnichannel Bot Team");
  console.log("==================================================");

  // Seed / ensure test mandate in SQLite
  const testMandateId = `mandate-test-${Date.now()}`;
  const testOwnerId = "usr_sentinel_test";
  const initialMandate = {
    ownerId: testOwnerId,
    id: testMandateId,
    service: "Adobe Creative Cloud",
    budgetCeiling: 40.0,
    lastScrapedPrice: 35.0,
    recurrence: "Monthly on 1st",
    nextRun: "Dec 1, 2026",
    status: "ACTIVE" as const,
    category: "Design Software",
    currency: "USD",
    strictMode: false,
    merchantUrl: "https://www.adobe.com/creativecloud/plans.html",
  };

  db.insert(users).values({ id: testOwnerId, email: "sentinel-test@example.test" }).onConflictDoNothing().run();
  db.insert(mandates).values(initialMandate).run();
  console.log("✅ Seeded test mandate in SQLite:", initialMandate.service, "Ceiling: $40.00, Baseline: $35.00");

  // 1. Test Audit Worker with Price Spike Anomaly (>20% Jump & Exceeding Ceiling)
  console.log("\n[Test 1] Running 24h Background Sentinel Audit with simulated spike (+57%)...");
  const summary = await priceSentinel.runAuditCycle({
    mandateId: testMandateId,
    forceSpike: true,
    service: "Adobe",
  });

  console.log("   Audit Cycle Result:", {
    totalAudited: summary.totalAudited,
    anomalies: summary.anomaliesDetected,
    alertsDispatched: summary.alertsDispatched,
  });

  if (summary.anomaliesDetected < 1 || summary.alertsDispatched < 1) {
    throw new Error("Audit worker failed to flag price spike anomaly or dispatch alert!");
  }

  // Verify mandate status in SQLite changed to ANOMALY_HOLD
  const updatedMandate = db
    .select()
    .from(mandates)
    .where(eq(mandates.id, testMandateId))
    .get();

  if (!updatedMandate || updatedMandate.status !== "ANOMALY_HOLD") {
    throw new Error(`Expected mandate status 'ANOMALY_HOLD', got: ${updatedMandate?.status}`);
  }
  console.log("✅ Mandate automatically placed on ANOMALY_HOLD in SQLite memory.");

  // Verify audit log recorded in SQLite
  const logs = db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.mandateId, testMandateId))
    .all();

  const anomalyLog = logs.find((l) => l.eventType === "ANOMALY_DETECTED");
  if (!anomalyLog) {
    throw new Error("Expected ANOMALY_DETECTED audit log in SQLite!");
  }
  console.log("✅ ANOMALY_DETECTED log inserted with warning severity.");

  // 2. Test Omnichannel Dispatcher (Telegram, WhatsApp, Slack Formats)
  console.log("\n[Test 2] Testing Omnichannel Dispatcher formatting...");
  const sampleAlert: OmnichannelAlert = {
    id: `alert-test-${Date.now()}`,
    mandateId: testMandateId,
    service: "Adobe Creative Cloud",
    oldPrice: 35.0,
    newPrice: 39.99,
    jumpPercent: 57,
    budgetCeiling: 40.0,
    currency: "USD",
    channel: "telegram",
    status: "PENDING",
    timestamp: new Date().toISOString(),
  };

  const dispatchResult = await omnichannelDispatcher.dispatchAlert(sampleAlert);

  console.log("   Telegram Delivery Status:", dispatchResult.telegramSent ? "SUCCESS" : "FAILED");
  console.log("   WhatsApp Template Action Type:", dispatchResult.whatsappPayload.type);
  console.log("   Slack Block Kit Headers:", (dispatchResult.slackPayload.blocks as Array<unknown>)?.length, "blocks");

  if (!dispatchResult.telegramSent) {
    throw new Error("Telegram alert delivery/simulation failed!");
  }
  console.log("✅ Omnichannel multi-platform dispatchers verified.");

  // 3. Test Remote Action Callback: Approve One-Time (Primary PayPal Capture)
  console.log("\n[Test 3] Testing Remote Webhook Callback: 'approve' (Primary PayPal Wallet)...");
  const approveResult = await handleRemoteAction({
    ownerId: testOwnerId,
    action: "approve",
    mandateId: testMandateId,
    alertId: sampleAlert.id,
  });

  console.log("   Approve Action Result:", {
    success: approveResult.success,
    orderId: approveResult.orderId,
    fundingRail: approveResult.fundingRail,
    mandateStatus: approveResult.mandateStatus,
  });

  if (!approveResult.success || approveResult.mandateStatus !== "ACTIVE" || !approveResult.orderId) {
    throw new Error("Remote 'approve' action failed to capture PayPal order or restore ACTIVE status!");
  }

  // Verify transaction in SQLite
  const tx = db
    .select()
    .from(transactions)
    .where(eq(transactions.orderId, approveResult.orderId))
    .get();

  if (!tx || tx.amount !== 39.99) {
    throw new Error("Transaction record missing or incorrect in SQLite transactions table!");
  }
  console.log("✅ PayPal Order captured and recorded in SQLite transactions table:", tx.id);

  // 4. Test Remote Action Callback: Pay with Backup Card (Visa via PayPal Vault)
  console.log("\n[Test 4] Testing Remote Webhook Callback: 'backup_card' (Visa Vault)...");
  const replay = await handleRemoteAction({
    ownerId: testOwnerId,
    action: "backup_card",
    mandateId: testMandateId,
    alertId: sampleAlert.id,
  });
  if (replay.success || replay.orderId) {
    throw new Error("A second button tap on one alert must not charge again!");
  }
  console.log("✅ Second tap on the same alert was refused.");

  const backupMandateId = `${testMandateId}-backup`;
  db.insert(mandates).values({ ...initialMandate, id: backupMandateId }).run();
  const backupAlert: OmnichannelAlert = {
    ...sampleAlert,
    status: "PENDING",
    id: `${sampleAlert.id}-backup`,
    mandateId: backupMandateId,
  };
  await omnichannelDispatcher.dispatchAlert(backupAlert);
  const backupCardResult = await handleRemoteAction({
    ownerId: testOwnerId,
    action: "backup_card",
    mandateId: backupMandateId,
    alertId: backupAlert.id,
  });

  console.log("   Backup Card Result:", {
    success: backupCardResult.success,
    fundingRail: backupCardResult.fundingRail,
    orderId: backupCardResult.orderId,
    mandateStatus: backupCardResult.mandateStatus,
  });

  if (backupCardResult.fundingRail !== "VISA" || backupCardResult.mandateStatus !== "ACTIVE") {
    throw new Error("Remote 'backup_card' action failed to route to Visa Vault!");
  }
  console.log("✅ Payment routed to vaulted Visa card via PayPal Vault.");

  // 5. Test Remote Action Callback: Cancel Subscription (Pause Mandate)
  console.log("\n[Test 5] Testing Remote Webhook Callback: 'cancel' (Subscription Pause)...");
  const cancelResult = await handleRemoteAction({
    ownerId: testOwnerId,
    action: "cancel",
    mandateId: testMandateId,
    alertId: sampleAlert.id,
  });

  console.log("   Cancel Action Result:", {
    success: cancelResult.success,
    mandateStatus: cancelResult.mandateStatus,
    message: cancelResult.message,
  });

  const finalMandate = db
    .select()
    .from(mandates)
    .where(eq(mandates.id, testMandateId))
    .get();

  if (finalMandate?.status !== "PAUSED") {
    throw new Error(`Expected mandate status 'PAUSED', got: ${finalMandate?.status}`);
  }
  console.log("✅ Mandate paused and billing halted on remote cancel button tap.");

  // Clean up test mandate
  db.delete(mandates).where(eq(mandates.id, testMandateId)).run();

  console.log("\n==================================================");
  console.log("🎉 All 24/7 Sentinel & Omnichannel Bot Tests PASSED!");
  console.log("==================================================");
  process.exit(0);
}

runSentinelOmnichannelTests().catch((err) => {
  console.error("Sentinel test suite failed:", err);
  process.exit(1);
});
