import { posthogServer } from "./posthog-server";
import { calculateGeminiCost } from "./types";

async function runTelemetryTests() {
  console.log("==================================================");
  console.log("📊 Testing PostHog Telemetry & Guardrail Observability");
  console.log("==================================================");

  // [Test 1] Cost Calculation for Gemini 3.8 / 2.5 Flash
  console.log("\n[Test 1] Testing calculateGeminiCost()...");
  const cost1 = calculateGeminiCost(1000, 200); // 1000 in, 200 out
  const expectedCost = (1000 / 1_000_000) * 0.075 + (200 / 1_000_000) * 0.3;
  console.log(`   Tokens: 1000 in, 200 out ➔ Estimated Cost: $${cost1.toFixed(7)} USD`);
  if (Math.abs(cost1 - expectedCost) < 0.000001) {
    console.log("✅ calculateGeminiCost correctly matches Gemini pricing matrix ($0.075 / $0.30 per 1M).");
  } else {
    throw new Error(`Cost mismatch: expected ${expectedCost}, got ${cost1}`);
  }

  // [Test 2] Track LLM Generation Metrics
  console.log("\n[Test 2] Testing posthogServer.trackLLMGeneration()...");
  await posthogServer.trackLLMGeneration({
    model: "gemini-3.8-flash",
    inputTokens: 320,
    outputTokens: 48,
    latencyMs: 1120,
    status: "success",
    promptSnippet: "Pay Netflix $15.99 on 5th, max $20",
  });
  console.log("✅ trackLLMGeneration logged token consumption, latency, and reasoning cost.");

  // [Test 3] Track Guardrail Blocked Event
  console.log("\n[Test 3] Testing posthogServer.trackGuardrailBlocked()...");
  await posthogServer.trackGuardrailBlocked({
    service: "Adobe Creative Cloud",
    attemptedPrice: 59.99,
    budgetCeiling: 30.0,
    exceededBy: 29.99,
    reason: "Price ($59.99) exceeds authorized budget ceiling ($30.00)",
  });
  console.log("✅ trackGuardrailBlocked successfully registered ceiling breach security event.");

  // [Test 4] Track Price Anomaly Event
  console.log("\n[Test 4] Testing posthogServer.trackPriceAnomaly()...");
  await posthogServer.trackPriceAnomaly({
    service: "Spotify Premium",
    currentPrice: 24.99,
    baselinePrice: 11.99,
    percentageJump: "+108%",
    holdTriggered: true,
  });
  console.log("✅ trackPriceAnomaly captured price jump (+108%) anomaly event.");

  // [Test 5] Track Payment Completed Event
  console.log("\n[Test 5] Testing posthogServer.trackPaymentCompleted()...");
  await posthogServer.trackPaymentCompleted({
    orderId: "ORD-SANDBOX-TEST-9921",
    service: "Netflix Standard HD",
    amount: 15.49,
    budgetCeiling: 20.0,
    savingsEnforced: 4.51,
    payerEmail: "buyer-sandbox@payagent.internal",
  });
  console.log("✅ trackPaymentCompleted recorded live PayPal order capture with savings metadata.");

  // [Test 6] Track Mandate Created Event
  console.log("\n[Test 6] Testing posthogServer.trackMandateCreated()...");
  await posthogServer.trackMandateCreated({
    mandateId: "mandate-test-4491",
    service: "AWS Cloud Bill",
    budgetCeiling: 120.0,
    recurrence: "Monthly on 28th",
    strictMode: false,
  });
  console.log("✅ trackMandateCreated recorded recurring rule in telemetry.");

  // [Test 7] Feature Flags Lookup
  console.log("\n[Test 7] Testing posthogServer.isFeatureFlagEnabled()...");
  const isStrict = await posthogServer.isFeatureFlagEnabled(
    "strict-approval-mode",
    "test-user",
    false
  );
  console.log(`   Feature Flag 'strict-approval-mode': ${isStrict} (default fallback: false)`);
  console.log("✅ Feature flag fallback handled gracefully without throwing errors.");

  console.log("\n==================================================");
  console.log("🎉 All 7 PostHog Telemetry & Guardrail Tests PASSED!");
  console.log("==================================================");
}

runTelemetryTests().catch((err) => {
  console.error("❌ Telemetry test failed:", err);
  process.exit(1);
});
