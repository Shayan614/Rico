import { NextRequest, NextResponse } from "next/server";
import {
  handleRemoteAction,
  handleTelegramCommand,
  omnichannelDispatcher,
} from "@/lib/sentinel";

export const dynamic = "force-dynamic";

/**
 * GET /api/sentinel/webhook
 * Inspects Telegram webhook health or configures webhook URL
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    const targetUrl = searchParams.get("url");

    // Option to set webhook URL with Telegram Bot API
    if (action === "set" && targetUrl) {
      const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
      const res = await omnichannelDispatcher.setTelegramWebhook(targetUrl, secret);
      return NextResponse.json({
        success: res.ok,
        targetUrl,
        response: res,
      });
    }

    // Default: Check webhook info from Telegram
    const webhookInfo = await omnichannelDispatcher.getTelegramWebhookInfo();

    return NextResponse.json({
      success: true,
      service: "Rico Sentinel Two-Way Telegram Webhook",
      timestamp: new Date().toISOString(),
      isBotConfigured: !!process.env.TELEGRAM_BOT_TOKEN,
      telegramChatConfigured: !!process.env.TELEGRAM_CHAT_ID,
      webhookInfo,
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/sentinel/webhook
 * Two-way interactive webhook handler for Telegram Bot updates and remote omnichannel actions
 */
export async function POST(request: Request) {
  try {
    // 1. Verify Telegram Webhook Secret Token if configured
    const secretHeader = request.headers.get("x-telegram-bot-api-secret-token");
    const configuredSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

    if (configuredSecret && secretHeader && secretHeader !== configuredSecret) {
      return NextResponse.json(
        { error: "Unauthorized webhook secret token" },
        { status: 403 }
      );
    }

    const body = await request.json();

    // 2. Telegram Inline Keyboard Callback Button Click
    if (body.callback_query) {
      const callbackQuery = body.callback_query;
      const callbackData: string = callbackQuery.data || "";
      const callbackQueryId: string = callbackQuery.id;
      const chatId = callbackQuery.message?.chat?.id;
      const messageId = callbackQuery.message?.message_id;

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

      // Execute payment or pause mandate atomically in SQLite
      const result = await handleRemoteAction({
        action,
        mandateId,
        alertId,
        overridePrice,
      });

      // Acknowledge Telegram callback query with instant pop-up banner
      await omnichannelDispatcher.answerTelegramCallbackQuery(
        callbackQueryId,
        result.message
      );

      // Edit the original message in-place to remove buttons and show confirmation
      if (chatId && messageId) {
        const resolutionText = [
          `✅ *Action Completed Successfully*`,
          ``,
          `*Service:* ${result.service}`,
          `*Decision:* ${result.action.toUpperCase()}`,
          `*Mandate Status:* ${result.mandateStatus}`,
          result.amount ? `*Amount Charged:* $${result.amount.toFixed(2)} USD` : "",
          result.fundingRail ? `*Funding Rail:* ${result.fundingRail}` : "",
          result.orderId ? `*PayPal Order ID:* \`${result.orderId}\`` : "",
          result.captureId ? `*PayPal Capture ID:* \`${result.captureId}\`` : "",
          ``,
          `_Processed via Rico Two-Way Sentinel at ${new Date().toLocaleTimeString()}_`,
        ]
          .filter(Boolean)
          .join("\n");

        await omnichannelDispatcher.editTelegramMessage(
          chatId,
          messageId,
          resolutionText,
          { inline_keyboard: [] }
        );
      }

      return NextResponse.json({
        success: true,
        source: "telegram_callback",
        result,
      });
    }

    // 3. Telegram Chat Text / Slash Command (e.g. /start, /status, /pending, /audit)
    if (body.message && body.message.text) {
      const chatId = body.message.chat?.id;
      const text: string = body.message.text;

      const commandResult = await handleTelegramCommand(text, chatId);

      if (chatId) {
        await omnichannelDispatcher.sendTelegramTextMessage(
          chatId,
          commandResult.replyText,
          commandResult.replyMarkup
        );
      }

      return NextResponse.json({
        success: true,
        source: "telegram_command",
        command: commandResult.command,
        replyPreview: commandResult.replyText.slice(0, 100),
      });
    }

    // 4. Direct JSON Webhook (from WhatsApp, Slack, or UI Simulator)
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
