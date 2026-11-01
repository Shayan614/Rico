import { NextResponse } from "next/server";
import { payPalOrders, payPalMCP } from "@/lib/paypal";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, ...params } = body;

    // Action 1: Create Order
    if (action === "create" || !action) {
      const order = await payPalOrders.createOrder({
        amount: Number(params.amount) || 0,
        currency: params.currency || "USD",
        serviceName: params.serviceName || "Merchant Service",
        mandateId: params.mandateId,
      });
      return NextResponse.json({ success: true, order });
    }

    // Action 2: Capture Order
    if (action === "capture") {
      const { capture, receipt } = await payPalOrders.captureOrder(
        params.orderId,
        {
          serviceName: params.serviceName,
          verifiedPrice: params.verifiedPrice,
          budgetCeiling: params.budgetCeiling,
        }
      );
      return NextResponse.json({ success: true, capture, receipt });
    }

    // Action 3: Invoke MCP Tool
    if (action === "mcp_tool") {
      const result = await payPalMCP.callTool(params.toolName, params.args || {});
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { error: "Unknown action requested" },
      { status: 400 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
