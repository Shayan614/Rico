import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-session";
import { ForceSpikeNotAllowedError, SentinelBusyError, priceSentinel } from "@/lib/sentinel";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const { mandateId, forceSpike, service } = body;

    const summary = await priceSentinel.runAuditCycle({
      mandateId,
      forceSpike,
      service,
      ownerId: auth.session.user.id,
    });

    return NextResponse.json({
      success: true,
      summary,
      message: `Audit finished: ${summary.totalAudited} checked, ${summary.anomaliesDetected} anomaly(s), ${summary.unverifiedCount} unverified, ${summary.alertsDispatched} alert(s) recorded, ${summary.alertsDelivered} delivered.`,
    });
  } catch (error) {
    if (error instanceof ForceSpikeNotAllowedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof SentinelBusyError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("[Sentinel Run API] Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to run sentinel audit",
      },
      { status: 500 }
    );
  }
}
