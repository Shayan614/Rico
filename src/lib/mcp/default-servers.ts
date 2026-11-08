import { MCPServerConfig } from "./types";
import { payPalOrders } from "@/lib/paypal/orders";

export const DEFAULT_MCP_SERVERS: MCPServerConfig[] = [
  // 1. Official PayPal AI Toolkit MCP Server
  {
    id: "paypal-mcp",
    name: "PayPal AI Toolkit",
    endpointUrl: process.env.PAYPAL_MCP_SERVER_URL || "https://mcp.sandbox.paypal.com/sse",
    transport: "SSE",
    timeoutMs: 15000,
    mockTools: [
      {
        serverId: "paypal-mcp",
        serverName: "PayPal AI Toolkit",
        name: "paypal_orders_create",
        description: "Creates an authorized PayPal checkout order for services or software.",
        isFinancial: true,
        inputSchema: {
          type: "object",
          properties: {
            amount: { type: "number", description: "Payment amount" },
            currency: { type: "string", description: "3-letter ISO currency code (USD, EUR, GBP)" },
            service_name: { type: "string", description: "Merchant or service name" },
            mandate_id: { type: "string", description: "Mandate ID to link" },
          },
          required: ["amount", "service_name"],
        },
      },
      {
        serverId: "paypal-mcp",
        serverName: "PayPal AI Toolkit",
        name: "paypal_orders_capture",
        description: "Captures authorized funds for an approved PayPal checkout order.",
        isFinancial: true,
        inputSchema: {
          type: "object",
          properties: {
            order_id: { type: "string", description: "Order ID to capture" },
            budget_ceiling: { type: "number", description: "User authorized budget ceiling" },
          },
          required: ["order_id"],
        },
      },
      {
        serverId: "paypal-mcp",
        serverName: "PayPal AI Toolkit",
        name: "paypal_subscriptions_get",
        description: "Retrieves details for a subscription billing agreement.",
        isFinancial: false,
        inputSchema: {
          type: "object",
          properties: {
            subscription_id: { type: "string", description: "PayPal subscription ID" },
          },
          required: ["subscription_id"],
        },
      },
      {
        serverId: "paypal-mcp",
        serverName: "PayPal AI Toolkit",
        name: "paypal_invoices_create",
        description: "Generates an itemized PayPal invoice with line items.",
        isFinancial: true,
        inputSchema: {
          type: "object",
          properties: {
            recipient_email: { type: "string", description: "Recipient email" },
            amount: { type: "number", description: "Total invoice amount" },
          },
          required: ["recipient_email", "amount"],
        },
      },
      {
        serverId: "paypal-mcp",
        serverName: "PayPal AI Toolkit",
        name: "paypal_disputes_list",
        description: "Lists open customer disputes, chargebacks, and inquiry statuses.",
        isFinancial: false,
        inputSchema: {
          type: "object",
          properties: {
            status: { type: "string", description: "OPEN, RESOLVED, UNDER_REVIEW" },
          },
        },
      },
    ],
    mockExecutor: async (toolName, args) => {
      if (toolName === "paypal_orders_create") {
        const order = await payPalOrders.createOrder({
          amount: Number(args.amount) || 15.0,
          serviceName: String(args.service_name || "SaaS Service"),
          currency: String(args.currency || "USD"),
          mandateId: args.mandate_id ? String(args.mandate_id) : undefined,
        });
        return order;
      }
      if (toolName === "paypal_orders_capture") {
        const orderId = String(args.order_id || `ORD-${Date.now()}`);
        const res = await payPalOrders.captureOrder(orderId, {
          budgetCeiling: args.budget_ceiling ? Number(args.budget_ceiling) : undefined,
        });
        return res;
      }
      if (toolName === "paypal_subscriptions_get") {
        return {
          subscription_id: args.subscription_id,
          status: "ACTIVE",
          plan_name: "Standard Cloud Plan",
          billing_amount: 15.49,
          currency: "USD",
          next_billing_date: "2026-12-01",
        };
      }
      if (toolName === "paypal_invoices_create") {
        return {
          invoice_id: `INV-${Date.now()}`,
          recipient_email: args.recipient_email,
          total_amount: args.amount,
          status: "SENT",
          payment_link: `https://sandbox.paypal.com/invoice/p/${Date.now()}`,
        };
      }
      if (toolName === "paypal_disputes_list") {
        return {
          total_disputes: 0,
          disputes: [],
          status: "CLEAN",
        };
      }
      return { status: "OK", args };
    },
  },

  // 2. GitHub Developer MCP Adapter
  {
    id: "github-mcp",
    name: "GitHub MCP Adapter",
    endpointUrl: "https://api.github.com/mcp",
    transport: "HTTP",
    mockTools: [
      {
        serverId: "github-mcp",
        serverName: "GitHub MCP Adapter",
        name: "github_repo_get",
        description: "Retrieves details, open issues, and pull requests for a repository.",
        isFinancial: false,
        inputSchema: {
          type: "object",
          properties: {
            owner: { type: "string", description: "Repository owner / organization" },
            repo: { type: "string", description: "Repository name" },
          },
          required: ["owner", "repo"],
        },
      },
      {
        serverId: "github-mcp",
        serverName: "GitHub MCP Adapter",
        name: "github_issue_create",
        description: "Creates an issue for billing anomalies, audit failures, or developer tasks.",
        isFinancial: false,
        inputSchema: {
          type: "object",
          properties: {
            title: { type: "string", description: "Issue title" },
            body: { type: "string", description: "Issue description and telemetry" },
          },
          required: ["title", "body"],
        },
      },
    ],
    mockExecutor: async (toolName, args) => {
      if (toolName === "github_repo_get") {
        return {
          owner: args.owner || "abrarnasirjaffari",
          repo: args.repo || "Rico",
          stars: 42,
          open_issues: 0,
          license: "MIT",
        };
      }
      if (toolName === "github_issue_create") {
        return {
          issue_number: Math.floor(10 + Math.random() * 90),
          title: args.title,
          url: `https://github.com/abrarnasirjaffari/Rico/issues/${Date.now()}`,
          state: "OPEN",
        };
      }
      return { status: "OK", args };
    },
  },

  // 3. Slack Omnichannel MCP Adapter
  {
    id: "slack-mcp",
    name: "Slack MCP Adapter",
    endpointUrl: "https://slack.com/api/mcp",
    transport: "HTTP",
    mockTools: [
      {
        serverId: "slack-mcp",
        serverName: "Slack MCP Adapter",
        name: "slack_post_message",
        description: "Pushes formatted financial alerts and interactive decision cards to a Slack channel.",
        isFinancial: false,
        inputSchema: {
          type: "object",
          properties: {
            channel: { type: "string", description: "Channel ID or #name" },
            text: { type: "string", description: "Alert message text" },
          },
          required: ["channel", "text"],
        },
      },
      {
        serverId: "slack-mcp",
        serverName: "Slack MCP Adapter",
        name: "slack_channels_list",
        description: "Lists available public channels for alert distribution.",
        isFinancial: false,
        inputSchema: {
          type: "object",
          properties: {
            types: { type: "string", description: "public_channel, private_channel" },
          },
        },
      },
    ],
    mockExecutor: async (toolName, args) => {
      if (toolName === "slack_post_message") {
        return {
          ok: true,
          channel: args.channel || "#finance-alerts",
          ts: `${Date.now() / 1000}`,
          message_delivery: "CONFIRMED",
        };
      }
      if (toolName === "slack_channels_list") {
        return {
          ok: true,
          channels: [
            { id: "C0123456", name: "finance-alerts" },
            { id: "C0123457", name: "general" },
          ],
        };
      }
      return { status: "OK", args };
    },
  },

  // 4. Notion Workspace MCP Adapter
  {
    id: "notion-mcp",
    name: "Notion MCP Adapter",
    endpointUrl: "https://api.notion.com/v1/mcp",
    transport: "HTTP",
    mockTools: [
      {
        serverId: "notion-mcp",
        serverName: "Notion MCP Adapter",
        name: "notion_database_query",
        description: "Queries an expense or roadmap database inside a Notion workspace.",
        isFinancial: false,
        inputSchema: {
          type: "object",
          properties: {
            database_id: { type: "string", description: "Notion Database ID" },
          },
          required: ["database_id"],
        },
      },
    ],
    mockExecutor: async (toolName, args) => {
      if (toolName === "notion_database_query") {
        return {
          results_count: 3,
          database_id: args.database_id,
          pages: [
            { id: "p1", title: "Q4 SaaS Runway Model", status: "VERIFIED" },
            { id: "p2", title: "PostHog & AWS Credits Grant", status: "SUBMITTED" },
          ],
        };
      }
      return { status: "OK", args };
    },
  },
];
