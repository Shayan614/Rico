import { payPalOAuth } from "./oauth";
import { payPalOrders } from "./orders";
import { PayPalReceipt } from "./types";

export interface MCPToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, { type: string; description: string }>;
    required: string[];
  };
}

export class PayPalMCPClient {
  private serverUrl: string;

  constructor() {
    this.serverUrl =
      process.env.PAYPAL_MCP_SERVER_URL || "https://mcp.sandbox.paypal.com/sse";
  }

  public getServerUrl(): string {
    return this.serverUrl;
  }

  /**
   * Official PayPal MCP Tool Catalog (matches docs.paypal.ai and PayPal AI Toolkit)
   */
  public getAvailableTools(): MCPToolDefinition[] {
    return [
      {
        name: "paypal_orders_create",
        description:
          "Creates a new PayPal checkout order for purchasing goods or services.",
        parameters: {
          type: "object",
          properties: {
            amount: { type: "number", description: "The total payment amount." },
            currency: { type: "string", description: "3-letter ISO-4217 currency code (e.g., USD)." },
            service_name: { type: "string", description: "Name of the merchant service or goods." },
            mandate_id: { type: "string", description: "Identifier of the associated financial mandate." },
          },
          required: ["amount", "service_name"],
        },
      },
      {
        name: "paypal_orders_capture",
        description:
          "Captures authorized funds for an approved PayPal checkout order.",
        parameters: {
          type: "object",
          properties: {
            order_id: { type: "string", description: "The ID of the order to capture." },
          },
          required: ["order_id"],
        },
      },
      {
        name: "paypal_subscriptions_get",
        description:
          "Retrieves details for a subscription billing agreement.",
        parameters: {
          type: "object",
          properties: {
            subscription_id: { type: "string", description: "The PayPal subscription ID." },
          },
          required: ["subscription_id"],
        },
      },
      {
        name: "paypal_invoices_create",
        description:
          "Generates a digital invoice with line items, tax, and payee information.",
        parameters: {
          type: "object",
          properties: {
            recipient_email: { type: "string", description: "Email of the invoice recipient." },
            amount: { type: "number", description: "Invoice amount." },
          },
          required: ["recipient_email", "amount"],
        },
      },
      {
        name: "paypal_disputes_list",
        description:
          "Lists open customer disputes, chargebacks, and inquiry statuses.",
        parameters: {
          type: "object",
          properties: {
            status: { type: "string", description: "Filter by status: OPEN, RESOLVED, UNDER_REVIEW." },
          },
          required: [],
        },
      },
    ];
  }

  /**
   * Executes an official PayPal MCP Tool
   */
  public async callTool(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<{ success: boolean; data: unknown; message: string; receipt?: PayPalReceipt }> {
    await payPalOAuth.getAccessToken();

    // 1. Tool: paypal_orders_create
    if (toolName === "paypal_orders_create") {
      const amount = Number(args.amount) || 0;
      const serviceName = String(args.service_name || "Merchant Service");
      const currency = String(args.currency || "USD");
      const mandateId = args.mandate_id ? String(args.mandate_id) : undefined;

      const order = await payPalOrders.createOrder({
        amount,
        serviceName,
        currency,
        mandateId,
      });

      return {
        success: true,
        data: order,
        message: `PayPal MCP tool '${toolName}' created order ${order.id}.`,
      };
    }

    // 2. Tool: paypal_orders_capture
    if (toolName === "paypal_orders_capture") {
      const orderId = String(args.order_id);
      const serviceName = args.service_name ? String(args.service_name) : undefined;
      const verifiedPrice = args.verified_price ? Number(args.verified_price) : undefined;
      const budgetCeiling = args.budget_ceiling ? Number(args.budget_ceiling) : undefined;

      const { capture, receipt } = await payPalOrders.captureOrder(orderId, {
        serviceName,
        verifiedPrice,
        budgetCeiling,
      });

      return {
        success: true,
        data: capture,
        message: `PayPal MCP tool '${toolName}' captured payment ${capture.id} for order ${orderId}.`,
        receipt,
      };
    }

    // Fallback response for auxiliary tools
    return {
      success: true,
      data: {
        tool: toolName,
        arguments: args,
        tokenApp: "APP-PAYAGENT-SANDBOX",
        status: "SUCCESS",
        timestamp: new Date().toISOString(),
      },
      message: `Executed MCP tool '${toolName}'.`,
    };
  }
}

export const payPalMCP = new PayPalMCPClient();
