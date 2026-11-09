import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-session";
import { personaSavingsOptimizer } from "@/lib/savings";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const {
      serviceName,
      discountedPrice,
      mandateId,
      dealId,
      fundingRail,
    } = body;

    if (!serviceName || typeof discountedPrice !== "number") {
      return NextResponse.json(
        { error: "serviceName and discountedPrice are required" },
        { status: 400 }
      );
    }

    const result = await personaSavingsOptimizer.applySavingsPayment({
      serviceName,
      discountedPrice,
      mandateId,
      dealId,
      fundingRail: fundingRail || "PAYPAL",
      ownerId: auth.session.user.id,
    });

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error("[Savings Apply API] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to apply savings payment",
      },
      { status: 500 }
    );
  }
}
