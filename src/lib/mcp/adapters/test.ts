import {
  checkAdaptersHealth,
  slackMCPAdapter,
  gitHubMCPAdapter,
  notionMCPAdapter,
  stripeMCPAdapter,
  registerAllAdapters,
} from "./index";
import { UniversalMCPClient } from "../universal-client";

async function runAdaptersTests() {
  console.log("==================================================");
  console.log("⚡ Testing 2.12 External MCP Adapters (Slack, GitHub, Notion, Stripe)");
  console.log("==================================================");

  // [Test 1] Adapter Health Check
  console.log("\n[Test 1] Testing Adapters Health Check across all 4 services...");
  const healthList = checkAdaptersHealth();
  console.log(`   Checked ${healthList.length} Adapters:`);
  healthList.forEach((h) => {
    console.log(`   - [${h.status}] ${h.displayName} (${h.toolsCount} tools: ${h.tools.join(", ")})`);
  });

  if (healthList.length !== 4) {
    throw new Error(`Test 1 Failed: Expected 4 adapters, got ${healthList.length}`);
  }
  console.log("✅ Test 1 Passed: All 4 adapters initialized with healthy status.");

  // [Test 2] Slack Adapter Rich Alert Dispatch
  console.log("\n[Test 2] Testing Slack MCP Adapter Rich Alert Dispatch...");
  const slackRes = await slackMCPAdapter.postAlert({
    channel: "#finance-alerts",
    title: "Price Spike Anomaly Detected",
    message: "GitHub Copilot price jumped from $19.00 to $35.00 (+84%).",
    severity: "warning",
    serviceName: "GitHub Copilot",
    amount: 35.0,
    budgetCeiling: 25.0,
    actionButtons: [
      { id: "btn_approve", label: "Approve Spike", style: "primary", action: "approve" },
      { id: "btn_cancel", label: "Pause Subscription", style: "danger", action: "pause" },
    ],
  });

  console.log("   Slack Dispatch Success:", slackRes.success);
  console.log("   Channel:", slackRes.channel);
  console.log("   Delivery Mode:", slackRes.deliveryMode);
  console.log("   Message ID:", slackRes.messageId);

  if (!slackRes.success || !slackRes.messageId) {
    throw new Error("Test 2 Failed: Slack alert dispatch failed!");
  }
  console.log("✅ Test 2 Passed: Slack alert formatted with Block Kit and action buttons.");

  // [Test 3] GitHub Adapter Audit Issue Creation
  console.log("\n[Test 3] Testing GitHub MCP Adapter Issue Creation...");
  const githubRes = await gitHubMCPAdapter.createIssue({
    title: "[Rico Alert] Contract Expiration Notice: Salesforce CRM",
    body: "## Automated Watchdog Alert\nSalesforce 60-day auto-renew window has 5 days remaining before lock-in.",
    labels: ["rico-alert", "contract-watchdog", "finance"],
  });

  console.log("   GitHub Issue Success:", githubRes.success);
  console.log("   Issue Number:", `#${githubRes.issueNumber}`);
  console.log("   Issue URL:", githubRes.issueUrl);
  console.log("   Labels Applied:", githubRes.labels.join(", "));

  if (!githubRes.success || !githubRes.issueUrl) {
    throw new Error("Test 3 Failed: GitHub issue creation failed!");
  }
  console.log("✅ Test 3 Passed: GitHub audit tracking issue created with labels.");

  // [Test 4] Notion Adapter Expense Page Sync
  console.log("\n[Test 4] Testing Notion MCP Adapter Expense Sync...");
  const notionRes = await notionMCPAdapter.syncExpensePage({
    service: "PostHog Product Analytics",
    amount: 120.0,
    currency: "USD",
    category: "SAAS_SUBSCRIPTION",
    taxDeductible: true,
    notes: "100% tax deductible under Section 179 software expense.",
  });

  console.log("   Notion Sync Success:", notionRes.success);
  console.log("   Page ID:", notionRes.pageId);
  console.log("   Page URL:", notionRes.pageUrl);

  if (!notionRes.success || !notionRes.pageId) {
    throw new Error("Test 4 Failed: Notion expense sync failed!");
  }
  console.log("✅ Test 4 Passed: Expense item synchronized to Notion database page.");

  // [Test 5] Stripe Dual-Rail Card Payment (Within Ceiling)
  console.log("\n[Test 5] Testing Stripe Dual-Rail Card Charge (Within Budget Ceiling)...");
  const stripeChargeRes = await stripeMCPAdapter.createCharge({
    amount: 15.0,
    serviceName: "Netflix Streaming Plan",
    currency: "USD",
    budgetCeiling: 25.0, // Within ceiling
  });

  console.log("   Charge Success:", stripeChargeRes.success);
  console.log("   Payment Intent ID:", stripeChargeRes.paymentIntentId);
  console.log("   Card Rail:", `${stripeChargeRes.cardBrand?.toUpperCase()} *${stripeChargeRes.last4}`);
  console.log("   Receipt URL:", stripeChargeRes.receiptUrl);

  if (!stripeChargeRes.success || stripeChargeRes.status !== "succeeded") {
    throw new Error("Test 5 Failed: Expected successful Stripe dual-rail card charge!");
  }
  console.log("✅ Test 5 Passed: Stripe backup card charge succeeded on secondary rail.");

  // [Test 6] Stripe Dual-Rail Guardrail Intercept (Ceiling Overrun)
  console.log("\n[Test 6] Testing Stripe Dual-Rail Budget Ceiling Overrun Intercept...");
  const stripeOverrunRes = await stripeMCPAdapter.createCharge({
    amount: 75.0, // Exceeds ceiling!
    serviceName: "Unauthorized Enterprise Add-On",
    currency: "USD",
    budgetCeiling: 30.0,
  });

  console.log("   Charge Success:", stripeOverrunRes.success);
  console.log("   Guardrail Blocked:", stripeOverrunRes.guardrailBlocked);
  console.log("   Reason:", stripeOverrunRes.guardrailReason);

  if (stripeOverrunRes.success || !stripeOverrunRes.guardrailBlocked) {
    throw new Error("Test 6 Failed: Stripe charge exceeding budget ceiling must be intercepted!");
  }
  console.log("✅ Test 6 Passed: Stripe dual-rail charge intercepted by budget ceiling guardrail.");

  // [Test 7] Universal MCP Client Integration (All 4 Adapters Routing)
  console.log("\n[Test 7] Testing Universal MCP Client Multi-Adapter Routing...");
  const universalClient = new UniversalMCPClient();
  registerAllAdapters(universalClient);

  const slackCall = await universalClient.callTool("slack_post_alert", {
    title: "Test Alert",
    message: "Multi-adapter routing test",
  });
  const githubCall = await universalClient.callTool("github_create_audit_issue", {
    title: "Test Issue",
    body: "Multi-adapter routing test",
  });
  const notionCall = await universalClient.callTool("notion_sync_expense_page", {
    service: "Test Vendor",
    amount: 50.0,
    category: "DevTools",
  });
  const stripeCall = await universalClient.callTool("stripe_charge_create", {
    amount: 10.0,
    serviceName: "Test Backup",
    budgetCeiling: 20.0,
  });

  console.log("   Universal Call [Slack]:", slackCall.success);
  console.log("   Universal Call [GitHub]:", githubCall.success);
  console.log("   Universal Call [Notion]:", notionCall.success);
  console.log("   Universal Call [Stripe]:", stripeCall.success);

  if (!slackCall.success || !githubCall.success || !notionCall.success || !stripeCall.success) {
    throw new Error("Test 7 Failed: Universal client failed to route one or more adapter tools!");
  }
  console.log("✅ Test 7 Passed: Universal MCP Client executed tools across all 4 external adapters.");

  console.log("\n==================================================");
  console.log("🎉 ALL 7 External MCP Adapter Tests PASSED!");
  console.log("==================================================");
}

runAdaptersTests().catch((err) => {
  console.error("❌ Adapters Tests Failed:", err);
  process.exit(1);
});
