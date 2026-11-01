import { NextResponse } from "next/server";
import { priceSentinel } from "@/lib/sentinel";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { mandateId, forceSpike, service } = body;

    const summary = await priceSentinel.runAuditCycle({
      mandateId,
      forceSpike,
      service,
    });

    return NextResponse.json({
      success: true,
      summary,
      message: `Audit cycle finished: ${summary.totalAudited} audited, ${summary.anomaliesDetected} anomaly(s), ${summary.alertsDispatched} alert(s) sent.`,
    });
  } catch (error) {
    console.error("[Sentinel Run API] Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to run sentinel audit",
      },
      { status: 500 }
    );
  }
}
