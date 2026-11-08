export * from "./types";
export * from "./slack";
export * from "./github";
export * from "./notion";
export * from "./stripe";

import { slackMCPAdapter } from "./slack";
import { gitHubMCPAdapter } from "./github";
import { notionMCPAdapter } from "./notion";
import { stripeMCPAdapter } from "./stripe";
import { AdapterHealth } from "./types";
import { UniversalMCPClient } from "../universal-client";

export function checkAdaptersHealth(): AdapterHealth[] {
  return [
    slackMCPAdapter.getHealth(),
    gitHubMCPAdapter.getHealth(),
    notionMCPAdapter.getHealth(),
    stripeMCPAdapter.getHealth(),
  ];
}

export function registerAllAdapters(client: UniversalMCPClient): void {
  // 1. Slack Adapter
  client.registerServer({
    id: "slack-mcp",
    name: "Slack MCP Adapter",
    endpointUrl: "https://slack.com/api/mcp",
    transport: "HTTP",
    mockTools: slackMCPAdapter.getTools(),
    mockExecutor: async (toolName, args) => {
      if (toolName === "slack_post_alert") {
        return await slackMCPAdapter.postAlert({
          title: String(args.title || "Financial Alert"),
          message: String(args.message || ""),
          serviceName: args.serviceName as string | undefined,
          amount: args.amount as number | undefined,
          budgetCeiling: args.budgetCeiling as number | undefined,
          severity: (args.severity as "info" | "warning" | "danger" | "success") || "warning",
          channel: args.channel as string | undefined,
        });
      }
      if (toolName === "slack_daily_digest") {
        return await slackMCPAdapter.postDailyDigest({
          totalBurn: Number(args.totalBurn || 5000),
          savedThisMonth: Number(args.savedThisMonth || 1200),
          channel: args.channel as string | undefined,
        });
      }
      if (toolName === "slack_channels_list") {
        return await slackMCPAdapter.listChannels();
      }
      return { status: "OK", args };
    },
  });

  // 2. GitHub Adapter
  client.registerServer({
    id: "github-mcp",
    name: "GitHub MCP Adapter",
    endpointUrl: "https://api.github.com/mcp",
    transport: "HTTP",
    mockTools: gitHubMCPAdapter.getTools(),
    mockExecutor: async (toolName, args) => {
      if (toolName === "github_create_audit_issue") {
        return await gitHubMCPAdapter.createIssue({
          title: String(args.title || "Audit Issue"),
          body: String(args.body || ""),
          labels: typeof args.labels === "string" ? args.labels.split(",") : undefined,
          owner: args.owner as string | undefined,
          repo: args.repo as string | undefined,
        });
      }
      if (toolName === "github_get_repo_stats") {
        return await gitHubMCPAdapter.getRepoStats(
          args.owner as string | undefined,
          args.repo as string | undefined
        );
      }
      return { status: "OK", args };
    },
  });

  // 3. Notion Adapter
  client.registerServer({
    id: "notion-mcp",
    name: "Notion MCP Adapter",
    endpointUrl: "https://api.notion.com/v1/mcp",
    transport: "HTTP",
    mockTools: notionMCPAdapter.getTools(),
    mockExecutor: async (toolName, args) => {
      if (toolName === "notion_sync_expense_page") {
        return await notionMCPAdapter.syncExpensePage({
          service: String(args.service || "Vendor"),
          amount: Number(args.amount || 0),
          currency: args.currency as string | undefined,
          category: String(args.category || "General"),
          taxDeductible: args.taxDeductible === "true" || args.taxDeductible === true,
          databaseId: args.databaseId as string | undefined,
        });
      }
      if (toolName === "notion_query_expenses") {
        return await notionMCPAdapter.queryExpenses(args.databaseId as string | undefined);
      }
      return { status: "OK", args };
    },
  });

  // 4. Stripe Adapter
  client.registerServer({
    id: "stripe-mcp",
    name: "Stripe MCP Adapter",
    endpointUrl: "https://api.stripe.com/mcp",
    transport: "HTTP",
    mockTools: stripeMCPAdapter.getTools(),
    mockExecutor: async (toolName, args) => {
      if (toolName === "stripe_charge_create") {
        return await stripeMCPAdapter.createCharge({
          amount: Number(args.amount || 0),
          serviceName: String(args.serviceName || "Service"),
          currency: args.currency as string | undefined,
          budgetCeiling: args.budgetCeiling ? Number(args.budgetCeiling) : undefined,
          idempotencyKey: args.idempotencyKey as string | undefined,
        });
      }
      if (toolName === "stripe_subscription_cancel") {
        return await stripeMCPAdapter.cancelSubscription(String(args.subscriptionId));
      }
      if (toolName === "stripe_customer_balance") {
        return await stripeMCPAdapter.getCustomerBalance(args.customerId as string | undefined);
      }
      return { status: "OK", args };
    },
  });
}
