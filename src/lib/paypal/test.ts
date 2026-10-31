import {
  payPalOAuth,
  payPalOrders,
  payPalMCP,
  executeMandatePayment,
} from "./index";

async function runPayPalIntegrationTest() {
  console.log("==================================================");
  console.log("🚀 Testing PayPal SDK, OAuth & MCP Integration");
  console.log("==================================================");

  // 1. Test OAuth Token Generation
  console.log("\n[Test 1] Testing OAuth2 Token Acquisition...");
  const token = await payPalOAuth.getAccessToken();
  console.log("✅ OAuth2 Token received successfully:", token.substring(0, 30) + "...");
  console.log("   Mode:", payPalOAuth.isLiveCredentialsConfigured() ? "LIVE SANDBOX" : "SIMULATED SANDBOX");

  // 2. Test MCP Tool Catalog
  console.log("\n[Test 2] Querying PayPal MCP Tool Definitions...");
  const tools = payPalMCP.getAvailableTools();
  console.log(`✅ Discovered ${tools.length} official PayPal MCP tools:`);
  tools.forEach((t) => console.log(`   - ${t.name}: ${t.description}`));

  // 3. Test Order Creation
  console.log("\n[Test 3] Creating Order (PayPal Orders v2)...");
  const order = await payPalOrders.createOrder({
    amount: 15.49,
    currency: "USD",
    serviceName: "Netflix Standard HD",
    mandateId: "mandate-1",
  });
  console.log("✅ Order Created successfully:", {
    id: order.id,
    status: order.status,
    amount: order.purchase_units[0].amount.value,
    currency: order.purchase_units[0].amount.currency_code,
  });

  // 4. Test Payment Capture & Digital Receipt Generation
  console.log("\n[Test 4] Capturing Order Payment & Generating Digital Receipt...");
  const { capture, receipt } = await payPalOrders.captureOrder(order.id, {
    serviceName: "Netflix Standard HD",
    verifiedPrice: 15.49,
    budgetCeiling: 20.0,
  });
  console.log("✅ Payment Captured successfully:", {
    captureId: capture.id,
    orderId: capture.orderId,
    status: capture.status,
    authCode: capture.authorizationCode,
  });
  console.log("🧾 Digital Receipt Payload Generated:", receipt);

  // 5. Test Autonomous Mandate Flow with Guardrails
  console.log("\n[Test 5] Executing Full Mandate Payment with Budget Ceiling...");
  const mandateResult = await executeMandatePayment({
    serviceName: "Spotify Premium",
    verifiedPrice: 11.99,
    budgetCeiling: 15.0,
    currency: "USD",
    mandateId: "mandate-2",
  });
  console.log("✅ Full Mandate Execution Succeeded:", {
    orderId: mandateResult.orderId,
    captureId: mandateResult.captureId,
    status: mandateResult.receipt.status,
    service: mandateResult.receipt.service,
  });

  // 6. Test Safety Guardrail Block
  console.log("\n[Test 6] Testing Guardrail Interception (Price > Ceiling)...");
  try {
    await executeMandatePayment({
      serviceName: "Adobe Creative Cloud",
      verifiedPrice: 59.99,
      budgetCeiling: 30.0, // Should fail guardrail!
      currency: "USD",
    });
    console.error("❌ Guardrail failed to trigger!");
    process.exit(1);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.log("🛡️ Guardrail Successfully Blocked Exorbitant Transaction:", message);
  }

  console.log("\n==================================================");
  console.log("🎉 All 6 PayPal Integration & MCP Tests PASSED!");
  console.log("==================================================");
}

runPayPalIntegrationTest().catch((err) => {
  console.error("Integration test failed:", err);
  process.exit(1);
});
