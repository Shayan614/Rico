import { db, mandates, auditLogs, MandateRecord } from "@/db";
import { and, eq } from "drizzle-orm";
import { priceWorker } from "@/lib/browser";
import { checkPriceAnomaly, checkBudgetCeiling } from "@/lib/safety";
import { posthogServer } from "@/lib/telemetry/posthog-server";
import { omnichannelDispatcher } from "./omnichannel";
import {
  SentinelAuditRecord,
  SentinelCycleSummary,
  OmnichannelAlert,
} from "./types";

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

export class SentinelBusyError extends Error {
  constructor() {
    super("A Sentinel audit is already running. Try again shortly.");
  }
}

export class ForceSpikeNotAllowedError extends Error {
  constructor() {
    super("Forced price spikes are only available when PAYPAL_MODE=mock.");
  }
}

/** A forced spike writes a made-up price, so it needs an explicit mock mode, never a default. */
export function isForceSpikeAllowed(): boolean {
  return (process.env.PAYPAL_MODE || "").trim().toLowerCase() === "mock";
}

export class PriceSentinelWorker {
  private timer: NodeJS.Timeout | null = null;
  private isRunningAudit: boolean = false;
  private lastSummary: SentinelCycleSummary | null = null;
  private auditHistory: SentinelAuditRecord[] = [];
  private totalAuditsRun: number = 0;
  private anomaliesDetected: number = 0;
  private savingsIdentified: number = 0;
  private schedulerIntervalMs: number = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Executes a full 24-hour background audit cycle across all active mandates
   */
  public async runAuditCycle(options?: {
    mandateId?: string;
    forceSpike?: boolean;
    service?: string;
    /** Limits the cycle to this user's mandates. Only the internal scheduler omits it. */
    ownerId?: string;
  }): Promise<SentinelCycleSummary> {
    if (options?.forceSpike && !isForceSpikeAllowed()) throw new ForceSpikeNotAllowedError();
    const ownerFilter = options?.ownerId ? eq(mandates.ownerId, options.ownerId) : undefined;

    if (this.isRunningAudit) throw new SentinelBusyError();

    this.isRunningAudit = true;
    const cycleId = generateId("cycle");
    const startedAt = new Date().toISOString();
    const cycleAudits: SentinelAuditRecord[] = [];

    let healthyCount = 0;
    let anomalies = 0;
    let savings = 0;
    let unverified = 0;
    let alertsSent = 0;
    let alertsDelivered = 0;

    try {
      // 1. Fetch active mandates from SQLite memory
      // Only ACTIVE rules are eligible, and a rule with no owner belongs to nobody.
      const targetMandates: MandateRecord[] = (
        await db
          .select()
          .from(mandates)
          .where(
            and(
              eq(mandates.status, "ACTIVE"),
              options?.mandateId ? eq(mandates.id, options.mandateId) : undefined,
              ownerFilter
            )
          )
      ).filter((m) => Boolean(m.ownerId));

      console.log(
        `[PriceSentinel] Starting 24h Background Sentinel Audit for ${targetMandates.length} mandate(s)...`
      );

      // 2. Iterate through each mandate and audit against baseline memory
      for (const mandate of targetMandates) {
        const auditId = generateId("audit");
        const baselinePrice =
          mandate.lastScrapedPrice > 0
            ? mandate.lastScrapedPrice
            : mandate.budgetCeiling * 0.75; // sensible baseline if first run

        let livePrice: number | null = null;
        let unverifiedReason = "The live price check failed.";
        let planName: string = `${mandate.service} Plan`;

        // Check if demo forced spike is requested (e.g. Adobe Creative Cloud spike to $54.99)
        if (
          options?.forceSpike &&
          (!options.service ||
            mandate.service.toLowerCase().includes(options.service.toLowerCase()))
        ) {
          // Simulate the exact Miro board price spike scenario: Adobe CC $35.00 -> $54.99 (+57%)
          livePrice = Number((baselinePrice * 1.57).toFixed(2));
          planName = `${mandate.service} Enterprise All-Apps Plan`;
        } else {
          // Execute Playwright browser scraper to get verified merchant price
          try {
            const scrape = await priceWorker.scrapeMerchantPrice(
              mandate.service,
              mandate.merchantUrl || undefined,
              { timeoutMs: 6000 }
            );
            // A cached or built-in price proves nothing about today's price.
            if (scrape.source === "live_browser" && scrape.price > 0) {
              livePrice = scrape.price;
              planName = scrape.planName;
            } else {
              unverifiedReason = "No live price could be read from the merchant page.";
            }
          } catch {
            // Reported below as unverified, never as a steady price.
          }
        }

        if (livePrice === null) {
          unverified++;
          const unverifiedDetails = `Price could not be verified: ${unverifiedReason} The rule was left unchanged.`;
          await db.insert(auditLogs).values({
            id: generateId("log"),
            mandateId: mandate.id,
            eventType: "GUARDRAIL_BLOCKED",
            service: mandate.service,
            details: `Sentinel: ${unverifiedDetails}`,
            severity: "warning",
            metadata: { reason: "PRICE_UNVERIFIED", source: "sentinel_audit" },
          });
          const unverifiedRecord: SentinelAuditRecord = {
            id: auditId,
            ownerId: mandate.ownerId,
            mandateId: mandate.id,
            service: mandate.service,
            oldPrice: baselinePrice,
            newPrice: baselinePrice,
            budgetCeiling: mandate.budgetCeiling,
            currency: mandate.currency || "USD",
            status: "UNVERIFIED",
            percentageDiff: 0,
            details: unverifiedDetails,
            alertDispatched: false,
            timestamp: new Date().toISOString(),
          };
          cycleAudits.push(unverifiedRecord);
          this.auditHistory.unshift(unverifiedRecord);
          if (this.auditHistory.length > 50) this.auditHistory.pop();
          continue;
        }

        // 3. Anomaly & Safety Evaluation
        const ceilingCheck = checkBudgetCeiling(livePrice, mandate.budgetCeiling);
        const anomalyCheck = checkPriceAnomaly(livePrice, baselinePrice, 20);

        let status: SentinelAuditRecord["status"] = "NORMAL";
        let diffPercent = 0;
        let details = `Price is steady at $${livePrice.toFixed(2)} (within $${mandate.budgetCeiling.toFixed(2)} budget ceiling).`;
        let alertDispatched = false;
        let alertId: string | undefined;

        if (ceilingCheck.exceeded || anomalyCheck.isAnomaly) {
          // Conditional on ACTIVE, so a rule paused mid-audit stays paused and an overlapping
          // audit cannot raise a second alert for the same hold.
          const held = await db.update(mandates)
            .set({
              status: "ANOMALY_HOLD",
              lastScrapedPrice: livePrice,
              updatedAt: new Date().toISOString(),
            })
            .where(and(eq(mandates.id, mandate.id), eq(mandates.status, "ACTIVE")))
            .returning({ id: mandates.id });
          if (held.length === 0) continue;

          // Flag Price Spike Anomaly / Budget Exceeded
          status = ceilingCheck.exceeded ? "BUDGET_EXCEEDED" : "ANOMALY_SPIKE";
          diffPercent = anomalyCheck.percentageJump;
          details = ceilingCheck.exceeded
            ? `Price ($${livePrice.toFixed(2)}) exceeds authorized budget ceiling ($${mandate.budgetCeiling.toFixed(2)}) by $${ceilingCheck.diff.toFixed(2)}.`
            : `Price jumped +${diffPercent}% from historical baseline ($${baselinePrice.toFixed(2)} ➔ $${livePrice.toFixed(2)}).`;

          anomalies++;
          this.anomaliesDetected++;

          // Log warning in SQLite audit_logs
          await db.insert(auditLogs)
            .values({
              id: generateId("log"),
              mandateId: mandate.id,
              eventType: "ANOMALY_DETECTED",
              service: mandate.service,
              details: `24h Sentinel Alert: ${details} Execution placed on ANOMALY_HOLD.`,
              severity: "warning",
              metadata: {
                baselinePrice,
                livePrice,
                budgetCeiling: mandate.budgetCeiling,
                diffPercent,
                source: "sentinel_24h_audit",
              },
            });

          // Dispatch Telemetry to PostHog
          await posthogServer.trackPriceAnomaly({
            service: mandate.service,
            currentPrice: livePrice,
            baselinePrice,
            percentageJump: `+${diffPercent}%`,
            holdTriggered: true,
          });

          // Dispatch Omnichannel Alert (Telegram, WhatsApp, Slack)
          alertId = generateId("alert");
          const alertPayload: OmnichannelAlert = {
            id: alertId,
            mandateId: mandate.id,
            ownerId: mandate.ownerId,
            service: mandate.service,
            planName,
            oldPrice: baselinePrice,
            newPrice: livePrice,
            jumpPercent: diffPercent > 0 ? diffPercent : 35,
            budgetCeiling: mandate.budgetCeiling,
            currency: mandate.currency || "USD",
            channel: "telegram",
            status: "PENDING",
            timestamp: new Date().toISOString(),
          };

          const dispatched = await omnichannelDispatcher.dispatchAlert(alertPayload);
          alertDispatched = true;
          alertsSent++;
          if (dispatched.telegramDelivery === "sent") alertsDelivered++;
        } else if (livePrice < baselinePrice) {
          // Price Drop detected! (Savings)
          status = "PRICE_DROP";
          const savedAmount = baselinePrice - livePrice;
          diffPercent = -Math.round((savedAmount / baselinePrice) * 100);
          details = `Price drop detected! Plan decreased from $${baselinePrice.toFixed(2)} to $${livePrice.toFixed(2)} (${diffPercent}% savings).`;
          savings++;
          this.savingsIdentified += savedAmount;

          await db.update(mandates)
            .set({
              lastScrapedPrice: livePrice,
              updatedAt: new Date().toISOString(),
            })
            .where(and(eq(mandates.id, mandate.id), eq(mandates.status, "ACTIVE")));

          await db.insert(auditLogs)
            .values({
              id: generateId("log"),
              mandateId: mandate.id,
              eventType: "PRICE_VERIFIED",
              service: mandate.service,
              details: `24h Sentinel: ${details}`,
              severity: "success",
              metadata: {
                baselinePrice,
                newPrice: livePrice,
                savings: savedAmount,
              },
            });
        } else {
          // Normal within budget
          healthyCount++;
          await db.update(mandates)
            .set({
              lastScrapedPrice: livePrice,
              updatedAt: new Date().toISOString(),
            })
            .where(and(eq(mandates.id, mandate.id), eq(mandates.status, "ACTIVE")));
        }

        const auditRecord: SentinelAuditRecord = {
          id: auditId,
          ownerId: mandate.ownerId,
          mandateId: mandate.id,
          service: mandate.service,
          oldPrice: baselinePrice,
          newPrice: livePrice,
          budgetCeiling: mandate.budgetCeiling,
          currency: mandate.currency || "USD",
          status,
          percentageDiff: diffPercent,
          details,
          alertDispatched,
          alertId,
          timestamp: new Date().toISOString(),
        };

        cycleAudits.push(auditRecord);
        this.auditHistory.unshift(auditRecord);
        if (this.auditHistory.length > 50) this.auditHistory.pop();
      }

      this.totalAuditsRun += targetMandates.length;

      const summary: SentinelCycleSummary = {
        cycleId,
        startedAt,
        completedAt: new Date().toISOString(),
        totalAudited: targetMandates.length,
        healthyCount,
        anomaliesDetected: anomalies,
        savingsCount: savings,
        unverifiedCount: unverified,
        alertsDispatched: alertsSent,
        alertsDelivered,
        audits: cycleAudits,
      };

      this.lastSummary = summary;
      console.log(
        `[PriceSentinel] 24h Audit Complete: ${targetMandates.length} audited, ${anomalies} anomalies, ${alertsSent} alerts dispatched.`
      );
      return summary;
    } finally {
      this.isRunningAudit = false;
    }
  }

  /**
   * Starts the 24-hour background scheduler
   */
  public startScheduler(intervalMs: number = this.schedulerIntervalMs): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
    this.schedulerIntervalMs = intervalMs;
    console.log(
      `[PriceSentinel] Daemon active. Scheduled to run every ${Math.round(
        intervalMs / (1000 * 60)
      )} minutes.`
    );

    this.timer = setInterval(() => {
      this.runAuditCycle().catch((err) => {
        console.error("[PriceSentinel] Error during scheduled audit cycle:", err);
      });
    }, intervalMs);
  }

  /**
   * Stops the background scheduler
   */
  public stopScheduler(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log("[PriceSentinel] Background scheduler stopped.");
    }
  }

  /**
   * Returns live diagnostic stats for the Sentinel
   */
  public getStats(ownerId?: string) {
    const shared = {
      schedulerActive: this.timer !== null,
      intervalMinutes: Math.round(this.schedulerIntervalMs / (1000 * 60)),
    };
    if (ownerId) {
      // Built only from this user's recent audits, so nothing reveals other users' activity.
      const audits = this.auditHistory.filter((a) => a.ownerId === ownerId);
      return {
        ...shared,
        totalAuditsRun: audits.length,
        anomaliesDetected: audits.filter(
          (a) => a.status === "BUDGET_EXCEEDED" || a.status === "ANOMALY_SPIKE"
        ).length,
        savingsIdentified: Number(
          audits
            .filter((a) => a.status === "PRICE_DROP")
            .reduce((total, a) => total + (a.oldPrice - a.newPrice), 0)
            .toFixed(2)
        ),
        lastRunAt: audits[0]?.timestamp || null,
        lastSummary: null,
        recentAudits: audits.slice(0, 10),
      };
    }
    return {
      ...shared,
      totalAuditsRun: this.totalAuditsRun,
      anomaliesDetected: this.anomaliesDetected,
      savingsIdentified: Number(this.savingsIdentified.toFixed(2)),
      lastRunAt: this.lastSummary?.completedAt || null,
      lastSummary: this.lastSummary,
      recentAudits: this.auditHistory.slice(0, 10),
    };
  }
}

export const priceSentinel = new PriceSentinelWorker();
