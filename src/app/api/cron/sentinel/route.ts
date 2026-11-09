import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { isCronConfigured, runScheduledAudit } from "@/lib/sentinel";

export const dynamic = "force-dynamic";

const digest = (value: string) => createHash("sha256").update(value).digest();

/** Compares fixed-length digests, so neither the secret's content nor its length can leak. */
function hasValidSecret(request: Request): boolean {
  const presented = /^Bearer (.+)$/.exec(request.headers.get("authorization") ?? "")?.[1];
  return presented !== undefined && timingSafeEqual(digest(presented), digest(process.env.CRON_SECRET as string));
}

/** For an external daily scheduler. Audits every ACTIVE rule and never makes a payment. */
export async function POST(request: Request) {
  if (!isCronConfigured()) {
    return NextResponse.json({ error: "Scheduled audits are not configured." }, { status: 503 });
  }
  if (!hasValidSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runScheduledAudit();
    if (result.status === "already_running") {
      return NextResponse.json({ error: "A Sentinel audit is already running." }, { status: 409 });
    }
    const { summary } = result;
    // Counts only: this response must not carry any user's rules.
    return NextResponse.json({
      success: true,
      cycleId: summary.cycleId,
      totalAudited: summary.totalAudited,
      healthy: summary.healthyCount,
      anomalies: summary.anomaliesDetected,
      priceDrops: summary.savingsCount,
      unverified: summary.unverifiedCount,
      alertsRecorded: summary.alertsDispatched,
      alertsDelivered: summary.alertsDelivered,
    });
  } catch (error) {
    console.error("[Sentinel Cron API] Audit failed:", error);
    return NextResponse.json({ error: "The scheduled audit failed." }, { status: 500 });
  }
}
