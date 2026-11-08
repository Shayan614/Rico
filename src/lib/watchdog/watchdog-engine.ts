import {
  BatchWatchdogSummary,
  ContractRenewalInfo,
  ContractRenewalInput,
  WatchdogAuditResult,
  WatchdogRecommendation,
  WatchdogRiskLevel,
  ZombieSeatAnalysis,
} from "./types";
import { db } from "@/db";
import { mandates, auditLogs } from "@/db/schema";
import { batchQueueEngine } from "@/lib/batch";
import { posthogServer } from "@/lib/telemetry/posthog-server";

export class WatchdogEngine {
  /**
   * Run comprehensive audit on a single contract or recurring subscription
   */
  public async auditContract(
    input: ContractRenewalInput,
    referenceDateMs: number = Date.now()
  ): Promise<WatchdogAuditResult> {
    const today = referenceDateMs;
    const renewalMs = new Date(input.renewalDate).getTime();
    const daysUntilRenewal = Math.ceil((renewalMs - today) / (1000 * 60 * 60 * 24));

    const noticePeriodDays =
      input.noticePeriodDays ??
      (input.type === "ANNUAL_CONTRACT" ? 60 : input.type === "FREE_TRIAL" ? 2 : 30);

    const deadlineMs = renewalMs - noticePeriodDays * 24 * 60 * 60 * 1000;
    const daysUntilNoticeDeadline = Math.ceil((deadlineMs - today) / (1000 * 60 * 60 * 24));
    const cancellationDeadline = new Date(deadlineMs).toISOString().split("T")[0];

    const type = input.type || "MONTHLY_RECURRING";
    const currentPrice = Number(input.currentPrice.toFixed(2));
    const currency = input.currency || "USD";

    // 1. Cross-check with SQLite Mandates
    let matchedMandateId = input.mandateId;
    let budgetCeiling = input.budgetCeiling || currentPrice * 1.25;
    let baselinePrice = currentPrice;

    try {
      const allMandates = await db.select().from(mandates);
      const match = allMandates.find((m) =>
        m.service.toLowerCase().includes(input.service.toLowerCase())
      );
      if (match) {
        matchedMandateId = match.id;
        budgetCeiling = match.budgetCeiling;
        baselinePrice = match.lastScrapedPrice > 0 ? match.lastScrapedPrice : currentPrice;
      }
    } catch {
      // Offline fallback
    }

    const priceCreepDiff = currentPrice - baselinePrice;
    const creepPercent =
      baselinePrice > 0 ? Number(((priceCreepDiff / baselinePrice) * 100).toFixed(1)) : 0;
    const hasCreep = currentPrice > budgetCeiling || creepPercent > 10;

    // 2. Risk Level Evaluation
    let riskLevel: WatchdogRiskLevel = "HEALTHY";
    let isUrgent = false;
    const recommendedActions: WatchdogRecommendation[] = [];
    let totalPotentialSavingsUsd = 0;

    // A. Free Trial Expiration Sentinel
    if (type === "FREE_TRIAL") {
      if (daysUntilRenewal <= 2 && daysUntilRenewal >= 0) {
        riskLevel = "CRITICAL";
        isUrgent = true;
        recommendedActions.push({
          type: "CANCEL_TRIAL",
          label: "Cancel Free Trial Immediately",
          description: `Trial expires in ${daysUntilRenewal} day(s). Auto-conversion to paid recurring billing ($${currentPrice}/mo) will occur unless cancelled.`,
          estimatedSavingsUsd: Number((currentPrice * 12).toFixed(2)),
          urgency: "IMMEDIATE",
        });
        totalPotentialSavingsUsd += currentPrice * 12;
      } else if (daysUntilRenewal <= 7) {
        riskLevel = "HIGH";
        recommendedActions.push({
          type: "CANCEL_TRIAL",
          label: "Review Free Trial Utility",
          description: `Trial expires in ${daysUntilRenewal} days. Decide whether to retain or cancel.`,
          estimatedSavingsUsd: Number((currentPrice * 12).toFixed(2)),
          urgency: "UPCOMING",
        });
      }
    }

    // B. Vendor Contract Auto-Renew Notice Window
    if (type === "ANNUAL_CONTRACT" || type === "MULTI_YEAR") {
      if (daysUntilNoticeDeadline <= 0 && daysUntilRenewal > 0) {
        riskLevel = "CRITICAL";
        isUrgent = true;
        recommendedActions.push({
          type: "RENEGOTIATE_CONTRACT",
          label: "Notice Deadline Missed — Request Waiver",
          description: `The mandatory ${noticePeriodDays}-day cancellation notice deadline has passed. Contact vendor immediately to negotiate or waive auto-renewal penalty.`,
          estimatedSavingsUsd: Number((currentPrice * 0.15).toFixed(2)),
          urgency: "IMMEDIATE",
        });
        totalPotentialSavingsUsd += currentPrice * 0.15;
      } else if (daysUntilNoticeDeadline <= 15 && daysUntilNoticeDeadline > 0) {
        riskLevel = "HIGH";
        isUrgent = true;
        recommendedActions.push({
          type: "RENEGOTIATE_CONTRACT",
          label: "Renegotiate Vendor Contract",
          description: `${daysUntilNoticeDeadline} days remaining before 60-day auto-lockin deadline. Demand tier downgrade or competitor discount.`,
          estimatedSavingsUsd: Number((currentPrice * 0.2).toFixed(2)),
          urgency: "IMMEDIATE",
        });
        totalPotentialSavingsUsd += currentPrice * 0.2;
      } else if (daysUntilNoticeDeadline <= 60 && daysUntilNoticeDeadline > 0) {
        if (riskLevel === "HEALTHY") riskLevel = "MEDIUM";
        recommendedActions.push({
          type: "RENEGOTIATE_CONTRACT",
          label: "Prepare Renewal Negotiation",
          description: `Renewal window approaching in ${daysUntilNoticeDeadline} days. Benchmark market rates.`,
          estimatedSavingsUsd: Number((currentPrice * 0.1).toFixed(2)),
          urgency: "UPCOMING",
        });
      }
    }

    // C. Zombie Seat Audit
    let zombieSeats: ZombieSeatAnalysis | undefined;
    if (
      input.totalSeats &&
      input.activeSeats !== undefined &&
      input.totalSeats > input.activeSeats
    ) {
      const totalSeats = input.totalSeats;
      const activeSeats = input.activeSeats;
      const unused = totalSeats - activeSeats;
      const costPerSeat =
        input.costPerSeatUsd || Number((currentPrice / totalSeats).toFixed(2));
      const wastedMonthly = Number((unused * costPerSeat).toFixed(2));
      const potentialAnnual = Number((wastedMonthly * 12).toFixed(2));

      zombieSeats = {
        totalSeats,
        activeSeats,
        zombieSeats: unused,
        costPerSeatUsd: costPerSeat,
        wastedMonthlySpendUsd: wastedMonthly,
        potentialAnnualSavingsUsd: potentialAnnual,
      };

      if (unused >= 2 || wastedMonthly >= 50) {
        if (riskLevel === "HEALTHY" || riskLevel === "MEDIUM") riskLevel = "HIGH";
        recommendedActions.push({
          type: "DOWNGRADE_SEATS",
          label: `Deprovision ${unused} Zombie Seats`,
          description: `Found ${unused} unassigned or inactive seat licenses ($${costPerSeat}/seat/mo). Reclaim license pool.`,
          estimatedSavingsUsd: potentialAnnual,
          urgency: "IMMEDIATE",
        });
        totalPotentialSavingsUsd += potentialAnnual;
      }
    }

    // D. Annual Plan Arbitrage
    const annualDiscount = input.annualDiscountPercent || (type === "MONTHLY_RECURRING" ? 20 : 0);
    if (type === "MONTHLY_RECURRING" && annualDiscount > 0) {
      const annualSpend = currentPrice * 12;
      const annualSavings = Number((annualSpend * (annualDiscount / 100)).toFixed(2));

      recommendedActions.push({
        type: "SWITCH_ANNUAL_DISCOUNT",
        label: `Switch to Annual Plan (Save ${annualDiscount}%)`,
        description: `Vendor offers a ${annualDiscount}% upfront discount for annual billing ($${annualSavings}/yr savings).`,
        estimatedSavingsUsd: annualSavings,
        urgency: "OPTIONAL",
      });
      totalPotentialSavingsUsd += annualSavings;
    }

    // E. Price Creep & Ceiling Breach Guard
    if (currentPrice > budgetCeiling) {
      riskLevel = "CRITICAL";
      isUrgent = true;
      recommendedActions.unshift({
        type: "PAUSE_MANDATE",
        label: "Halt Mandate Billing (Ceiling Breached)",
        description: `Current charge ($${currentPrice}) exceeds authorized budget ceiling ($${budgetCeiling}) by $${Number((currentPrice - budgetCeiling).toFixed(2))}.`,
        estimatedSavingsUsd: Number((currentPrice - budgetCeiling).toFixed(2)) * 12,
        urgency: "IMMEDIATE",
      });
    }

    // 3. Omnichannel Alert Formatting
    const alertHeader =
      riskLevel === "CRITICAL"
        ? "🚨 [CRITICAL WATCHDOG ALERT]"
        : riskLevel === "HIGH"
        ? "⚠️ [WATCHDOG WARNING]"
        : "ℹ️ [WATCHDOG NOTICE]";

    const omnichannelMessage = `${alertHeader} ${input.service}
• Type: ${type}
• Cost: $${currentPrice} ${currency} (Ceiling: $${budgetCeiling})
• Renewal Date: ${input.renewalDate} (${daysUntilRenewal}d remaining)
• Notice Deadline: ${cancellationDeadline} (${daysUntilNoticeDeadline}d remaining)
${zombieSeats ? `• Zombie Seats: ${zombieSeats.zombieSeats}/${zombieSeats.totalSeats} unused ($${zombieSeats.wastedMonthlySpendUsd}/mo wasted)\n` : ""}${recommendedActions.map((a) => `👉 Action: ${a.label} (Est. Savings: $${a.estimatedSavingsUsd})`).join("\n")}`;

    const auditId =
      input.id ||
      `wd_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const contractInfo: ContractRenewalInfo = {
      contractId: input.id || `ctr_${input.service.toLowerCase().replace(/[^a-z0-9]/g, "_")}`,
      service: input.service,
      vendor: input.vendor || input.service,
      type,
      currentPrice,
      budgetCeiling,
      currency,
      renewalDate: input.renewalDate,
      noticePeriodDays,
      cancellationDeadline,
      daysUntilRenewal,
      daysUntilNoticeDeadline,
      autoRenewLocked: input.autoRenewLocked ?? (daysUntilNoticeDeadline <= 0),
      annualDiscountAvailablePercent: annualDiscount,
    };

    // 4. Log to SQLite Audit Logs if Critical
    if (riskLevel === "CRITICAL" || isUrgent) {
      try {
        await db.insert(auditLogs).values({
          id: `audit_wd_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          mandateId: matchedMandateId,
          eventType: "ANOMALY_DETECTED",
          service: `Watchdog:${input.service}`,
          details: `Watchdog risk ${riskLevel} detected for ${input.service}: ${recommendedActions[0]?.label || "Urgent review required"}`,
          severity: "danger",
          metadata: {
            contractId: contractInfo.contractId,
            riskLevel,
            daysUntilRenewal,
            daysUntilNoticeDeadline,
            potentialSavingsUsd: totalPotentialSavingsUsd,
          },
        });
      } catch {
        // Non-fatal audit log insertion
      }
    }

    await posthogServer.capture({
      event: "contract_watchdog_audited",
      properties: {
        service: input.service,
        type,
        currentPrice,
        riskLevel,
        isUrgent,
        potentialSavingsUsd: totalPotentialSavingsUsd,
        hasZombieSeats: !!zombieSeats,
      },
    });

    return {
      id: auditId,
      service: input.service,
      contract: contractInfo,
      riskLevel,
      isUrgent,
      zombieSeats,
      priceCreep: {
        baselinePrice,
        currentPrice,
        creepPercent,
        hasCreep,
      },
      recommendedActions,
      totalPotentialSavingsUsd: Number(totalPotentialSavingsUsd.toFixed(2)),
      matchedMandateId,
      alertDispatched: isUrgent,
      omnichannelMessage,
      auditedAt: new Date(today).toISOString(),
    };
  }

  /**
   * Run parallel batch audit across portfolio contracts using BatchQueueEngine
   */
  public async auditBatch(
    inputs: ContractRenewalInput[],
    options?: { priority?: "CRITICAL" | "HIGH" | "NORMAL" | "LOW" }
  ): Promise<BatchWatchdogSummary> {
    const jobs = await batchQueueEngine.addBatch(
      "CONTRACT_WATCHDOG",
      inputs,
      {
        priority: options?.priority || "HIGH",
        maxRetries: 2,
      }
    );

    const completedJobs = await batchQueueEngine.waitForBatch<WatchdogAuditResult>(
      jobs.map((j) => j.id),
      30000
    );

    const audits: WatchdogAuditResult[] = completedJobs
      .filter((j) => j.status === "COMPLETED" && j.result)
      .map((j) => j.result as WatchdogAuditResult);

    let criticalRisksCount = 0;
    let upcomingRenewalsCount = 0;
    let zombieSeatsIdentifiedCount = 0;
    let totalPotentialAnnualSavingsUsd = 0;

    let freeTrials = 0;
    let contractsToRenew = 0;
    let zombieSeatSavings = 0;
    let annualDiscountSavings = 0;

    for (const a of audits) {
      if (a.riskLevel === "CRITICAL") criticalRisksCount++;
      if (a.contract.daysUntilNoticeDeadline <= 30 && a.contract.daysUntilNoticeDeadline >= 0) {
        upcomingRenewalsCount++;
      }
      if (a.zombieSeats && a.zombieSeats.zombieSeats > 0) {
        zombieSeatsIdentifiedCount += a.zombieSeats.zombieSeats;
        zombieSeatSavings += a.zombieSeats.potentialAnnualSavingsUsd;
      }
      if (a.contract.type === "FREE_TRIAL") freeTrials++;
      if (a.contract.type === "ANNUAL_CONTRACT") contractsToRenew++;

      for (const rec of a.recommendedActions) {
        if (rec.type === "SWITCH_ANNUAL_DISCOUNT") {
          annualDiscountSavings += rec.estimatedSavingsUsd;
        }
      }

      totalPotentialAnnualSavingsUsd += a.totalPotentialSavingsUsd;
    }

    return {
      totalAudited: audits.length,
      criticalRisksCount,
      upcomingRenewalsCount,
      zombieSeatsIdentifiedCount,
      totalPotentialAnnualSavingsUsd: Number(totalPotentialAnnualSavingsUsd.toFixed(2)),
      audits,
      categoryBreakdown: {
        freeTrials,
        contractsToRenew,
        zombieSeatSavings: Number(zombieSeatSavings.toFixed(2)),
        annualDiscountSavings: Number(annualDiscountSavings.toFixed(2)),
      },
    };
  }
}

export const watchdogEngine = new WatchdogEngine();
