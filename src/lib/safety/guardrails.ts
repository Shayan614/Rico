import { db, auditLogs } from "@/db";
import {
  GuardrailEvaluationParams,
  GuardrailEvaluationResult,
} from "./types";

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Check if verified live merchant price exceeds user-authorized budget ceiling
 */
export function checkBudgetCeiling(
  scrapedPrice: number,
  budgetCeiling: number
): { exceeded: boolean; diff: number } {
  const diff = Number((scrapedPrice - budgetCeiling).toFixed(2));
  return {
    exceeded: diff > 0,
    diff,
  };
}

/**
 * Check if verified live price shows a sudden spike over historical/expected baseline (>20%)
 */
export function checkPriceAnomaly(
  scrapedPrice: number,
  baselinePrice: number,
  thresholdPercent: number = 20
): { isAnomaly: boolean; percentageJump: number } {
  if (!baselinePrice || baselinePrice <= 0) {
    return { isAnomaly: false, percentageJump: 0 };
  }

  const diffRatio = (scrapedPrice - baselinePrice) / baselinePrice;
  const percentageJump = Math.round(diffRatio * 100);

  return {
    isAnomaly: percentageJump >= thresholdPercent,
    percentageJump,
  };
}

/**
 * Master Guardrail & Anomaly Engine
 * Enforces:
 * 1. Hard Budget Ceiling (Hard Stop)
 * 2. Sudden Price Spike Anomaly (>20% Jump -> Human-in-the-Loop Hold)
 * 3. Strict Approval Mode (User Opt-in -> Manual Confirmation)
 */
export async function evaluateFinancialGuardrails(
  params: GuardrailEvaluationParams
): Promise<GuardrailEvaluationResult> {
  const {
    serviceName,
    scrapedPrice,
    budgetCeiling,
    expectedPrice,
    strictMode = false,
    anomalyThresholdPercent = 20,
  } = params;

  // Tier 1: Hard Budget Ceiling Check
  const ceilingCheck = checkBudgetCeiling(scrapedPrice, budgetCeiling);
  if (ceilingCheck.exceeded) {
    const reason = `HARD GUARDRAIL BLOCKED: Scraped price ($${scrapedPrice.toFixed(
      2
    )}) exceeds authorized budget ceiling ($${budgetCeiling.toFixed(
      2
    )}) by $${ceilingCheck.diff.toFixed(2)}. Execution rejected.`;

    await db.insert(auditLogs).values({
      id: generateId("log"),
      eventType: "GUARDRAIL_BLOCKED",
      service: serviceName,
      details: reason,
      severity: "danger",
      metadata: {
        scrapedPrice,
        budgetCeiling,
        excess: ceilingCheck.diff,
      },
    });

    return {
      passed: false,
      status: "BLOCKED",
      reason,
      budgetExceeded: true,
      exceededBy: ceilingCheck.diff,
      anomalyDetected: false,
      approvalRequired: false,
    };
  }

  // Tier 2: Price Spike Anomaly Check
  if (expectedPrice && expectedPrice > 0) {
    const anomalyCheck = checkPriceAnomaly(
      scrapedPrice,
      expectedPrice,
      anomalyThresholdPercent
    );

    if (anomalyCheck.isAnomaly) {
      const reason = `PRICE ANOMALY DETECTED: Verified price ($${scrapedPrice.toFixed(
        2
      )}) jumped +${anomalyCheck.percentageJump}% over baseline ($${expectedPrice.toFixed(
        2
      )}). Autonomous execution paused for review.`;

      await db.insert(auditLogs).values({
        id: generateId("log"),
        eventType: "ANOMALY_DETECTED",
        service: serviceName,
        details: reason,
        severity: "warning",
        metadata: {
          scrapedPrice,
          baselinePrice: expectedPrice,
          percentageJump: anomalyCheck.percentageJump,
        },
      });

      return {
        passed: false,
        status: "ANOMALY_HOLD",
        reason,
        budgetExceeded: false,
        anomalyDetected: true,
        anomalyPercent: anomalyCheck.percentageJump,
        approvalRequired: true,
        approvalReason: reason,
      };
    }
  }

  // Tier 3: Strict Approval Mode Policy
  if (strictMode) {
    const reason = `STRICT APPROVAL REQUIRED: Price ($${scrapedPrice.toFixed(
      2
    )}) is within $${budgetCeiling.toFixed(
      2
    )} ceiling, but Strict Approval Mode is active. Awaiting manual confirmation.`;

    await db.insert(auditLogs).values({
      id: generateId("log"),
      eventType: "MANUAL_APPROVAL_REQUIRED",
      service: serviceName,
      details: reason,
      severity: "info",
      metadata: {
        scrapedPrice,
        budgetCeiling,
        strictMode: true,
      },
    });

    return {
      passed: false,
      status: "APPROVAL_REQUIRED",
      reason,
      budgetExceeded: false,
      anomalyDetected: false,
      approvalRequired: true,
      approvalReason: reason,
    };
  }

  // Tier 4: Autonomous Green Pass
  const reason = `GUARDRAILS PASSED: Verified price ($${scrapedPrice.toFixed(
    2
  )}) is within authorized $${budgetCeiling.toFixed(
    2
  )} ceiling. Autonomous payment authorized.`;

  return {
    passed: true,
    status: "PASSED",
    reason,
    budgetExceeded: false,
    anomalyDetected: false,
    approvalRequired: false,
  };
}
