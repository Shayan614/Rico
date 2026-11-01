import { db, mandates, auditLogs, MandateRecord } from "@/db";
import { eq } from "drizzle-orm";
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
  }): Promise<SentinelCycleSummary> {
    if (this.isRunningAudit) {
      console.log("[PriceSentinel] Audit cycle already in progress, skipping concurrent run.");
      if (this.lastSummary) return this.lastSummary;
    }

    this.isRunningAudit = true;
    const cycleId = generateId("cycle");
    const startedAt = new Date().toISOString();
    const cycleAudits: SentinelAuditRecord[] = [];

    let healthyCount = 0;
    let anomalies = 0;
    let savings = 0;
    let alertsSent = 0;

    try {
      // 1. Fetch active mandates from SQLite memory
      let targetMandates: MandateRecord[] = [];
      if (options?.mandateId) {
        const single = db
          .select()
          .from(mandates)
          .where(eq(mandates.id, options.mandateId))
          .get();
        if (single) targetMandates = [single];
      } else {
        targetMandates = db
          .select()
          .from(mandates)
          .where(eq(mandates.status, "ACTIVE"))
          .all();
      }

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

        let livePrice: number;
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
            livePrice = scrape.price;
            planName = scrape.planName;
          } catch {
            livePrice = baselinePrice;
          }
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
          // Flag Price Spike Anomaly / Budget Exceeded
          status = ceilingCheck.exceeded ? "BUDGET_EXCEEDED" : "ANOMALY_SPIKE";
          diffPercent = anomalyCheck.percentageJump;
          details = ceilingCheck.exceeded
            ? `Price ($${livePrice.toFixed(2)}) exceeds authorized budget ceiling ($${mandate.budgetCeiling.toFixed(2)}) by $${ceilingCheck.diff.toFixed(2)}.`
            : `Price jumped +${diffPercent}% from historical baseline ($${baselinePrice.toFixed(2)} ➔ $${livePrice.toFixed(2)}).`;

          anomalies++;
          this.anomaliesDetected++;

          // Update Mandate status to ANOMALY_HOLD in SQLite
          db.update(mandates)
            .set({
              status: "ANOMALY_HOLD",
              lastScrapedPrice: livePrice,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(mandates.id, mandate.id))
            .run();

          // Log warning in SQLite audit_logs
          db.insert(auditLogs)
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
            })
            .run();

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

          await omnichannelDispatcher.dispatchAlert(alertPayload);
          alertDispatched = true;
          alertsSent++;
        } else if (livePrice < baselinePrice) {
          // Price Drop detected! (Savings)
          status = "PRICE_DROP";
          const savedAmount = baselinePrice - livePrice;
          diffPercent = -Math.round((savedAmount / baselinePrice) * 100);
          details = `Price drop detected! Plan decreased from $${baselinePrice.toFixed(2)} to $${livePrice.toFixed(2)} (${diffPercent}% savings).`;
          savings++;
          this.savingsIdentified += savedAmount;

          db.update(mandates)
            .set({
              lastScrapedPrice: livePrice,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(mandates.id, mandate.id))
            .run();

          db.insert(auditLogs)
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
            })
            .run();
        } else {
          // Normal within budget
          healthyCount++;
          db.update(mandates)
            .set({
              lastScrapedPrice: livePrice,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(mandates.id, mandate.id))
            .run();
        }

        const auditRecord: SentinelAuditRecord = {
          id: auditId,
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
        alertsDispatched: alertsSent,
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
  public getStats() {
    return {
      schedulerActive: this.timer !== null,
      intervalMinutes: Math.round(this.schedulerIntervalMs / (1000 * 60)),
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
