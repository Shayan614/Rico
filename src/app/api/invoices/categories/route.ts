import { NextResponse } from "next/server";
import { TAX_DEDUCTION_RULES } from "@/lib/ocr";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      rules: TAX_DEDUCTION_RULES,
      standards: "IRS Section 179 & Schedule C Form 1040",
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    return NextResponse.json(
      { success: false, error: err.message || "Failed to retrieve tax categories" },
      { status: 500 }
    );
  }
}
