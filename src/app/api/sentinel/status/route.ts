import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-session";
import { getMonitoringStatus, priceSentinel, omnichannelAlertStore } from "@/lib/sentinel";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  const ownerId = auth.session.user.id;

  try {
    const stats = priceSentinel.getStats(ownerId);
    const monitoring = await getMonitoringStatus();
    const telegramLive = Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
    const pendingAlerts = omnichannelAlertStore.getPendingAlerts().filter((a) => a.ownerId === ownerId);
    const allAlerts = omnichannelAlertStore
      .getAllAlerts()
      .filter((a) => a.ownerId === ownerId)
      .slice(0, 10);

    return NextResponse.json({
      success: true,
      sentinel: {
        ...stats,
        pendingAlertsCount: pendingAlerts.length,
        monitoring,
        channels: {
          telegram: {
            configured: telegramLive,
            mode: telegramLive ? "LIVE_BOT" : "SIMULATED_MOCK",
            callbacksConfigured: Boolean(
              process.env.TELEGRAM_WEBHOOK_SECRET && process.env.TELEGRAM_CHAT_ID && process.env.TELEGRAM_OWNER_ID
            ),
          },
          // Only message formatting exists for these two. Nothing is ever sent.
          whatsapp: { configured: false, delivers: false, mode: "FORMAT_ONLY" },
          slack: { configured: false, delivers: false, mode: "FORMAT_ONLY" },
        },
      },
      pendingAlerts,
      recentAlerts: allAlerts,
    });
  } catch (error) {
    console.error("[Sentinel Status API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch sentinel status" },
      { status: 500 }
    );
  }
}
