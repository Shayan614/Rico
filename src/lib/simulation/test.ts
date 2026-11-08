import { guardrailSimulator } from "./simulator";

async function runSimulationTests() {
  console.log("==================================================");
  console.log("⚡ Testing 2.10 Guardrail Simulation & Test Harness");
  console.log("==================================================");

  const scenarios = guardrailSimulator.getScenarios();

  // [Test 1] Hard Budget Ceiling Overrun Attack
  console.log("\n[Test 1] Testing Hard Budget Ceiling Overrun Intercept...");
  const ceilingScenario = scenarios.find((s) => s.id === "sim-ceiling-breach")!;
  const res1 = await guardrailSimulator.runScenario(ceilingScenario);

  console.log("   Scenario:", res1.scenarioName);
  console.log("   Expected Status:", ceilingScenario.expectedStatus);
  console.log("   Actual Status:", res1.actualStatus);
  console.log("   Rule Triggered:", res1.ruleTriggered);
  console.log("   Zero Dollars Lost:", res1.interceptProof.zeroDollarsLost);

  if (!res1.passed || res1.actualStatus !== "BLOCKED" || res1.ruleTriggered !== "HARD_BUDGET_CEILING") {
    throw new Error("Test 1 Failed: Hard budget ceiling overrun was not blocked!");
  }
  console.log("✅ Test 1 Passed: Hard budget ceiling intercepted overrun with zero dollars lost.");

  // [Test 2] Dynamic Pricing Surge (+80% Jump)
  console.log("\n[Test 2] Testing Dynamic Pricing Surge (+80% Jump)...");
  const spikeScenario = scenarios.find((s) => s.id === "sim-price-spike-anomaly")!;
  const res2 = await guardrailSimulator.runScenario(spikeScenario);

  console.log("   Scenario:", res2.scenarioName);
  console.log("   Actual Status:", res2.actualStatus);
  console.log("   Rule Triggered:", res2.ruleTriggered);
  console.log("   Reason:", res2.reason);

  if (!res2.passed || res2.actualStatus !== "ANOMALY_HOLD") {
    throw new Error("Test 2 Failed: Price spike did not trigger ANOMALY_HOLD!");
  }
  console.log("✅ Test 2 Passed: Dynamic surge successfully paused under human-in-the-loop hold.");

  // [Test 3] Prompt Injection & Financial Jailbreak
  console.log("\n[Test 3] Testing Financial Prompt Injection Sanitizer...");
  const injectionScenario = scenarios.find((s) => s.id === "sim-prompt-injection")!;
  const res3 = await guardrailSimulator.runScenario(injectionScenario);

  console.log("   Scenario:", res3.scenarioName);
  console.log("   Actual Status:", res3.actualStatus);
  console.log("   Rule Triggered:", res3.ruleTriggered);
  console.log("   Reason:", res3.reason);

  if (!res3.passed || res3.actualStatus !== "BLOCKED" || res3.ruleTriggered !== "PROMPT_INJECTION_SANITIZER") {
    throw new Error("Test 3 Failed: Prompt injection jailbreak was not sanitized!");
  }
  console.log("✅ Test 3 Passed: Prompt injection attempt intercepted before agent evaluation.");

  // [Test 4] Concurrency Replay Race Condition
  console.log("\n[Test 4] Testing Concurrency Replay & Double-Billing Race (10 Requests)...");
  const raceScenario = scenarios.find((s) => s.id === "sim-double-billing-race")!;
  const res4 = await guardrailSimulator.runScenario(raceScenario);

  console.log("   Scenario:", res4.scenarioName);
  console.log("   Actual Status:", res4.actualStatus);
  console.log("   Rule Triggered:", res4.ruleTriggered);
  console.log("   Reason:", res4.reason);

  if (!res4.passed || res4.actualStatus !== "BLOCKED" || res4.ruleTriggered !== "ATOMIC_INFLIGHT_MUTEX") {
    throw new Error("Test 4 Failed: Replay race condition failed to trigger mutex block!");
  }
  console.log("✅ Test 4 Passed: Replay race condition blocked by in-flight atomic mutex lock.");

  // [Test 5] Currency FX Slippage & Strict Mode Enforcement
  console.log("\n[Test 5] Testing Currency Slippage & Strict Mode...");
  const fxScenario = scenarios.find((s) => s.id === "sim-currency-slippage")!;
  const res5 = await guardrailSimulator.runScenario(fxScenario);
  console.log("   FX Slippage Status:", res5.actualStatus, "| Rule:", res5.ruleTriggered);

  const strictScenario = scenarios.find((s) => s.id === "sim-strict-mode")!;
  const resStrict = await guardrailSimulator.runScenario(strictScenario);
  console.log("   Strict Mode Status:", resStrict.actualStatus, "| Rule:", resStrict.ruleTriggered);

  if (!res5.passed || res5.actualStatus !== "ANOMALY_HOLD" || !resStrict.passed || resStrict.actualStatus !== "APPROVAL_REQUIRED") {
    throw new Error("Test 5 Failed: FX slippage or strict-mode checks failed!");
  }
  console.log("✅ Test 5 Passed: FX slippage and strict-mode approval policies enforced.");

  // [Test 6] Phishing / Rogue Domain Verification
  console.log("\n[Test 6] Testing Phishing / Rogue Domain Verifier...");
  const phishingScenario = scenarios.find((s) => s.id === "sim-unauthorized-merchant")!;
  const resPhishing = await guardrailSimulator.runScenario(phishingScenario);

  console.log("   Phishing Domain Status:", resPhishing.actualStatus, "| Rule:", resPhishing.ruleTriggered);
  if (!resPhishing.passed || resPhishing.actualStatus !== "BLOCKED" || resPhishing.ruleTriggered !== "DOMAIN_AUTHENTICITY_VERIFIER") {
    throw new Error("Test 6 Failed: Rogue domain was not blocked!");
  }
  console.log("✅ Test 6 Passed: Spoofed merchant domain blocked.");

  // [Test 7] Legitimate Safe Autonomous Execution
  console.log("\n[Test 7] Testing Legitimate Safe Autonomous Green-Pass...");
  const safeScenario = scenarios.find((s) => s.id === "sim-safe-execution")!;
  const resSafe = await guardrailSimulator.runScenario(safeScenario);

  console.log("   Safe Execution Status:", resSafe.actualStatus, "| Rule:", resSafe.ruleTriggered);
  if (!resSafe.passed || resSafe.actualStatus !== "PASSED") {
    throw new Error("Test 7 Failed: Legitimate safe transaction should pass!");
  }
  console.log("✅ Test 7 Passed: Legitimate transaction granted autonomous green pass.");

  // [Test 8] Full Adversarial Test Harness Report
  console.log("\n[Test 8] Running Complete Adversarial Test Harness (All 8 Scenarios)...");
  const fullReport = await guardrailSimulator.runAllScenarios();

  console.log("   Total Scenarios Executed:", fullReport.totalScenarios);
  console.log("   Passed Scenarios:", fullReport.passedScenarios);
  console.log("   Failed Scenarios:", fullReport.failedScenarios);
  console.log("   Composite Safety Index:", `${fullReport.compositeSafetyIndex}%`);
  console.log("   Zero Phantom Charge Guarantee:", fullReport.zeroPhantomChargeGuarantee);
  console.log("   Average Intercept Latency:", `${fullReport.averageLatencyMs}ms`);

  if (fullReport.compositeSafetyIndex !== 100 || fullReport.failedScenarios !== 0) {
    throw new Error(`Test 8 Failed: Expected 100% Composite Safety Index, got ${fullReport.compositeSafetyIndex}%`);
  }
  console.log("✅ Test 8 Passed: Complete adversarial test harness achieved 100% safety index.");

  console.log("\n==================================================");
  console.log("🎉 ALL 8 Guardrail Simulation & Harness Tests PASSED!");
  console.log("==================================================");
}

runSimulationTests().catch((err) => {
  console.error("❌ Simulation Tests Failed:", err);
  process.exit(1);
});
