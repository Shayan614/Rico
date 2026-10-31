import {
  geminiAgent,
  PAYAGENT_SYSTEM_PROMPT,
  buildSystemPromptWithContext,
  payAgentTools,
} from "./index";

async function runGeminiIntegrationTest() {
  console.log("==================================================");
  console.log("🤖 Testing Gemini 3.8 / 2.5 Flash Core Setup");
  console.log("==================================================");

  // 1. Test Client Initialization & Mode
  console.log("\n[Test 1] Testing Gemini Agent Client Initialization...");
  const isLive = geminiAgent.isLiveKeyConfigured();
  console.log(`✅ Gemini Agent configured. Mode: ${isLive ? "LIVE API (GEMINI_API_KEY)" : "HIGH-FIDELITY DUAL-MODE SIMULATOR"}`);
  console.log(`   Target Model: ${geminiAgent.getModelName()}`);

  // 2. Test System Prompt Generation
  console.log("\n[Test 2] Testing System Prompt & Persona Generation...");
  const basePrompt = PAYAGENT_SYSTEM_PROMPT;
  if (!basePrompt.includes("PayAgent") || !basePrompt.includes("Hard Budget Ceiling")) {
    throw new Error("System prompt is missing critical safety directives!");
  }
  console.log("✅ Base PayAgent system prompt verified (includes hard budget ceiling & anomaly directives).");

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
  if (!promptWithContext.includes("Strict Approval Mode: ENABLED") || !promptWithContext.includes("Netflix Standard HD")) {
    throw new Error("Contextual system prompt failed to inject active mandates!");
  }
  console.log("✅ Contextual system prompt verified with dynamic active mandates & strict mode injection.");

  // 3. Test Function Calling Tool Schemas
  console.log("\n[Test 3] Verifying Function Calling Tool Schemas...");
  const toolDeclarations = payAgentTools[0].functionDeclarations;
  const toolNames = toolDeclarations.map((t) => t.name);
  console.log(`✅ Discovered ${toolDeclarations.length} official PayAgent tools:`, toolNames.join(", "));

  const requiredTools = ["create_mandate", "verify_web_price", "execute_paypal_payment"];
  for (const req of requiredTools) {
    if (!toolNames.includes(req)) {
      throw new Error(`Missing expected tool schema: ${req}`);
    }
  }
  console.log("✅ All required tools (create_mandate, verify_web_price, execute_paypal_payment) correctly defined.");

  // 4. Test Streaming Response Handler
  console.log("\n[Test 4] Testing Streaming Response Handler with User Mandate...");
  const userPrompt = "Pay Netflix $15.49 on 5th, max $20.00";
  console.log(`   User Prompt: "${userPrompt}"`);

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
  console.log(`✅ Stream completed! Captured ${tokenCount} tokens and ${stepsCaptured.length} execution step events.`);
  if (receiptCaptured) {
    console.log("✅ Autonomous Receipt generated:", {
      orderId: receiptCaptured.orderId,
      service: receiptCaptured.service,
      verifiedPrice: receiptCaptured.verifiedPrice,
      status: receiptCaptured.status,
    });
  }

  // 5. Test Safety Guardrail Block in Stream
  console.log("\n[Test 5] Testing Guardrail Interception in Stream (Price > Ceiling)...");
  const guardrailPrompt = "Pay Adobe Creative Cloud $59.99, max $30.00";
  let guardrailBlocked = false;

  const guardrailStream = geminiAgent.streamResponse(guardrailPrompt);
  for await (const event of guardrailStream) {
    if (event.type === "step" && event.step?.detail?.includes("BLOCKED")) {
      guardrailBlocked = true;
    }
    if (event.type === "token" && event.text) {
      process.stdout.write(event.text);
    }
  }

  console.log("\n");
  if (!guardrailBlocked) {
    throw new Error("Guardrail failed to intercept exorbitant price in stream!");
  }
  console.log("🛡️ Guardrail Successfully Blocked Exorbitant Transaction ($59.99 > $30.00 ceiling)!");

  console.log("\n==================================================");
  console.log("🎉 All 5 Gemini 3.8 Flash Core Setup Tests PASSED!");
  console.log("==================================================");
}

runGeminiIntegrationTest().catch((err) => {
  console.error("Gemini test failed:", err);
  process.exit(1);
});
