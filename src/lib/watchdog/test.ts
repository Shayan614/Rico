import { watchdogEngine } from "./watchdog-engine";

async function runWatchdogTests() {
  console.log("==================================================");
  console.log("⚡ Testing 2.8 Batch Contract & Subscription Watchdog");
  console.log("==================================================");

  const referenceDate = new Date("2026-11-06T00:00:00Z").getTime();

  // [Test 1] Free-Trial Expiration Sentinel
  console.log("\n[Test 1] Testing Free-Trial Expiration Sentinel (Expiry in 24h)...");
  const trialResult = await watchdogEngine.auditContract(
    {
      service: "Grammarly Business Trial",
      type: "FREE_TRIAL",
      currentPrice: 30.0,
      renewalDate: "2026-11-07", // 1 day remaining!
      noticePeriodDays: 2,
    },
    referenceDate
  );

  console.log("   Risk Level:", trialResult.riskLevel);
  console.log("   Is Urgent:", trialResult.isUrgent);
  console.log("   Days Until Renewal:", trialResult.contract.daysUntilRenewal);
  console.log("   Recommended Action:", trialResult.recommendedActions[0]?.label);
  console.log("   Est. Annual Savings:", `$${trialResult.totalPotentialSavingsUsd}`);

  if (
    trialResult.riskLevel !== "CRITICAL" ||
    !trialResult.isUrgent ||
    trialResult.recommendedActions[0]?.type !== "CANCEL_TRIAL"
  ) {
    throw new Error("Test 1 Failed: Free-trial expiring in 24h must trigger CRITICAL risk & CANCEL_TRIAL action!");
  }
  console.log("✅ Test 1 Passed: Free trial expiration sentinel correctly flagged CRITICAL emergency.");

  // [Test 2] Vendor Contract 60-Day Auto-Renew Window & Notice Deadline
  console.log("\n[Test 2] Testing 60-Day Contract Auto-Renew Lock-In Window...");
  // Contract renews in 65 days, notice period is 60 days -> 5 days remaining before lock-in!
  const contractResult = await watchdogEngine.auditContract(
    {
      service: "Salesforce Enterprise CRM",
      type: "ANNUAL_CONTRACT",
      currentPrice: 15000.0,
      renewalDate: "2027-01-10",
      noticePeriodDays: 60,
    },
    referenceDate
  );

  console.log("   Days Until Renewal:", contractResult.contract.daysUntilRenewal);
  console.log("   Days Until Notice Deadline:", contractResult.contract.daysUntilNoticeDeadline);
  console.log("   Risk Level:", contractResult.riskLevel);
  console.log("   Notice Deadline:", contractResult.contract.cancellationDeadline);
  console.log("   Top Action:", contractResult.recommendedActions[0]?.label);

  if (
    contractResult.contract.daysUntilNoticeDeadline > 15 ||
    contractResult.riskLevel !== "HIGH"
  ) {
    throw new Error("Test 2 Failed: Expected HIGH risk for contract within 15 days of 60-day notice deadline!");
  }
  console.log("✅ Test 2 Passed: 60-day auto-renew notice window caught impending contract lock-in.");

  // [Test 3] Zombie Seat Audit & Wasted Spend Analysis
  console.log("\n[Test 3] Testing Zombie Seat License Audit (50 seats, 35 active = 15 zombie seats)...");
  const zombieResult = await watchdogEngine.auditContract(
    {
      service: "Figma Organization",
      type: "MONTHLY_RECURRING",
      currentPrice: 2250.0, // 50 seats @ $45/mo
      renewalDate: "2026-11-20",
      totalSeats: 50,
      activeSeats: 35,
      costPerSeatUsd: 45.0,
    },
    referenceDate
  );

  const zAnalysis = zombieResult.zombieSeats;
  console.log("   Total Seats:", zAnalysis?.totalSeats);
  console.log("   Active Seats:", zAnalysis?.activeSeats);
  console.log("   Zombie Seats:", zAnalysis?.zombieSeats);
  console.log("   Wasted Monthly Spend:", `$${zAnalysis?.wastedMonthlySpendUsd}/mo`);
  console.log("   Potential Annual Savings:", `$${zAnalysis?.potentialAnnualSavingsUsd}/yr`);

  if (
    zAnalysis?.zombieSeats !== 15 ||
    zAnalysis?.wastedMonthlySpendUsd !== 675.0 ||
    zAnalysis?.potentialAnnualSavingsUsd !== 8100.0
  ) {
    throw new Error("Test 3 Failed: Zombie seat calculations incorrect!");
  }
  console.log("✅ Test 3 Passed: Zombie seats identified with $8,100/yr recoverable spend.");

  // [Test 4] Price Creep & Mandate Ceiling Breach Guard
  console.log("\n[Test 4] Testing Price Creep & Budget Ceiling Breach...");
  const overrunResult = await watchdogEngine.auditContract(
    {
      service: "Netflix", // Ceiling in DB is $25.00
      currentPrice: 38.99, // Exceeds ceiling!
      renewalDate: "2026-11-15",
    },
    referenceDate
  );

  console.log("   Current Price:", `$${overrunResult.contract.currentPrice}`);
  console.log("   Budget Ceiling:", `$${overrunResult.contract.budgetCeiling}`);
  console.log("   Risk Level:", overrunResult.riskLevel);
  console.log("   Top Action:", overrunResult.recommendedActions[0]?.type);

  if (overrunResult.riskLevel !== "CRITICAL" || overrunResult.recommendedActions[0]?.type !== "PAUSE_MANDATE") {
    throw new Error("Test 4 Failed: Price exceeding mandate ceiling must trigger CRITICAL PAUSE_MANDATE!");
  }
  console.log("✅ Test 4 Passed: Budget ceiling overrun triggered PAUSE_MANDATE protection.");

  // [Test 5] Omnichannel Alert Formatting
  console.log("\n[Test 5] Testing Omnichannel Alert Notification Message...");
  console.log("--- Alert Preview ---");
  console.log(trialResult.omnichannelMessage);
  console.log("---------------------");

  if (!trialResult.omnichannelMessage.includes("CRITICAL WATCHDOG ALERT") || !trialResult.omnichannelMessage.includes("Action:")) {
    throw new Error("Test 5 Failed: Omnichannel alert message missing required alert headers or actions!");
  }
  console.log("✅ Test 5 Passed: Omnichannel alert message formatted with action links.");

  // [Test 6] Parallel High-Throughput Batch Audit using Worker Pool
  console.log("\n[Test 6] Testing High-Throughput Parallel Batch Audit (5 Contracts)...");
  const batchInputs = [
    { service: "Grammarly Trial", type: "FREE_TRIAL" as const, currentPrice: 30, renewalDate: "2026-11-08" },
    { service: "Salesforce CRM", type: "ANNUAL_CONTRACT" as const, currentPrice: 12000, renewalDate: "2027-01-05", noticePeriodDays: 60 },
    { service: "Figma Team", type: "MONTHLY_RECURRING" as const, currentPrice: 1500, renewalDate: "2026-11-25", totalSeats: 30, activeSeats: 22, costPerSeatUsd: 50 },
    { service: "GitHub Copilot", type: "MONTHLY_RECURRING" as const, currentPrice: 190, renewalDate: "2026-12-01", annualDiscountPercent: 20 },
    { service: "AWS Cloud", type: "MONTHLY_RECURRING" as const, currentPrice: 450, renewalDate: "2026-11-30" },
  ];

  const batchSummary = await watchdogEngine.auditBatch(batchInputs);
  console.log("   Total Audited:", batchSummary.totalAudited);
  console.log("   Critical Risks Count:", batchSummary.criticalRisksCount);
  console.log("   Zombie Seats Identified:", batchSummary.zombieSeatsIdentifiedCount);
  console.log("   Total Potential Annual Savings:", `$${batchSummary.totalPotentialAnnualSavingsUsd}`);

  if (batchSummary.totalAudited !== 5 || batchSummary.totalPotentialAnnualSavingsUsd <= 0) {
    throw new Error("Test 6 Failed: Batch audit failed to process all 5 contracts!");
  }
  console.log("✅ Test 6 Passed: Parallel batch watchdog audit successfully processed across worker pool.");

  console.log("\n==================================================");
  console.log("🎉 ALL 6 Contract & Subscription Watchdog Tests PASSED!");
  console.log("==================================================");
}

runWatchdogTests().catch((err) => {
  console.error("❌ Watchdog Tests Failed:", err);
  process.exit(1);
});
