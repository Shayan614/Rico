import { NextResponse } from "next/server";
import { getCalmPricingForService } from "@/lib/browser/calm-lens";
import { posthogServer } from "@/lib/telemetry/posthog-server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { url, service } = body;

    const target = service || url || "netflix";
    const result = getCalmPricingForService(target);

    // Track PostHog Telemetry for Zephium Calm Pricing Lens
    posthogServer.capture({
      distinctId: "server-agent",
      event: "calm_pricing_lens_applied",
      properties: {
        service: result.service,
        url: result.url,
        dark_patterns_stripped: result.darkPatternsStrippedCount,
        hidden_fees_count: result.hiddenFeesUncovered.length,
        plans_count: result.plans.length,
        raw_complexity_score: result.rawPageComplexityScore,
        calm_score: result.calmScore,
      },
    });

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error("Calm pricing simplifier error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to simplify pricing",
      },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const service = searchParams.get("service") || searchParams.get("url") || "netflix";
  const result = getCalmPricingForService(service);
  return NextResponse.json({
    success: true,
    result,
  });
}
