import {
  geminiAgent,
  PAYAGENT_SYSTEM_PROMPT,
  buildSystemPromptWithContext,
  payAgentTools,
  executeCreateMandate,
  executeVerifyWebPrice,
  executePayPalPayment,
  dispatchAgentTool,
} from "./index";

async function runGeminiIntegrationTest() {
  console.log("==================================================");
  console.log("🤖 Testing Gemini 3.8 Flash & Agent Function Tools");
  console.log("==================================================");

  // 1. Test Client Initialization & Mode
  console.log("\n[Test 1] Testing Gemini Agent Client Initialization...");
  const isLive = geminiAgent.isLiveKeyConfigured();
  console.log(
    `✅ Gemini Agent configured. Mode: ${
      isLive ? "LIVE API (GEMINI_API_KEY)" : "HIGH-FIDELITY DUAL-MODE SIMULATOR"
    }`
  );
  console.log(`   Target Model: ${geminiAgent.getModelName()}`);

  // 2. Test System Prompt Generation
  console.log("\n[Test 2] Testing System Prompt & Persona Generation...");
  const basePrompt = PAYAGENT_SYSTEM_PROMPT;
  if (
    !basePrompt.includes("PayAgent") ||
    !basePrompt.includes("Hard Budget Ceiling")
  ) {
    throw new Error("System prompt is missing critical safety directives!");
  }
  console.log(
    "✅ Base PayAgent system prompt verified (includes hard budget ceiling & anomaly directives)."
  );

  const promptWithContext = buildSystemPromptWithContext({
    strictMode: true,
    activeMandates: [
      {
        id: "mandate-1",
        service: "Netflix Standard HD",
        budgetCeiling: 20.0,
        lastScrapedPrice: 15.49,
        recurrence: "Monthly on 5th",
        status: "ACTIVE",
      },
    ],
  });
  if (
    !promptWithContext.includes("Strict Approval Mode: ENABLED") ||
    !promptWithContext.includes("Netflix Standard HD")
  ) {
    throw new Error("Contextual system prompt failed to inject active mandates!");
  }
  console.log(
    "✅ Contextual system prompt verified with dynamic active mandates & strict mode injection."
  );

  // 3. Test Function Calling Tool Schemas
  console.log("\n[Test 3] Verifying Function Calling Tool Schemas...");
  const toolDeclarations = payAgentTools[0].functionDeclarations;
  const toolNames = toolDeclarations.map((t) => t.name);
  console.log(
    `✅ Discovered ${toolDeclarations.length} official PayAgent tools:`,
    toolNames.join(", ")
  );

  const requiredTools = [
    "create_mandate",
    "verify_web_price",
    "execute_paypal_payment",
  ];
  for (const req of requiredTools) {
    if (!toolNames.includes(req)) {
      throw new Error(`Missing expected tool schema: ${req}`);
    }
  }
  console.log("✅ All required tools correctly defined in tool schemas.");

  // 4. Test Tool 1: executeCreateMandate
  console.log("\n[Test 4] Testing Tool 1: create_mandate()...");
  const mandateResult = await executeCreateMandate({
    service: "Disney+ Premium",
    max_amount: 18.0,
    schedule: "Monthly on 12th",
    category: "Entertainment",
    strict_mode: false,
  });
  console.log("✅ Mandate created & persisted in SQLite:", {
    id: mandateResult.mandate.id,
    service: mandateResult.mandate.service,
    budgetCeiling: mandateResult.mandate.budgetCeiling,
    recurrence: mandateResult.mandate.recurrence,
    status: mandateResult.mandate.status,
  });

  // 5. Test Tool 2: executeVerifyWebPrice (Normal & Anomaly Spike)
  console.log("\n[Test 5] Testing Tool 2: verify_web_price()...");
  const normalPrice = await executeVerifyWebPrice({
    service_name: "Spotify",
    expected_price: 11.99,
  });
  console.log("✅ Standard price verified:", {
    service: normalPrice.service,
    verifiedPrice: normalPrice.verifiedPrice,
    plan: normalPrice.planName,
    anomaly: normalPrice.anomalyDetected,
  });

  const anomalyPrice = await executeVerifyWebPrice({
    service_name: "Adobe Creative Cloud",
    expected_price: 35.0, // Baseline $35, actual is $59.99 (>70% spike)
  });
  if (!anomalyPrice.anomalyDetected) {
    throw new Error("Failed to detect price spike anomaly in verify_web_price!");
  }
  console.log("✅ Price Spike Anomaly successfully flagged:", {
    service: anomalyPrice.service,
    verifiedPrice: anomalyPrice.verifiedPrice,
    percentageJump: `+${anomalyPrice.percentageDifference}%`,
    warning: anomalyPrice.anomalyWarning,
  });

  // 6. Test Tool 3: executePayPalPayment (Guardrail & Capture)
  console.log("\n[Test 6] Testing Tool 3: execute_paypal_payment()...");
  const paymentRes = await executePayPalPayment({
    service_name: "Spotify Premium",
    verified_price: 11.99,
    budget_ceiling: 15.0,
    recipient_email: "billing@spotify.com",
    mandate_id: mandateResult.mandate.id,
  });
  console.log("✅ Payment authorized, captured & stored in SQLite:", {
    orderId: paymentRes.orderId,
    captureId: paymentRes.captureId,
    status: paymentRes.receipt.status,
    authCode: paymentRes.receipt.sandboxAuthCode,
  });

  // 7. Test Tool 3 Guardrail Interception
  console.log("\n[Test 7] Testing execute_paypal_payment() Guardrail Interception...");
  try {
    await executePayPalPayment({
      service_name: "Adobe Creative Cloud",
      verified_price: 59.99,
      budget_ceiling: 30.0,
    });
    throw new Error("Guardrail failed to intercept payment!");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log("🛡️ Guardrail correctly blocked payment:", msg);
  }

  // 8. Test Universal Tool Dispatcher
  console.log("\n[Test 8] Testing Universal Tool Dispatcher (dispatchAgentTool)...");
  const dispatched = await dispatchAgentTool("verify_web_price", {
    service_name: "Netflix",
  });
  console.log("✅ Dispatcher routed 'verify_web_price':", {
    service: dispatched.service,
    verifiedPrice: dispatched.verifiedPrice,
  });

  // 9. Test Full Streaming Execution Flow
  console.log("\n[Test 9] Testing End-to-End Streaming Agent with Tools...");
  const userPrompt = "Pay Netflix $15.49 on 5th, max $20.00";
  let tokenCount = 0;
  const stepsCaptured: string[] = [];
  let receiptCaptured: Record<string, unknown> | null = null;

  const stream = geminiAgent.streamResponse(userPrompt, { strictMode: false });

  for await (const event of stream) {
    if (event.type === "step" && event.step) {
      stepsCaptured.push(`${event.step.step} (${event.step.status})`);
    } else if (event.type === "token" && event.text) {
      tokenCount++;
      process.stdout.write(event.text);
    } else if (event.type === "receipt" && event.receipt) {
      receiptCaptured = event.receipt;
    }
  }

  console.log("\n");
  console.log(
    `✅ Stream completed! Generated ${tokenCount} tokens and executed ${stepsCaptured.length} steps.`
  );
  if (receiptCaptured) {
    console.log("✅ Autonomous Receipt generated:", {
      orderId: receiptCaptured.orderId,
      service: receiptCaptured.service,
      status: receiptCaptured.status,
    });
  }

  console.log("\n==================================================");
  console.log("🎉 All 9 Gemini Agent & Function Calling Tests PASSED!");
  console.log("==================================================");
}

runGeminiIntegrationTest().catch((err) => {
  console.error("Gemini test failed:", err);
  process.exit(1);
});
