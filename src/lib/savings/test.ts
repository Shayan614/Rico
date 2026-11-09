import { db, mandates, transactions, users } from "@/db";
import { eq } from "drizzle-orm";
import { personaSavingsOptimizer } from "./savings-engine";
import { PERSONA_DEALS_MATRIX } from "./deal-matrix";

async function runPersonaSavingsTests() {
  console.log("==================================================");
  console.log("💡 Testing Persona-Based Savings & Credits Optimizer");
  console.log("==================================================");

  // 1. Verify Deal Matrix Integrity
  console.log("\n[Test 1] Verifying Deal Matrix Programs...");
  console.log(`   Total Programs Configured: ${PERSONA_DEALS_MATRIX.length}`);
  const startupDeals = PERSONA_DEALS_MATRIX.filter((d) => d.persona === "STARTUP_FOUNDER");
  const studentDeals = PERSONA_DEALS_MATRIX.filter((d) => d.persona === "STUDENT");
  const devDeals = PERSONA_DEALS_MATRIX.filter((d) => d.persona === "DEVELOPER_SMB");

  console.log(`   • Startup Deals: ${startupDeals.length} ($50k PostHog, Notion, AWS)`);
  console.log(`   • Student Deals: ${studentDeals.length} (Spotify, Adobe, GitHub)`);
  console.log(`   • Developer / SMB Deals: ${devDeals.length} (Coupons, Arbitrage)`);

  if (startupDeals.length < 3 || studentDeals.length < 3 || devDeals.length < 2) {
    throw new Error("Deal matrix missing required programs!");
  }
  console.log("✅ Deals matrix loaded with high-fidelity programs.");

  // 2. Test Startup Founder: PostHog $50k Credits Probe
  console.log("\n[Test 2] Testing Startup Founder Persona: PostHog Probe...");
  const posthogProbe = await personaSavingsOptimizer.probePersonaSavings({
    serviceName: "PostHog Analytics & Session Replay",
    currentPrice: 120.0,
    persona: "STARTUP_FOUNDER",
  });

  console.log("   PostHog Probe Result:", {
    hasDeals: posthogProbe.hasDeals,
    bestDeal: posthogProbe.bestDeal?.headline,
    reclaimedCredits: posthogProbe.reclaimedCredits,
  });

  if (!posthogProbe.hasDeals || posthogProbe.reclaimedCredits !== 50000) {
    throw new Error("Failed to detect $50,000 PostHog startup credits for Startup Founder!");
  }
  console.log("✅ Startup Founder correctly intercepted with $50,000 in PostHog credits.");

  // 3. Test Student Profile: Spotify 50% Off & Adobe 64% Off
  console.log("\n[Test 3] Testing Student Profile Persona: Spotify & Adobe Probes...");
  const spotifyProbe = await personaSavingsOptimizer.probePersonaSavings({
    serviceName: "Spotify Premium",
    currentPrice: 11.99,
    persona: "STUDENT",
  });

  console.log("   Spotify Student Result:", {
    originalPrice: spotifyProbe.originalPrice,
    discountedPrice: spotifyProbe.discountedPrice,
    directSavings: spotifyProbe.directSavings,
  });

  if (spotifyProbe.discountedPrice !== 5.99 || spotifyProbe.directSavings !== 6.0) {
    throw new Error("Spotify student discount calculation failed!");
  }
  console.log("✅ Spotify student rate correctly reduced from $11.99 to $5.99/mo (50% off).");

  const adobeProbe = await personaSavingsOptimizer.probePersonaSavings({
    serviceName: "Adobe Creative Cloud",
    currentPrice: 54.99,
    persona: "STUDENT",
  });

  if (adobeProbe.discountedPrice !== 19.99) {
    throw new Error("Adobe student discount calculation failed!");
  }
  console.log("✅ Adobe student rate correctly reduced from $54.99 to $19.99/mo (64% off).");

  // 4. Test Developer / SMB: Active Promo Code (SAVE20)
  console.log("\n[Test 4] Testing Developer / SMB Persona: Promo Code & Arbitrage...");
  const chatgptProbe = await personaSavingsOptimizer.probePersonaSavings({
    serviceName: "ChatGPT Plus",
    currentPrice: 20.0,
    persona: "DEVELOPER_SMB",
  });

  if (chatgptProbe.discountedPrice !== 16.0 || chatgptProbe.bestDeal?.couponCode !== "SAVE20") {
    throw new Error("Coupon code application failed for Developer / SMB!");
  }
  console.log("✅ Promo code SAVE20 applied: $20.00 -> $16.00 (20% off).");

  // 5. Test Discounted PayPal Payment Execution via Sandbox MCP
  console.log("\n[Test 5] Executing Discounted PayPal Capture via applySavingsPayment()...");
  const savingsOwnerId = "usr_savings_test";
  db.insert(users).values({ id: savingsOwnerId, email: "savings-test@example.test" }).onConflictDoNothing().run();
  const savingsMandateId = `mandate-savings-${Date.now()}`;
  db.insert(mandates).values({
    id: savingsMandateId,
    ownerId: savingsOwnerId,
    service: "Spotify Premium Student",
    budgetCeiling: 15.0,
    lastScrapedPrice: 11.99,
    recurrence: "Monthly",
    nextRun: "Dec 1, 2026",
  }).run();
  const paymentExecution = await personaSavingsOptimizer.applySavingsPayment({
    serviceName: "Spotify Premium Student",
    discountedPrice: 5.99,
    mandateId: savingsMandateId,
    ownerId: savingsOwnerId,
    dealId: "deal-spotify-student",
    fundingRail: "PAYPAL",
  });

  console.log("   Payment Result:", {
    success: paymentExecution.success,
    orderId: paymentExecution.orderId,
    dollarsSaved: paymentExecution.dollarsSaved,
    receiptPrice: paymentExecution.receipt.verifiedPrice,
  });

  if (
    !paymentExecution.success ||
    paymentExecution.receipt.verifiedPrice !== 5.99 ||
    paymentExecution.dollarsSaved !== 6.0
  ) {
    throw new Error("Payment execution for discounted total failed!");
  }

  // Verify transaction in SQLite
  const tx = db
    .select()
    .from(transactions)
    .where(eq(transactions.orderId, paymentExecution.orderId))
    .get();

  if (!tx || tx.amount !== 5.99) {
    throw new Error("Transaction record missing or incorrect in SQLite transactions table!");
  }
  console.log("✅ Discounted payment captured and recorded in SQLite transactions:", tx.id);

  console.log("\n==================================================");
  console.log("🎉 All Persona Savings & Credits Optimizer Tests PASSED!");
  console.log("==================================================");
  process.exit(0);
}

runPersonaSavingsTests().catch((err) => {
  console.error("Persona savings test failed:", err);
  process.exit(1);
});
