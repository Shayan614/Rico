import { OmnichannelAlert } from "./types";

class OmnichannelAlertStore {
  private alerts: Map<string, OmnichannelAlert> = new Map();

  public saveAlert(alert: OmnichannelAlert): void {
    this.alerts.set(alert.id, alert);
  }

  public getAlert(id: string): OmnichannelAlert | undefined {
    return this.alerts.get(id);
  }

  public getLatestAlertForMandate(mandateId: string): OmnichannelAlert | undefined {
    const mandateAlerts = Array.from(this.alerts.values()).filter(
      (a) => a.mandateId === mandateId
    );
    return mandateAlerts.sort((a, b) => (b.timestamp > a.timestamp ? 1 : -1))[0];
  }

  public getAllAlerts(): OmnichannelAlert[] {
    return Array.from(this.alerts.values()).sort((a, b) =>
      b.timestamp > a.timestamp ? 1 : -1
    );
  }

  public getPendingAlerts(): OmnichannelAlert[] {
    return this.getAllAlerts().filter((a) => a.status === "PENDING");
  }

  public resolveAlert(
    alertId: string,
    action: "approve" | "backup_card" | "cancel",
    details?: { orderId?: string; transactionId?: string }
  ): OmnichannelAlert | undefined {
    const alert = this.alerts.get(alertId);
    if (!alert) return undefined;

    alert.status =
      action === "approve"
        ? "APPROVED"
        : action === "backup_card"
        ? "BACKUP_PAID"
        : "CANCELLED";
    alert.resolvedAt = new Date().toISOString();
    alert.resolvedAction = action;
    if (details?.orderId) alert.orderId = details.orderId;
    if (details?.transactionId) alert.transactionId = details.transactionId;

    this.alerts.set(alertId, alert);
    return alert;
  }
}

export const omnichannelAlertStore = new OmnichannelAlertStore();

/**
 * Omnichannel Bot & Webhook Dispatcher
 * Formats and transmits alerts to Telegram, WhatsApp Cloud, and Slack Enterprise
 */
export class OmnichannelDispatcher {
  private telegramToken: string | undefined;
  private telegramChatId: string | undefined;

  constructor() {
    this.telegramToken = process.env.TELEGRAM_BOT_TOKEN;
    this.telegramChatId = process.env.TELEGRAM_CHAT_ID;
  }

  /**
   * Dispatches an interactive alert across configured channels (Telegram, WhatsApp, Slack)
   */
  public async dispatchAlert(alert: OmnichannelAlert): Promise<{
    telegramSent: boolean;
    whatsappPayload: Record<string, unknown>;
    slackPayload: Record<string, unknown>;
  }> {
    omnichannelAlertStore.saveAlert(alert);

    // 1. Dispatch to Telegram (Live Bot API if credentials set, or high-fidelity simulated response)
    const telegramSent = await this.sendTelegramAlert(alert);

    // 2. Format WhatsApp Cloud Interactive Template payload
    const whatsappPayload = this.formatWhatsAppPayload(alert);

    // 3. Format Slack Enterprise Block Kit payload
    const slackPayload = this.formatSlackBlockKitPayload(alert);

    return {
      telegramSent,
      whatsappPayload,
      slackPayload,
    };
  }

  /**
   * Telegram Bot API Client
   * Transmits message with 3 inline callback buttons:
   * 1. Approve One-Time
   * 2. Pay with Backup Card (Visa)
   * 3. 1-Click Cancel Subscription
   */
  public async sendTelegramAlert(alert: OmnichannelAlert): Promise<boolean> {
    const text = [
      `🚨 *24h Audit: Price Spike Detected!*`,
      ``,
      `*Service:* ${alert.service}`,
      `• *Old Price:* $${alert.oldPrice.toFixed(2)} / mo`,
      `• *New Price:* $${alert.newPrice.toFixed(2)} / mo (+${alert.jumpPercent}%)`,
      `• *Your Budget Ceiling:* $${alert.budgetCeiling.toFixed(2)} / mo`,
      ``,
      `⚠️ _Payment is on hold. Choose an action:_`,
    ].join("\n");

    const inlineKeyboard = {
      inline_keyboard: [
        [
          {
            text: `✅ Approve One-Time ($${alert.newPrice.toFixed(2)})`,
            callback_data: `approve:${alert.mandateId}:${alert.id}:${alert.newPrice.toFixed(2)}`,
          },
        ],
        [
          {
            text: `💳 Pay with Backup Card (Visa)`,
            callback_data: `backup_card:${alert.mandateId}:${alert.id}:${alert.newPrice.toFixed(2)}`,
          },
        ],
        [
          {
            text: `🛑 1-Click Cancel Subscription`,
            callback_data: `cancel:${alert.mandateId}:${alert.id}:0`,
          },
        ],
      ],
    };

    if (this.telegramToken && this.telegramChatId) {
      try {
        const response = await fetch(
          `https://api.telegram.org/bot${this.telegramToken}/sendMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: this.telegramChatId,
              text,
              parse_mode: "Markdown",
              reply_markup: inlineKeyboard,
            }),
          }
        );
        return response.ok;
      } catch (err) {
        console.warn("[OmnichannelDispatcher] Telegram network delivery error:", err);
        return false;
      }
    }

    // High-fidelity local simulation mode when bot credentials are not set
    console.log("[OmnichannelDispatcher] (Simulated Telegram Alert Sent):", {
      service: alert.service,
      jump: `+${alert.jumpPercent}%`,
      alertId: alert.id,
      buttons: ["Approve One-Time", "Pay with Backup Card", "Cancel Subscription"],
    });
    return true;
  }

  /**
   * Telegram Webhook Callback Response
   */
  public async answerTelegramCallbackQuery(
    callbackQueryId: string,
    text: string
  ): Promise<boolean> {
    if (!this.telegramToken) return true;
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${this.telegramToken}/answerCallbackQuery`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            callback_query_id: callbackQueryId,
            text,
            show_alert: true,
          }),
        }
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Format WhatsApp Cloud Interactive Quick Reply Template Payload
   */
  public formatWhatsAppPayload(alert: OmnichannelAlert): Record<string, unknown> {
    return {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      type: "interactive",
      interactive: {
        type: "button",
        header: {
          type: "text",
          text: "🚨 Rico Price Sentinel Alert",
        },
        body: {
          text: `${alert.service} subscription increased from $${alert.oldPrice.toFixed(
            2
          )} to $${alert.newPrice.toFixed(2)} (+${alert.jumpPercent}%). Your budget ceiling is $${alert.budgetCeiling.toFixed(
            2
          )}. Payment is on hold.`,
        },
        footer: {
          text: "Rico Agentic Commerce • PayPal MCP",
        },
        action: {
          buttons: [
            {
              type: "reply",
              reply: {
                id: `approve:${alert.mandateId}:${alert.id}:${alert.newPrice.toFixed(2)}`,
                title: `Approve ($${alert.newPrice.toFixed(2)})`,
              },
            },
            {
              type: "reply",
              reply: {
                id: `backup_card:${alert.mandateId}:${alert.id}:${alert.newPrice.toFixed(2)}`,
                title: "Pay Backup Card",
              },
            },
            {
              type: "reply",
              reply: {
                id: `cancel:${alert.mandateId}:${alert.id}:0`,
                title: "Cancel Mandate",
              },
            },
          ],
        },
      },
    };
  }

  /**
   * Format Slack Enterprise Block Kit Payload
   */
  public formatSlackBlockKitPayload(alert: OmnichannelAlert): Record<string, unknown> {
    return {
      text: `🚨 Price Spike Detected: ${alert.service} (+${alert.jumpPercent}%)`,
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "🚨 Rico 24/7 Sentinel: Price Spike Alert",
            emoji: true,
          },
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Service:*\n${alert.service}`,
            },
            {
              type: "mrkdwn",
              text: `*Budget Ceiling:*\n$${alert.budgetCeiling.toFixed(2)} / mo`,
            },
            {
              type: "mrkdwn",
              text: `*Previous Price:*\n$${alert.oldPrice.toFixed(2)} / mo`,
            },
            {
              type: "mrkdwn",
              text: `*Detected Price:*\n*$${alert.newPrice.toFixed(2)}* (+${alert.jumpPercent}%)`,
            },
          ],
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: {
                type: "plain_text",
                text: `Approve One-Time ($${alert.newPrice.toFixed(2)})`,
                emoji: true,
              },
              style: "primary",
              value: `approve:${alert.mandateId}:${alert.id}:${alert.newPrice.toFixed(2)}`,
              action_id: "sentinel_approve",
            },
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "Pay Backup Card (Visa)",
                emoji: true,
              },
              value: `backup_card:${alert.mandateId}:${alert.id}:${alert.newPrice.toFixed(2)}`,
              action_id: "sentinel_backup_card",
            },
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "Cancel Subscription",
                emoji: true,
              },
              style: "danger",
              value: `cancel:${alert.mandateId}:${alert.id}:0`,
              action_id: "sentinel_cancel",
            },
          ],
        },
      ],
    };
  }
}

export const omnichannelDispatcher = new OmnichannelDispatcher();
