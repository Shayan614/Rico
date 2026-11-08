import { MCPServerRegistry } from "./registry";
import { UniversalMCPClient } from "./universal-client";

async function runRegistryTests() {
  console.log("==================================================");
  console.log("⚡ Testing 2.13 MCP Server Registry & Endpoint Management");
  console.log("==================================================");

  const testClient = new UniversalMCPClient();
  const registry = new MCPServerRegistry(testClient);

  // [Test 1] Registry Initialization with Built-in Servers
  console.log("\n[Test 1] Testing Registry Initialization with Built-In Servers...");
  const initialServers = registry.listServers();
  console.log(`   Initial Servers in Registry: ${initialServers.length}`);
  initialServers.forEach((s) => {
    console.log(`   - [${s.category}] ${s.name} (${s.toolsCount} tools, isBuiltIn: ${s.isBuiltIn})`);
  });

  if (initialServers.length < 5) {
    throw new Error(`Test 1 Failed: Expected at least 5 built-in servers, got ${initialServers.length}`);
  }
  console.log("✅ Test 1 Passed: Registry initialized with PayPal, Slack, GitHub, Notion, Stripe.");

  // [Test 2] Custom Endpoint Registration & Dynamic Tool Ingestion
  console.log("\n[Test 2] Testing Custom Endpoint Registration...");
  const customServer = await registry.registerServer({
    name: "Internal FinOps MCP",
    endpointUrl: "https://finops.internal.company.com/mcp",
    transport: "HTTP",
    category: "FINOPS",
    authToken: "sk_live_finops_secret_987654321",
    mockTools: [
      {
        serverId: "finops-internal",
        serverName: "Internal FinOps MCP",
        name: "finops_cost_allocation_get",
        description: "Returns cloud compute cost allocation by department.",
        isFinancial: false,
        inputSchema: {
          type: "object",
          properties: {
            department: { type: "string", description: "Engineering, Design, Ops" },
          },
        },
      },
      {
        serverId: "finops-internal",
        serverName: "Internal FinOps MCP",
        name: "finops_budget_freeze",
        description: "Freezes department card billing when burn rate exceeds forecast.",
        isFinancial: true,
        inputSchema: {
          type: "object",
          properties: {
            department: { type: "string", description: "Department name" },
          },
        },
      },
    ],
  });

  console.log("   Registered Server:", customServer.name);
  console.log("   Server ID:", customServer.id);
  console.log("   Tools Discovered:", customServer.toolsCount);
  console.log("   Redacted Token:", customServer.authTokenRedacted);

  if (
    customServer.toolsCount !== 2 ||
    customServer.authTokenRedacted?.includes("secret") ||
    !customServer.authTokenRedacted?.includes("••••")
  ) {
    throw new Error("Test 2 Failed: Custom server registration or token redaction failed!");
  }
  console.log("✅ Test 2 Passed: Custom endpoint registered and auth token safely redacted.");

  // [Test 3] Endpoint Update & Settings
  console.log("\n[Test 3] Testing Endpoint Configuration Update...");
  const updated = await registry.updateServer(customServer.id, {
    name: "Enterprise FinOps & Cloud Microservice",
    category: "ENTERPRISE",
  });

  console.log("   Updated Name:", updated.name);
  console.log("   Updated Category:", updated.category);

  if (updated.name !== "Enterprise FinOps & Cloud Microservice" || updated.category !== "ENTERPRISE") {
    throw new Error("Test 3 Failed: Server configuration update failed!");
  }
  console.log("✅ Test 3 Passed: Endpoint settings updated successfully.");

  // [Test 4] Disable & Enable Toggling
  console.log("\n[Test 4] Testing Server Disable & Tool Memory Purging...");
  const toolsBeforeDisable = registry.getAllDiscoveredTools().length;
  console.log(`   Tools Available Before Disable: ${toolsBeforeDisable}`);

  await registry.updateServer(customServer.id, { enabled: false });
  const disabledState = registry.getServer(customServer.id);
  const toolsAfterDisable = registry.getAllDiscoveredTools().length;
  console.log(`   Status After Disable: ${disabledState?.status} (Tools Active: ${toolsAfterDisable})`);

  if (disabledState?.enabled !== false || toolsAfterDisable >= toolsBeforeDisable) {
    throw new Error("Test 4 Failed: Disabling server did not purge tools from active memory!");
  }

  // Re-enable
  await registry.updateServer(customServer.id, { enabled: true });
  const reEnabledState = registry.getServer(customServer.id);
  const toolsAfterReEnable = registry.getAllDiscoveredTools().length;
  console.log(`   Status After Re-Enable: ${reEnabledState?.status} (Tools Active: ${toolsAfterReEnable})`);

  if (!reEnabledState?.enabled || toolsAfterReEnable !== toolsBeforeDisable) {
    throw new Error("Test 4 Failed: Re-enabling server failed to restore active tools!");
  }
  console.log("✅ Test 4 Passed: Disable and enable toggling successfully purges/restores tools.");

  // [Test 5] Endpoint Refresh & Re-Discovery
  console.log("\n[Test 5] Testing Endpoint Refresh & Handshake...");
  const refreshed = await registry.refreshServer(customServer.id);
  console.log("   Refreshed Status:", refreshed.status);
  console.log("   Refreshed Latency:", `${refreshed.latencyMs}ms`);

  if (refreshed.status !== "CONNECTED" || refreshed.toolsCount !== 2) {
    throw new Error("Test 5 Failed: Refreshing server failed to maintain connection!");
  }
  console.log("✅ Test 5 Passed: Endpoint handshake refreshed and latency measured.");

  // [Test 6] Network-Wide Concurrent Health Check
  console.log("\n[Test 6] Testing Network-Wide Concurrent Health Check...");
  const healthReport = await registry.healthCheckAll();

  console.log("   Total Endpoints Monitored:", healthReport.totalServers);
  console.log("   Connected Endpoints:", healthReport.connectedServers);
  console.log("   Total Tools Discovered:", healthReport.totalToolsDiscovered);
  console.log("   Average Latency:", `${healthReport.averageLatencyMs}ms`);

  if (healthReport.totalServers < 6 || healthReport.connectedServers < 6) {
    throw new Error("Test 6 Failed: Health check failed to monitor all registered servers!");
  }
  console.log("✅ Test 6 Passed: Network-wide concurrent health check verified all endpoints.");

  // [Test 7] Unregister Custom Endpoint
  console.log("\n[Test 7] Testing Endpoint Unregistration & Built-In Protection...");
  let builtInBlockWorked = false;
  try {
    registry.unregisterServer("paypal-mcp");
  } catch (err: unknown) {
    builtInBlockWorked = true;
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`   Captured Expected Built-In Protection: "${msg}"`);
  }

  if (!builtInBlockWorked) {
    throw new Error("Test 7 Failed: Built-in PayPal server should be protected from deletion!");
  }

  const unregisteredCustom = registry.unregisterServer(customServer.id);
  const deletedSearch = registry.getServer(customServer.id);
  console.log("   Unregistered Custom Endpoint:", unregisteredCustom, `(Exists in registry: ${!!deletedSearch})`);

  if (!unregisteredCustom || deletedSearch !== undefined) {
    throw new Error("Test 7 Failed: Custom endpoint was not removed from registry!");
  }
  console.log("✅ Test 7 Passed: Endpoint successfully unregistered and cleaned up.");

  console.log("\n==================================================");
  console.log("🎉 ALL 7 MCP Server Registry Tests PASSED!");
  console.log("==================================================");
}

runRegistryTests().catch((err) => {
  console.error("❌ Registry Tests Failed:", err);
  process.exit(1);
});
