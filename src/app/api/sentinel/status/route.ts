import { NextResponse } from "next/server";
import { priceSentinel, omnichannelAlertStore } from "@/lib/sentinel";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const stats = priceSentinel.getStats();
    const pendingAlerts = omnichannelAlertStore.getPendingAlerts();
    const allAlerts = omnichannelAlertStore.getAllAlerts().slice(0, 10);

    return NextResponse.json({
      success: true,
      sentinel: {
        ...stats,
        pendingAlertsCount: pendingAlerts.length,
        channels: {
          telegram: {
            configured: !!process.env.TELEGRAM_BOT_TOKEN,
            mode: process.env.TELEGRAM_BOT_TOKEN ? "LIVE_BOT" : "SIMULATED_MOCK",
          },
          whatsapp: {
            configured: true,
            mode: "INTERACTIVE_TEMPLATES",
          },
          slack: {
            configured: true,
            mode: "BLOCK_KIT_ENTERPRISE",
          },
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
