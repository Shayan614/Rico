import { NextRequest, NextResponse } from "next/server";
import { guardrailSimulator } from "@/lib/simulation";
import { SimulationScenario } from "@/lib/simulation/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { scenarioId, customScenario, runAll } = body;

    // 1. Run all scenarios
    if (runAll || (!scenarioId && !customScenario)) {
      const report = await guardrailSimulator.runAllScenarios();
      return NextResponse.json({
        success: true,
        mode: "FULL_HARNESS",
        report,
      });
    }

    // 2. Run specific scenario by ID
    if (scenarioId) {
      const scenarios = guardrailSimulator.getScenarios();
      const target = scenarios.find((s) => s.id === scenarioId);
      if (!target) {
        return NextResponse.json(
          { success: false, error: `Scenario '${scenarioId}' not found` },
          { status: 404 }
        );
      }

      const result = await guardrailSimulator.runScenario(target);
      return NextResponse.json({
        success: true,
        mode: "SINGLE_SCENARIO",
        result,
      });
    }

    // 3. Custom scenario execution
    if (customScenario) {
      const result = await guardrailSimulator.runScenario(customScenario as SimulationScenario);
      return NextResponse.json({
        success: true,
        mode: "CUSTOM_SCENARIO",
        result,
      });
    }

    return NextResponse.json({ success: false, error: "Invalid request payload" }, { status: 400 });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    return NextResponse.json(
      { success: false, error: err.message || "Failed to execute guardrail simulation" },
      { status: 500 }
    );
  }
}
