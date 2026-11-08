import { EventEmitter } from "events";
import {
  MCPServerConfig,
  MCPServerStatus,
  MCPServerTransport,
  MCPTool,
} from "./types";
import { universalMCPClient, UniversalMCPClient } from "./universal-client";
import { registerAllAdapters } from "./adapters";
import { posthogServer } from "@/lib/telemetry/posthog-server";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";

export interface RegistryServerRecord {
  id: string;
  name: string;
  endpointUrl: string;
  transport: MCPServerTransport;
  category: string;
  status: MCPServerStatus;
  enabled: boolean;
  isBuiltIn: boolean;
  authTokenRedacted?: string;
  toolsCount: number;
  tools: MCPTool[];
  latencyMs: number;
  lastCheckedAt: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RegisterEndpointInput {
  id?: string;
  name: string;
  endpointUrl: string;
  transport?: MCPServerTransport;
  category?: string;
  authToken?: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
  mockTools?: MCPTool[];
  mockExecutor?: (toolName: string, args: Record<string, unknown>) => Promise<unknown>;
}

export interface UpdateEndpointInput {
  name?: string;
  endpointUrl?: string;
  authToken?: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
  enabled?: boolean;
  category?: string;
}

export interface RegistryHealthSummary {
  totalServers: number;
  connectedServers: number;
  errorServers: number;
  disabledServers: number;
  totalToolsDiscovered: number;
  averageLatencyMs: number;
  servers: RegistryServerRecord[];
  timestamp: string;
}

export class MCPServerRegistry extends EventEmitter {
  private servers: Map<string, RegistryServerRecord> = new Map();
  private secretTokens: Map<string, string> = new Map(); // id -> raw unredacted token
  private originalConfigs: Map<string, MCPServerConfig> = new Map(); // id -> original config
  private client: UniversalMCPClient;

  constructor(client: UniversalMCPClient = universalMCPClient) {
    super();
    this.client = client;
    this.bootstrapEcosystemServers();
  }

  private redactToken(token?: string): string | undefined {
    if (!token) return undefined;
    const trimmed = token.trim();
    if (trimmed.length <= 8) return "••••••••";
    const prefix = trimmed.substring(0, 4);
    const suffix = trimmed.substring(trimmed.length - 4);
    return `${prefix}••••${suffix}`;
  }

  /**
   * Bootstrap the core PayPal AI Toolkit and ecosystem adapters
   */
  private bootstrapEcosystemServers(): void {
    registerAllAdapters(this.client);
    const now = new Date().toISOString();

    const builtInDefaults: Array<{
      id: string;
      name: string;
      endpointUrl: string;
      category: string;
      transport: MCPServerTransport;
    }> = [
      {
        id: "paypal-mcp",
        name: "PayPal AI Toolkit",
        endpointUrl: "https://mcp.sandbox.paypal.com/sse",
        category: "PAYMENTS",
        transport: "SSE",
      },
      {
        id: "github-mcp",
        name: "GitHub MCP Adapter",
        endpointUrl: "https://api.github.com/mcp",
        category: "DEVTOOLS",
        transport: "HTTP",
      },
      {
        id: "slack-mcp",
        name: "Slack MCP Adapter",
        endpointUrl: "https://slack.com/api/mcp",
        category: "COMMUNICATION",
        transport: "HTTP",
      },
      {
        id: "notion-mcp",
        name: "Notion MCP Adapter",
        endpointUrl: "https://api.notion.com/v1/mcp",
        category: "PRODUCTIVITY",
        transport: "HTTP",
      },
      {
        id: "stripe-mcp",
        name: "Stripe MCP Adapter",
        endpointUrl: "https://api.stripe.com/mcp",
        category: "PAYMENTS",
        transport: "HTTP",
      },
    ];

    for (const b of builtInDefaults) {
      const serverState = this.client.getServer(b.id);
      const tools = serverState?.tools || [];

      this.servers.set(b.id, {
        id: b.id,
        name: b.name,
        endpointUrl: b.endpointUrl,
        transport: b.transport,
        category: b.category,
        status: "CONNECTED",
        enabled: true,
        isBuiltIn: true,
        toolsCount: tools.length,
        tools,
        latencyMs: 12,
        lastCheckedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  /**
   * Register or connect a new MCP server endpoint dynamically
   */
  public async registerServer(input: RegisterEndpointInput): Promise<RegistryServerRecord> {
    const id = input.id || `mcp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    if (input.authToken) {
      this.secretTokens.set(id, input.authToken);
    }

    const config: MCPServerConfig = {
      id,
      name: input.name,
      endpointUrl: input.endpointUrl,
      transport: input.transport || "HTTP",
      authToken: input.authToken,
      headers: input.headers,
      timeoutMs: input.timeoutMs || 15000,
      mockTools: input.mockTools,
      mockExecutor: input.mockExecutor,
    };

    this.originalConfigs.set(id, config);

    const serverState = await this.client.connectServer(config);
    const tools = serverState.tools || [];

    const record: RegistryServerRecord = {
      id,
      name: input.name,
      endpointUrl: input.endpointUrl,
      transport: config.transport || "HTTP",
      category: input.category || "CUSTOM",
      status: serverState.status,
      enabled: serverState.status === "CONNECTED",
      isBuiltIn: false,
      authTokenRedacted: this.redactToken(input.authToken),
      toolsCount: tools.length,
      tools,
      latencyMs: serverState.latencyMs,
      lastCheckedAt: now,
      lastError: serverState.error,
      createdAt: now,
      updatedAt: now,
    };

    this.servers.set(id, record);
    this.emit("server:registered", record);

    // Audit Log recording
    try {
      await db.insert(auditLogs).values({
        id: `audit_mcp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        eventType: "PRICE_VERIFIED",
        service: `MCPRegistry:${input.name}`,
        details: `Registered MCP server endpoint '${input.name}' with ${tools.length} discovered tools (${input.endpointUrl}).`,
        severity: "info",
        metadata: {
          serverId: id,
          toolsCount: tools.length,
          endpointUrl: input.endpointUrl,
        },
      });
    } catch {
      // Non-fatal audit log insertion
    }

    await posthogServer.capture({
      event: "mcp_endpoint_registered",
      properties: {
        serverId: id,
        name: input.name,
        toolsCount: tools.length,
        status: serverState.status,
      },
    });

    return record;
  }

  /**
   * Update an existing MCP endpoint's settings or enabled state
   */
  public async updateServer(
    id: string,
    input: UpdateEndpointInput
  ): Promise<RegistryServerRecord> {
    const existing = this.servers.get(id);
    if (!existing) {
      throw new Error(`MCP Server '${id}' not found in registry`);
    }

    const now = new Date().toISOString();

    if (input.authToken) {
      this.secretTokens.set(id, input.authToken);
      existing.authTokenRedacted = this.redactToken(input.authToken);
    }

    if (input.name) existing.name = input.name;
    if (input.endpointUrl) existing.endpointUrl = input.endpointUrl;
    if (input.category) existing.category = input.category;

    // Handle Enable / Disable Toggling
    if (input.enabled !== undefined && input.enabled !== existing.enabled) {
      existing.enabled = input.enabled;
      if (!input.enabled) {
        this.client.disconnectServer(id);
        existing.status = "DISCONNECTED";
        existing.tools = [];
        existing.toolsCount = 0;
      } else {
        await this.refreshServer(id);
      }
    }

    existing.updatedAt = now;
    this.servers.set(id, existing);
    this.emit("server:updated", existing);

    return existing;
  }

  /**
   * Safely unregister and delete an endpoint
   */
  public unregisterServer(id: string): boolean {
    const existing = this.servers.get(id);
    if (!existing) return false;

    if (existing.isBuiltIn) {
      throw new Error(`Cannot unregister built-in server '${existing.name}'. You can disable it instead.`);
    }

    this.client.disconnectServer(id);
    this.secretTokens.delete(id);
    this.originalConfigs.delete(id);
    this.servers.delete(id);
    this.emit("server:unregistered", id);

    return true;
  }

  /**
   * Refresh tool discovery and health on a specific endpoint
   */
  public async refreshServer(id: string): Promise<RegistryServerRecord> {
    const existing = this.servers.get(id);
    if (!existing) {
      throw new Error(`MCP Server '${id}' not found in registry`);
    }

    const unredactedToken = this.secretTokens.get(id);
    const originalConfig = this.originalConfigs.get(id);

    const serverState = await this.client.connectServer({
      id: existing.id,
      name: existing.name,
      endpointUrl: existing.endpointUrl,
      transport: existing.transport,
      authToken: unredactedToken,
      headers: originalConfig?.headers,
      timeoutMs: originalConfig?.timeoutMs,
      mockTools: originalConfig?.mockTools || existing.tools,
      mockExecutor: originalConfig?.mockExecutor,
    });

    const now = new Date().toISOString();
    existing.status = serverState.status;
    existing.latencyMs = serverState.latencyMs;
    existing.tools = serverState.tools || [];
    existing.toolsCount = existing.tools.length;
    existing.lastCheckedAt = now;
    existing.updatedAt = now;
    existing.lastError = serverState.error;

    this.servers.set(id, existing);
    this.emit("server:refreshed", existing);

    return existing;
  }

  /**
   * Network-wide concurrent health check across all registered servers
   */
  public async healthCheckAll(): Promise<RegistryHealthSummary> {
    const all = Array.from(this.servers.values());
    let totalLatency = 0;
    let connectedCount = 0;
    let errorCount = 0;
    let disabledCount = 0;
    let totalTools = 0;

    await Promise.all(
      all.map(async (record) => {
        if (!record.enabled) {
          disabledCount++;
          return;
        }

        try {
          const refreshed = await this.refreshServer(record.id);
          totalLatency += refreshed.latencyMs;

          if (refreshed.status === "CONNECTED") {
            connectedCount++;
            totalTools += refreshed.toolsCount;
          } else {
            errorCount++;
          }
        } catch (err: unknown) {
          errorCount++;
          record.status = "ERROR";
          record.lastError = err instanceof Error ? err.message : String(err);
        }
      })
    );

    const activeServersCount = connectedCount + errorCount;
    const averageLatencyMs =
      activeServersCount > 0 ? Math.round(totalLatency / activeServersCount) : 0;

    return {
      totalServers: all.length,
      connectedServers: connectedCount,
      errorServers: errorCount,
      disabledServers: disabledCount,
      totalToolsDiscovered: totalTools,
      averageLatencyMs,
      servers: this.listServers(),
      timestamp: new Date().toISOString(),
    };
  }

  public getServer(id: string): RegistryServerRecord | undefined {
    return this.servers.get(id);
  }

  public listServers(filter?: {
    status?: MCPServerStatus;
    category?: string;
    enabled?: boolean;
  }): RegistryServerRecord[] {
    let results = Array.from(this.servers.values());

    if (filter?.status) {
      results = results.filter((s) => s.status === filter.status);
    }
    if (filter?.category) {
      results = results.filter((s) => s.category.toUpperCase() === filter.category!.toUpperCase());
    }
    if (filter?.enabled !== undefined) {
      results = results.filter((s) => s.enabled === filter.enabled);
    }

    return results;
  }

  public getAllDiscoveredTools(): MCPTool[] {
    const tools: MCPTool[] = [];
    for (const server of Array.from(this.servers.values())) {
      if (server.enabled && server.status === "CONNECTED") {
        tools.push(...server.tools);
      }
    }
    return tools;
  }
}

export const mcpServerRegistry = new MCPServerRegistry();
