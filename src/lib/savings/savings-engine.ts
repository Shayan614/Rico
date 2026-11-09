import { db, auditLogs, mandates } from "@/db";
import { and, eq } from "drizzle-orm";
import { executeMandatePayment, type PayPalReceipt } from "@/lib/paypal";
import { executeAtomicPaymentTransaction } from "@/lib/safety/atomic-transaction";
import { mandatePeriodKey } from "@/lib/safety/billing-period";
import { posthogServer } from "@/lib/telemetry/posthog-server";
import { PERSONA_DEALS_MATRIX } from "./deal-matrix";
import {
  UserPersona,
  PersonaSavingsDeal,
  SavingsProbeResult,
  SavingsAdvisoryData,
} from "./types";

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

export class PersonaSavingsOptimizer {
  private activePersona: UserPersona = "STARTUP_FOUNDER";

  public getActivePersona(): UserPersona {
    return this.activePersona;
  }

  public setActivePersona(persona: UserPersona): void {
    this.activePersona = persona;
  }

  /**
   * Finds all deals matching a merchant service name and user persona
   */
  public findDeals(serviceName: string, persona: UserPersona = this.activePersona): PersonaSavingsDeal[] {
    const term = serviceName.toLowerCase().trim();

    return PERSONA_DEALS_MATRIX.filter((deal) => {
      const matchesPersona = deal.persona === persona;
      const matchesService =
        term.includes(deal.serviceKey) ||
        deal.serviceKey.includes(term) ||
        deal.service.toLowerCase().includes(term);

      return matchesPersona && matchesService;
    });
  }

  /**
   * Pre-payment savings probe: checks credit databases and active coupons
   * before a PayPal payment is authorized or captured.
   */
  public async probePersonaSavings(params: {
    serviceName: string;
    currentPrice: number;
    persona?: UserPersona;
    mandateId?: string;
  }): Promise<SavingsProbeResult> {
    const persona = params.persona || this.activePersona;
    const { serviceName, currentPrice } = params;

    const matchedDeals = this.findDeals(serviceName, persona);

    if (matchedDeals.length === 0) {
      return {
        service: serviceName,
        persona,
        hasDeals: false,
        deals: [],
        originalPrice: currentPrice,
        discountedPrice: currentPrice,
        reclaimedCredits: 0,
        directSavings: 0,
        recommendation: `No specific ${persona} subsidies or active coupons found for ${serviceName}. Charging standard verified price $${currentPrice.toFixed(
          2
        )}.`,
      };
    }

    // Sort to pick best deal (highest credit value or highest percentage discount)
    const sorted = [...matchedDeals].sort((a, b) => {
      if (b.reclaimedCreditValue !== a.reclaimedCreditValue) {
        return b.reclaimedCreditValue - a.reclaimedCreditValue;
      }
      return b.savingsPercentage - a.savingsPercentage;
    });

    const bestDeal = sorted[0];
    const discountedPrice = Math.min(currentPrice, bestDeal.discountedPrice);
    const directSavings = Number(Math.max(0, currentPrice - discountedPrice).toFixed(2));
    const reclaimedCredits = bestDeal.reclaimedCreditValue;

    let recommendation = "";
    if (bestDeal.dealType === "STARTUP_CREDITS") {
      recommendation = `💡 WAIT! Before paying $${currentPrice.toFixed(
        2
      )}/mo, you qualify for ${bestDeal.headline}! You can claim up to $${reclaimedCredits.toLocaleString()} in credits and waive this charge entirely.`;
    } else if (bestDeal.dealType === "STUDENT_DISCOUNT") {
      recommendation = `🎓 Student Perk Detected: You qualify for ${bestDeal.headline}. Verified price drops from $${currentPrice.toFixed(
        2
      )} to $${discountedPrice.toFixed(2)}/mo (Saving $${directSavings.toFixed(2)}/mo).`;
    } else {
      recommendation = `🏷️ Promo/Arbitrage Applied: ${bestDeal.headline}. Price discounted to $${discountedPrice.toFixed(
        2
      )} (Saving $${directSavings.toFixed(2)}).`;
    }

    const advisory: SavingsAdvisoryData = {
      service: serviceName,
      persona,
      originalPrice: currentPrice,
      discountedPrice,
      reclaimedCredits,
      savingsEnforced: directSavings,
      currency: "USD",
      appliedDealHeadline: bestDeal.headline,
      couponCode: bestDeal.couponCode,
      claimUrl: bestDeal.claimUrl,
      dealType: bestDeal.dealType,
      timestamp: new Date().toISOString(),
    };

    // Telemetry: Log pre-payment savings intercept event to PostHog
    await posthogServer.capture({
      event: "savings_intercept_triggered",
      properties: {
        service: serviceName,
        persona,
        original_price: currentPrice,
        discounted_price: discountedPrice,
        dollars_saved: directSavings,
        reclaimed_credits: reclaimedCredits,
        deal_id: bestDeal.id,
      },
    });

    // Persistent audit log
    await db.insert(auditLogs).values({
      id: generateId("log"),
      mandateId: params.mandateId,
      eventType: "PRICE_VERIFIED",
      service: serviceName,
      details: `Pre-Payment Savings Probe: Intercepted ${serviceName}. Found eligible deal: ${bestDeal.headline} (Reclaimed: $${reclaimedCredits.toLocaleString()}, Discounted to: $${discountedPrice.toFixed(
        2
      )}).`,
      severity: "success",
      metadata: {
        dealId: bestDeal.id,
        persona,
        originalPrice: currentPrice,
        discountedPrice,
        reclaimedCredits,
      },
    });

    return {
      service: serviceName,
      persona,
      hasDeals: true,
      deals: matchedDeals,
      bestDeal,
      originalPrice: currentPrice,
      discountedPrice,
      reclaimedCredits,
      directSavings,
      recommendation,
      advisory,
    };
  }

  /**
   * Executes PayPal capture for the discounted amount and saves savings audit record.
   * The amount, deal and ceiling all come from server data; the client's price is only compared.
   */
  public async applySavingsPayment(params: {
    serviceName: string;
    discountedPrice: number;
    mandateId?: string;
    dealId?: string;
    fundingRail?: "PAYPAL" | "VISA" | "MASTERCARD" | "AUTO";
    /** The verified user paying. Never taken from the request body. */
    ownerId: string;
  }): Promise<{
    success: boolean;
    orderId: string;
    captureId: string;
    receipt: PayPalReceipt;
    dollarsSaved: number;
    message: string;
  }> {
    const { serviceName, mandateId, fundingRail, dealId, ownerId } = params;

    const candidates = mandateId
      ? await db.select().from(mandates).where(and(eq(mandates.id, mandateId), eq(mandates.ownerId, ownerId))).limit(1)
      : (await db.select().from(mandates).where(and(eq(mandates.status, "ACTIVE"), eq(mandates.ownerId, ownerId)))).filter(
          (m) => m.service.toLowerCase() === serviceName.toLowerCase()
        );
    if (candidates.length !== 1) {
      throw new Error(`GUARDRAIL BLOCKED: Could not identify one mandate for ${serviceName}.`);
    }
    const mandate = candidates[0];

    const matchedDeal = dealId
      ? PERSONA_DEALS_MATRIX.find((d) => d.id === dealId)
      : [...this.findDeals(mandate.service)].sort(
          (a, b) => b.reclaimedCreditValue - a.reclaimedCreditValue
        )[0];
    const term = mandate.service.toLowerCase();
    if (!matchedDeal || !term.includes(matchedDeal.serviceKey)) {
      throw new Error(`GUARDRAIL BLOCKED: No valid savings deal applies to ${mandate.service}.`);
    }

    const originalPrice =
      mandate.lastScrapedPrice > 0 ? mandate.lastScrapedPrice : matchedDeal.regularPrice;
    const discountedPrice = Math.min(originalPrice, matchedDeal.discountedPrice);
    if (discountedPrice <= 0) {
      throw new Error(`GUARDRAIL BLOCKED: ${matchedDeal.headline} requires no payment.`);
    }
    if (Math.abs(discountedPrice - params.discountedPrice) >= 0.005) {
      throw new Error(
        `GUARDRAIL BLOCKED: Requested $${params.discountedPrice.toFixed(2)} does not match server price $${discountedPrice.toFixed(2)}.`
      );
    }

    const budgetCeiling = mandate.budgetCeiling;
    const dollarsSaved = Number(Math.max(0, originalPrice - discountedPrice).toFixed(2));
    // Shares the mandate's billing-period key with every other payment path, so applying a deal
    // can never add a second charge for the same period.
    const idempotencyKey = mandatePeriodKey(mandate);

    // 1. Reserve, capture and record through the guarded payment path
    const atomicResult = await executeAtomicPaymentTransaction({
      mandateId: mandate.id,
      ownerId,
      orderId: `ORD-${Date.now()}`,
      idempotencyKey,
      serviceName: mandate.service,
      amount: discountedPrice,
      budgetCeiling,
      allowedMandateStatuses: ["ACTIVE"],
      auditDetails: `Savings Applied: Paid discounted total of $${discountedPrice.toFixed(
        2
      )} (Saved $${dollarsSaved.toFixed(2)} via ${matchedDeal.headline}).`,
      auditMetadata: { discountedPrice, originalPrice, dollarsSaved, dealId: matchedDeal.id },
      executePaymentFn: async () => {
        const payment = await executeMandatePayment({
          serviceName: mandate.service,
          verifiedPrice: discountedPrice,
          budgetCeiling,
          mandateId: mandate.id,
          fundingRail: fundingRail || "PAYPAL",
          paymentAttemptKey: idempotencyKey,
        });
        return {
          ...payment,
          receipt: {
            ...payment.receipt,
            savingsEnforced: dollarsSaved,
            claimedCredits: matchedDeal.reclaimedCreditValue,
          },
        };
      },
    });

    if (!atomicResult.success) {
      throw new Error(atomicResult.message);
    }

    const paymentResult = {
      orderId: atomicResult.orderId,
      captureId: atomicResult.captureId || "",
      receipt: atomicResult.receiptData as unknown as PayPalReceipt,
    };

    // 5. Telemetry
    await posthogServer.trackPaymentCompleted({
      service: mandate.service,
      amount: discountedPrice,
      orderId: paymentResult.orderId,
      budgetCeiling,
      savingsEnforced: dollarsSaved,
      paymentMethod:
        paymentResult.receipt.fundingRail === "PAYPAL"
          ? "PayPal Sandbox Wallet (Discount Applied)"
          : "Vaulted Card (Discount Applied)",
    });

    return {
      success: true,
      orderId: paymentResult.orderId,
      captureId: paymentResult.captureId,
      receipt: paymentResult.receipt,
      dollarsSaved,
      message: `Discounted payment captured: $${discountedPrice.toFixed(
        2
      )} paid via PayPal (Reclaimed $${dollarsSaved.toFixed(2)} in savings!).`,
    };
  }
}

export const personaSavingsOptimizer = new PersonaSavingsOptimizer();
