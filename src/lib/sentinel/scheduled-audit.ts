import { desc, eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { auditLogs, db, dbProvider } from "@/db";
import { SentinelBusyError, priceSentinel } from "./price-sentinel";
import type { SentinelCycleSummary } from "./types";

/** Held for a whole scheduled audit, so overlapping requests on any server instance are refused. */
export const SENTINEL_AUDIT_LOCK_KEY = 7426001;

// Marks a completed scheduled run in audit_logs. It has no mandate, so no user's history shows it.
const SCHEDULED_RUN_SERVICE = "Rico Sentinel Scheduled Audit";
const RECENT_RUN_MS = 26 * 60 * 60 * 1000;

export type ScheduledAuditResult =
  | { status: "completed"; summary: SentinelCycleSummary }
  | { status: "already_running" };

export type MonitoringMode = "scheduled" | "awaiting_run" | "manual_only";

export function isCronConfigured(): boolean {
  return (process.env.CRON_SECRET ?? "").length >= 32;
}

async function auditAndRecord(): Promise<ScheduledAuditResult> {
  try {
    // No owner filter and no forced spike: each rule is handled under its own owner.
    const summary = await priceSentinel.runAuditCycle();
    await db.insert(auditLogs).values({
      id: `log-${randomUUID()}`,
      mandateId: null,
      timestamp: new Date().toISOString(),
      eventType: "PRICE_VERIFIED",
      service: SCHEDULED_RUN_SERVICE,
      details: "Scheduled Sentinel audit completed.",
      severity: "info",
      metadata: { totalAudited: summary.totalAudited, unverified: summary.unverifiedCount },
    });
    return { status: "completed", summary };
  } catch (error) {
    if (error instanceof SentinelBusyError) return { status: "already_running" };
    throw error;
  }
}

/**
 * Runs one audit across all users' ACTIVE rules, or reports that one is already running. A
 * transaction-scoped advisory lock works through both Supabase poolers and is freed if the
 * connection dies. The audit itself writes on other connections and never makes a payment.
 */
export async function runScheduledAudit(): Promise<ScheduledAuditResult> {
  if (dbProvider !== "postgres") return auditAndRecord();

  const { postgresClient } = await import("@/db/postgres");
  let outcome: ScheduledAuditResult | null = null;
  try {
    await postgresClient.begin(async (tx) => {
      const [{ locked }] = await tx<{ locked: boolean }[]>`
        SELECT pg_try_advisory_xact_lock(${SENTINEL_AUDIT_LOCK_KEY}::bigint) AS locked`;
      outcome = locked ? await auditAndRecord() : { status: "already_running" };
    });
  } catch (error) {
    // A finished audit stays finished if only releasing the lock failed.
    if (!outcome) throw error;
  }
  return outcome as unknown as ScheduledAuditResult;
}

/** What monitoring is really doing. "scheduled" requires a recent, recorded, completed run. */
export async function getMonitoringStatus(): Promise<{
  mode: MonitoringMode;
  cronSecretConfigured: boolean;
  manualTriggerAvailable: true;
  lastScheduledRunAt: string | null;
}> {
  const cronSecretConfigured = isCronConfigured();
  let lastScheduledRunAt: string | null = null;
  if (cronSecretConfigured) {
    const [last] = await db
      .select({ timestamp: auditLogs.timestamp })
      .from(auditLogs)
      .where(eq(auditLogs.service, SCHEDULED_RUN_SERVICE))
      .orderBy(desc(auditLogs.timestamp))
      .limit(1);
    lastScheduledRunAt = last?.timestamp ?? null;
  }

  const recent = lastScheduledRunAt !== null && Date.now() - new Date(lastScheduledRunAt).getTime() < RECENT_RUN_MS;
  return {
    mode: !cronSecretConfigured ? "manual_only" : recent ? "scheduled" : "awaiting_run",
    cronSecretConfigured,
    manualTriggerAvailable: true,
    lastScheduledRunAt,
  };
}
