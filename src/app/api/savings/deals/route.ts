import { NextRequest, NextResponse } from "next/server";
import { PERSONA_DEALS_MATRIX, UserPersona } from "@/lib/savings";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const persona = searchParams.get("persona") as UserPersona | null;

    let deals = PERSONA_DEALS_MATRIX;
    if (persona) {
      deals = deals.filter((d) => d.persona === persona);
    }

    const totalReclaimedPotential = deals.reduce(
      (acc, curr) => acc + curr.reclaimedCreditValue,
      0
    );

    return NextResponse.json({
      success: true,
      deals,
      totalCount: deals.length,
      totalReclaimedPotential,
    });
  } catch (error) {
    console.error("[Savings Deals API] Error:", error);
    return NextResponse.json(
      { error: "Failed to query savings deals" },
      { status: 500 }
    );
  }
}
