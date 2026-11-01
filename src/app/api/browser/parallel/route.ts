import { NextResponse } from "next/server";
import { priceWorker, screencastManager } from "@/lib/browser";

export const dynamic = "force-dynamic";

const PRESET_BATCHES: Record<string, Array<{ service: string; url?: string }>> = {
  streaming: [
    { service: "Netflix Standard HD", url: "https://help.netflix.com/en/node/24926" },
    { service: "Spotify Premium", url: "https://www.spotify.com/us/premium/" },
    { service: "YouTube Premium", url: "https://www.youtube.com/premium" },
  ],
  devtools: [
    { service: "GitHub Copilot", url: "https://github.com/features/copilot/plans" },
    { service: "ChatGPT Plus", url: "https://openai.com/chatgpt/pricing/" },
    { service: "AWS Cloud Services", url: "https://aws.amazon.com/pricing/" },
  ],
  cloud: [
    { service: "AWS Cloud Services", url: "https://aws.amazon.com/pricing/" },
    { service: "Adobe Creative Cloud", url: "https://www.adobe.com/creativecloud/plans.html" },
    { service: "GitHub Copilot", url: "https://github.com/features/copilot/plans" },
  ],
};

export async function GET() {
  return NextResponse.json({
    success: true,
    activeBotId: screencastManager.getActiveBotId(),
    bots: screencastManager.getBots(),
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, botId, services, preset } = body;

    // Action 1: Switch Active Helper Bot View in Screencast
    if (action === "select_bot" && botId) {
      const selected = screencastManager.setActiveBot(botId);
      if (!selected) {
        return NextResponse.json(
          { success: false, error: `Bot ${botId} not found` },
          { status: 404 }
        );
      }
      return NextResponse.json({
        success: true,
        activeBotId: screencastManager.getActiveBotId(),
        bot: selected,
      });
    }

    // Action 2: Trigger Parallel Helper Bots Multi-Site Price Verification
    let targets: Array<{ service: string; url?: string }> = [];

    if (preset && PRESET_BATCHES[preset]) {
      targets = PRESET_BATCHES[preset];
    } else if (Array.isArray(services) && services.length > 0) {
      targets = services.map((s) =>
        typeof s === "string" ? { service: s } : s
      );
    } else {
      targets = PRESET_BATCHES.streaming;
    }

    const verificationResult = await priceWorker.executeParallelPriceVerification(
      targets
    );

    return NextResponse.json({
      success: true,
      result: verificationResult,
    });
  } catch (error) {
    console.error("[API /api/browser/parallel] Error executing parallel verification:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Parallel verification failed",
      },
      { status: 500 }
    );
  }
}
