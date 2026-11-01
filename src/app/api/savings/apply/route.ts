import { NextRequest, NextResponse } from "next/server";
import { personaSavingsOptimizer } from "@/lib/savings";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      serviceName,
      originalPrice,
      discountedPrice,
      budgetCeiling,
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
      originalPrice: typeof originalPrice === "number" ? originalPrice : discountedPrice,
      discountedPrice,
      budgetCeiling: typeof budgetCeiling === "number" ? budgetCeiling : discountedPrice,
      mandateId,
      dealId,
      fundingRail: fundingRail || "PAYPAL",
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
