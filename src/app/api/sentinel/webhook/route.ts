import { NextResponse } from "next/server";
import { handleRemoteAction, omnichannelDispatcher } from "@/lib/sentinel";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // 1. Check if this is an official Telegram Webhook update
    if (body.callback_query) {
      const callbackQuery = body.callback_query;
      const callbackData: string = callbackQuery.data || "";
      const callbackQueryId: string = callbackQuery.id;

      // Parse payload: "action:mandateId:alertId:price"
      const [rawAction, mandateId, alertId, rawPrice] = callbackData.split(":");
      const action = rawAction as "approve" | "backup_card" | "cancel";
      const overridePrice = rawPrice ? parseFloat(rawPrice) : undefined;

      if (!mandateId || !["approve", "backup_card", "cancel"].includes(action)) {
        await omnichannelDispatcher.answerTelegramCallbackQuery(
          callbackQueryId,
          "Invalid action payload."
        );
        return NextResponse.json({ error: "Invalid callback query data" }, { status: 400 });
      }

      const result = await handleRemoteAction({
        action,
        mandateId,
        alertId,
        overridePrice,
      });

      // Acknowledge Telegram callback query with response banner
      await omnichannelDispatcher.answerTelegramCallbackQuery(
        callbackQueryId,
        result.message
      );

      return NextResponse.json({
        success: true,
        source: "telegram_webhook",
        result,
      });
    }

    // 2. Direct JSON Webhook (from WhatsApp, Slack, or UI Simulator)
    const { action, mandateId, alertId, price } = body;

    if (!mandateId || !action || !["approve", "backup_card", "cancel"].includes(action)) {
      return NextResponse.json(
        {
          error:
            "Missing or invalid parameters. Expected: { action: 'approve' | 'backup_card' | 'cancel', mandateId: string }",
        },
        { status: 400 }
      );
    }

    const result = await handleRemoteAction({
      action,
      mandateId,
      alertId,
      overridePrice: typeof price === "number" ? price : undefined,
    });

    return NextResponse.json({
      success: true,
      source: "omnichannel_webhook",
      result,
    });
  } catch (error) {
    console.error("[Sentinel Webhook API] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to process remote action",
      },
      { status: 500 }
    );
  }
}
