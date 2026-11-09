import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { requireSession } from "@/lib/auth/require-session";
import { handleRemoteAction, omnichannelDispatcher } from "@/lib/sentinel";

export const dynamic = "force-dynamic";

/** Telegram's secret header, plus the one chat that alerts are sent to, bound to one user. */
function isVerifiedTelegramUpdate(request: Request, chatId: unknown): boolean {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const allowedChat = process.env.TELEGRAM_CHAT_ID;
  if (!secret || !allowedChat || !process.env.TELEGRAM_OWNER_ID) return false;
  const expected = Buffer.from(secret);
  const received = Buffer.from(request.headers.get("x-telegram-bot-api-secret-token") ?? "");
  return (
    expected.length === received.length &&
    timingSafeEqual(expected, received) &&
    String(chatId) === allowedChat
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // 1. Check if this is an official Telegram Webhook update
    if (body.callback_query) {
      const callbackQuery = body.callback_query;
      if (!isVerifiedTelegramUpdate(request, callbackQuery.message?.chat?.id)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const callbackData: string = callbackQuery.data || "";
      const callbackQueryId: string = callbackQuery.id;

      // Parse payload: "action:mandateId:alertId:price"
      // The price in the payload is ignored; handleRemoteAction uses the stored one.
      const [rawAction, mandateId, alertId] = callbackData.split(":");
      const action = rawAction as "approve" | "backup_card" | "cancel";

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
        ownerId: process.env.TELEGRAM_OWNER_ID as string,
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

    // 2. Direct JSON (UI Simulator). WhatsApp and Slack have no verified callback yet.
    const auth = await requireSession(request);
    if (!auth.ok) return auth.response;

    const { action, mandateId, alertId } = body;

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
      ownerId: auth.session.user.id,
    });

    return NextResponse.json(
      {
        success: result.success,
        source: "omnichannel_webhook",
        result,
        ...(result.success ? {} : { error: result.message }),
      },
      { status: result.success ? 200 : 409 }
    );
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
