import { UniversalMCPClient } from "./universal-client";
import { MCPServerConfig } from "./types";

async function runMCPTests() {
  console.log("==================================================");
  console.log("⚡ Testing 2.11 Universal MCP Client & Tool Discovery");
  console.log("==================================================");

  const client = new UniversalMCPClient();

  // [Test 1] Bootstrap Default Servers
  console.log("\n[Test 1] Testing Default Server Registry Bootstrap...");
  const servers = client.listServers();
  console.log(`   Connected Servers: ${servers.length}`);
  servers.forEach((s) => console.log(`   - [${s.status}] ${s.name} (${s.tools.length} tools, ${s.endpointUrl})`));

  if (servers.length < 4) {
    throw new Error("Test 1 Failed: Expected at least 4 default MCP servers (PayPal, GitHub, Slack, Notion)!");
  }
  console.log("✅ Test 1 Passed: Default server network registered and initialized.");

  // [Test 2] Dynamic Tool Discovery Across Connected Servers
  console.log("\n[Test 2] Testing Dynamic Tool Discovery Across Network...");
  const allTools = client.listAllTools();
  console.log(`   Total Discovered Tools: ${allTools.length}`);

  const toolNames = allTools.map((t) => t.name);
  console.log("   Tools Discovered:", toolNames.join(", "));

  if (
    !toolNames.includes("paypal_orders_create") ||
    !toolNames.includes("github_repo_get") ||
    !toolNames.includes("slack_post_message") ||
    !toolNames.includes("notion_database_query")
  ) {
    throw new Error("Test 2 Failed: Expected key tools from PayPal, GitHub, Slack, and Notion!");
  }
  console.log("✅ Test 2 Passed: Dynamic tool discovery indexed tools across all endpoints.");

  // [Test 3] LLM Schema Transformation (Gemini & OpenAI/DeepSeek formats)
  console.log("\n[Test 3] Testing LLM Tool Schema Formatting...");
  const geminiSchemas = client.formatToolsForGemini();
  const openAISchemas = client.formatToolsForOpenAI();

  console.log(`   Gemini Declarations Count: ${geminiSchemas.length}`);
  console.log(`   OpenAI / DeepSeek Tools Count: ${openAISchemas.length}`);
  console.log("   Sample OpenAI Tool:", {
    type: openAISchemas[0]?.type,
    name: openAISchemas[0]?.function.name,
    hasParameters: !!openAISchemas[0]?.function.parameters,
  });

  if (geminiSchemas.length === 0 || openAISchemas.length === 0 || openAISchemas[0]?.type !== "function") {
    throw new Error("Test 3 Failed: Schema transformation failed to generate valid LLM definitions!");
  }
  console.log("✅ Test 3 Passed: Universal client transformed tools into Gemini and OpenAI/DeepSeek formats.");

  // [Test 4] Successful Financial Tool Call (PayPal Orders Create)
  console.log("\n[Test 4] Testing Financial Tool Invocation (PayPal Orders Create)...");
  const createOrderRes = await client.callTool("paypal_orders_create", {
    amount: 15.49,
    service_name: "Spotify Premium",
    currency: "USD",
    budget_ceiling: 25.0, // Within ceiling
  });

  console.log("   Tool Result Status:", createOrderRes.success ? "SUCCESS" : "FAILED");
  const orderRecord = createOrderRes.data as Record<string, unknown> | undefined;
  console.log("   Order ID:", orderRecord?.id);
  console.log("   Latency:", `${createOrderRes.latencyMs}ms`);

  if (!createOrderRes.success || createOrderRes.isError) {
    throw new Error("Test 4 Failed: Expected successful PayPal order creation tool call!");
  }
  console.log("✅ Test 4 Passed: Financial MCP tool executed cleanly.");

  // [Test 5] Financial Pre-Execution Guardrail Intercept (Ceiling Overrun)
  console.log("\n[Test 5] Testing Pre-Execution Guardrail Intercept on Budget Breach...");
  const overrunRes = await client.callTool("paypal_orders_create", {
    amount: 95.0, // Exceeds ceiling!
    service_name: "Unauthorized Adobe Add-On",
    currency: "USD",
    budget_ceiling: 30.0, // $30 limit
  });

  console.log("   Overrun Call Success:", overrunRes.success);
  console.log("   Guardrail Blocked:", overrunRes.guardrailBlocked);
  console.log("   Reason:", overrunRes.guardrailReason);

  if (overrunRes.success || !overrunRes.guardrailBlocked) {
    throw new Error("Test 5 Failed: Financial tool call exceeding budget ceiling must be intercepted!");
  }
  console.log("✅ Test 5 Passed: Pre-execution guardrail stopped tool dispatch before financial commitment.");

  // [Test 6] Multi-Server Execution: GitHub & Slack Tool Calling
  console.log("\n[Test 6] Testing Multi-Server Non-Financial Tool Calling (GitHub & Slack)...");
  const githubRes = await client.callTool("github_repo_get", {
    owner: "abrarnasirjaffari",
    repo: "Rico",
  });
  const githubData = githubRes.data as Record<string, unknown> | undefined;
  console.log("   GitHub Repo Result:", githubData?.repo, `(Stars: ${githubData?.stars})`);

  const slackRes = await client.callTool("slack_post_message", {
    channel: "#general",
    text: "Watchdog alert: All financial guardrails passing at 100% composite score.",
  });
  const slackData = slackRes.data as Record<string, unknown> | undefined;
  console.log("   Slack Post Result:", slackData?.message_delivery);

  if (!githubRes.success || !slackRes.success) {
    throw new Error("Test 6 Failed: Multi-server execution failed for GitHub or Slack!");
  }
  console.log("✅ Test 6 Passed: Multi-server execution seamlessly routed to correct endpoint.");

  // [Test 7] Dynamic Runtime Server Connection
  console.log("\n[Test 7] Testing Dynamic Runtime Server Connection...");
  const customConfig: MCPServerConfig = {
    id: "stripe-custom-mcp",
    name: "Stripe Custom Adapter",
    endpointUrl: "https://api.stripe.com/mcp",
    transport: "HTTP",
    mockTools: [
      {
        serverId: "stripe-custom-mcp",
        serverName: "Stripe Custom Adapter",
        name: "stripe_charge_simulate",
        description: "Simulates test card charge on Stripe sandbox.",
        isFinancial: true,
        inputSchema: {
          type: "object",
          properties: {
            amount: { type: "number", description: "Charge amount" },
          },
        },
      },
    ],
    mockExecutor: async (_name, args) => ({ charge_id: `ch_${Date.now()}`, amount: args.amount }),
  };

  const newState = await client.connectServer(customConfig);
  console.log("   Connected New Server:", newState.name, `(${newState.tools.length} tool)`);

  const dynamicTool = client.findTool("stripe_charge_simulate");
  console.log("   Dynamically Discovered Tool:", dynamicTool?.tool.name, "from", dynamicTool?.serverState.name);

  if (!dynamicTool || dynamicTool.tool.name !== "stripe_charge_simulate") {
    throw new Error("Test 7 Failed: Failed to dynamically discover tools from newly registered server!");
  }
  console.log("✅ Test 7 Passed: Dynamic runtime server connection & tool discovery verified.");

  console.log("\n==================================================");
  console.log("🎉 ALL 7 Universal MCP Client Tests PASSED!");
  console.log("==================================================");
}

runMCPTests().catch((err) => {
  console.error("❌ MCP Tests Failed:", err);
  process.exit(1);
});
