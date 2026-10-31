import {
  evaluateFinancialGuardrails,
  checkBudgetCeiling,
  checkPriceAnomaly,
} from "./index";

async function runGuardrailSafetyTest() {
  console.log("==================================================");
  console.log("🛡️ Testing PayAgent Safety & Guardrail Engine");
  console.log("==================================================");

  // 1. Test Budget Ceiling Check Function
  console.log("\n[Test 1] Testing checkBudgetCeiling()...");
  const ceilingPass = checkBudgetCeiling(15.49, 20.0);
  console.log("   $15.49 <= $20.00 ➔", ceilingPass);
  if (ceilingPass.exceeded) throw new Error("Expected budget ceiling to pass!");

  const ceilingFail = checkBudgetCeiling(59.99, 30.0);
  console.log("   $59.99 > $30.00 ➔", ceilingFail);
  if (!ceilingFail.exceeded || ceilingFail.diff !== 29.99) {
    throw new Error("Expected budget ceiling to fail with diff $29.99!");
  }
  console.log("✅ checkBudgetCeiling correctly evaluated passing & exceeding amounts.");

  // 2. Test Price Anomaly Spike Detection
  console.log("\n[Test 2] Testing checkPriceAnomaly()...");
  const normalPrice = checkPriceAnomaly(12.99, 11.99, 20); // ~8% increase
  console.log("   $11.99 ➔ $12.99 (+8%) ➔ isAnomaly:", normalPrice.isAnomaly);
  if (normalPrice.isAnomaly) throw new Error("8% jump should not be flagged as anomaly (>20%)!");

  const spikePrice = checkPriceAnomaly(59.99, 35.0, 20); // +71% increase
  console.log("   $35.00 ➔ $59.99 (+71%) ➔ isAnomaly:", spikePrice.isAnomaly);
  if (!spikePrice.isAnomaly || spikePrice.percentageJump < 20) {
    throw new Error("71% jump must be flagged as anomaly!");
  }
  console.log(`✅ checkPriceAnomaly successfully identified price jump (+${spikePrice.percentageJump}%).`);

  // 3. Test Full Tier 1: Hard Budget Ceiling Block
  console.log("\n[Test 3] Testing Tier 1: Hard Budget Ceiling Block in evaluateFinancialGuardrails()...");
  const blockResult = await evaluateFinancialGuardrails({
    serviceName: "Adobe Creative Cloud",
    scrapedPrice: 59.99,
    budgetCeiling: 30.0,
    expectedPrice: 30.0,
  });
  console.log("✅ Hard ceiling evaluated:", {
    status: blockResult.status,
    budgetExceeded: blockResult.budgetExceeded,
    exceededBy: blockResult.exceededBy,
  });
  if (blockResult.status !== "BLOCKED" || !blockResult.budgetExceeded) {
    throw new Error("Tier 1 Hard Budget Ceiling Block failed!");
  }

  // 4. Test Full Tier 2: Price Spike Anomaly Hold
  console.log("\n[Test 4] Testing Tier 2: Price Anomaly Hold in evaluateFinancialGuardrails()...");
  const anomalyResult = await evaluateFinancialGuardrails({
    serviceName: "GitHub Copilot Enterprise",
    scrapedPrice: 39.0, // Scraped $39
    budgetCeiling: 50.0, // Ceiling is $50 (within budget!)
    expectedPrice: 19.0, // But historical baseline was $19 (+105% jump!)
  });
  console.log("✅ Price spike evaluated:", {
    status: anomalyResult.status,
    anomalyDetected: anomalyResult.anomalyDetected,
    anomalyPercent: `+${anomalyResult.anomalyPercent}%`,
    approvalRequired: anomalyResult.approvalRequired,
  });
  if (anomalyResult.status !== "ANOMALY_HOLD" || !anomalyResult.anomalyDetected) {
    throw new Error("Tier 2 Price Anomaly Detection failed!");
  }

  // 5. Test Full Tier 3: Strict Mode Policy
  console.log("\n[Test 5] Testing Tier 3: Strict Mode Approval Policy...");
  const strictResult = await evaluateFinancialGuardrails({
    serviceName: "Netflix Standard HD",
    scrapedPrice: 15.49,
    budgetCeiling: 20.0,
    expectedPrice: 15.49,
    strictMode: true, // Strict mode enabled
  });
  console.log("✅ Strict mode evaluated:", {
    status: strictResult.status,
    approvalRequired: strictResult.approvalRequired,
    reason: strictResult.reason,
  });
  if (strictResult.status !== "APPROVAL_REQUIRED" || !strictResult.approvalRequired) {
    throw new Error("Tier 3 Strict Mode Approval Policy failed!");
  }

  // 6. Test Full Tier 4: Autonomous Green Pass
  console.log("\n[Test 6] Testing Tier 4: Autonomous Green Pass...");
  const passResult = await evaluateFinancialGuardrails({
    serviceName: "Spotify Premium",
    scrapedPrice: 11.99,
    budgetCeiling: 15.0,
    expectedPrice: 11.99,
    strictMode: false,
  });
  console.log("✅ Autonomous pass evaluated:", {
    passed: passResult.passed,
    status: passResult.status,
  });
  if (!passResult.passed || passResult.status !== "PASSED") {
    throw new Error("Tier 4 Autonomous Green Pass failed!");
  }

  console.log("\n==================================================");
  console.log("🎉 All 6 Guardrail & Safety Engine Tests PASSED!");
  console.log("==================================================");
  process.exit(0);
}

runGuardrailSafetyTest().catch((err) => {
  console.error("Guardrail test failed:", err);
  process.exit(1);
});
