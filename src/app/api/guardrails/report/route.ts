import { NextResponse } from "next/server";
import { guardrailSimulator } from "@/lib/simulation";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const report = await guardrailSimulator.runAllScenarios();
    return NextResponse.json({
      success: true,
      report,
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    return NextResponse.json(
      { success: false, error: err.message || "Failed to generate simulation report" },
      { status: 500 }
    );
  }
}
