import { NextRequest, NextResponse } from "next/server";
import { personaSavingsOptimizer, UserPersona } from "@/lib/savings";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const service = searchParams.get("service") || "PostHog";
    const price = parseFloat(searchParams.get("price") || "120.00");
    const persona = (searchParams.get("persona") || "STARTUP_FOUNDER") as UserPersona;
    const mandateId = searchParams.get("mandateId") || undefined;

    const result = await personaSavingsOptimizer.probePersonaSavings({
      serviceName: service,
      currentPrice: price,
      persona,
      mandateId,
    });

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("[Savings Probe API] Error:", error);
    return NextResponse.json(
      { error: "Failed to probe persona savings" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { service, price, persona, mandateId } = body;

    const result = await personaSavingsOptimizer.probePersonaSavings({
      serviceName: service || "PostHog",
      currentPrice: typeof price === "number" ? price : 120.0,
      persona: (persona || "STARTUP_FOUNDER") as UserPersona,
      mandateId,
    });

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("[Savings Probe API POST] Error:", error);
    return NextResponse.json(
      { error: "Failed to probe persona savings" },
      { status: 500 }
    );
  }
}
