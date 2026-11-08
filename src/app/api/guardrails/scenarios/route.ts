import { NextResponse } from "next/server";
import { guardrailSimulator } from "@/lib/simulation";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const scenarios = guardrailSimulator.getScenarios();
    return NextResponse.json({
      success: true,
      count: scenarios.length,
      scenarios,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    return NextResponse.json(
      { success: false, error: err.message || "Failed to retrieve simulation scenarios" },
      { status: 500 }
    );
  }
}
