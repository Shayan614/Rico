import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-session";
import { personaSavingsOptimizer, UserPersona } from "@/lib/savings";
import { getOwnedMandate } from "@/lib/safety/mandate-access";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const service = searchParams.get("service") || "PostHog";
    const price = parseFloat(searchParams.get("price") || "120.00");
    const persona = (searchParams.get("persona") || "STARTUP_FOUNDER") as UserPersona;
    const mandateId = searchParams.get("mandateId") || undefined;
    if (mandateId && !(await getOwnedMandate(mandateId, auth.session.user.id))) {
      return NextResponse.json({ error: "Mandate not found" }, { status: 404 });
    }

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
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const { service, price, persona, mandateId } = body;
    if (mandateId && !(await getOwnedMandate(String(mandateId), auth.session.user.id))) {
      return NextResponse.json({ error: "Mandate not found" }, { status: 404 });
    }

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
