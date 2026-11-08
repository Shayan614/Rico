export type SubscriptionType =
  | "FREE_TRIAL"
  | "MONTHLY_RECURRING"
  | "ANNUAL_CONTRACT"
  | "MULTI_YEAR"
  | "PER_SEAT";

export type WatchdogRiskLevel =
  | "CRITICAL"
  | "HIGH"
  | "MEDIUM"
  | "LOW"
  | "HEALTHY";

export type WatchdogActionType =
  | "CANCEL_TRIAL"
  | "RENEGOTIATE_CONTRACT"
  | "DOWNGRADE_SEATS"
  | "SWITCH_ANNUAL_DISCOUNT"
  | "PAUSE_MANDATE"
  | "ACCEPT_RENEWAL";

export interface ZombieSeatAnalysis {
  totalSeats: number;
  activeSeats: number;
  zombieSeats: number;
  costPerSeatUsd: number;
  wastedMonthlySpendUsd: number;
  potentialAnnualSavingsUsd: number;
}

export interface ContractRenewalInput {
  id?: string;
  service: string;
  vendor?: string;
  type?: SubscriptionType;
  currentPrice: number;
  budgetCeiling?: number;
  currency?: string;
  renewalDate: string; // YYYY-MM-DD
  noticePeriodDays?: number;
  autoRenewLocked?: boolean;
  totalSeats?: number;
  activeSeats?: number;
  costPerSeatUsd?: number;
  annualDiscountPercent?: number;
  mandateId?: string;
}

export interface ContractRenewalInfo {
  contractId: string;
  service: string;
  vendor: string;
  type: SubscriptionType;
  currentPrice: number;
  budgetCeiling: number;
  currency: string;
  renewalDate: string;
  noticePeriodDays: number;
  cancellationDeadline: string;
  daysUntilRenewal: number;
  daysUntilNoticeDeadline: number;
  autoRenewLocked: boolean;
  annualDiscountAvailablePercent: number;
}

export interface WatchdogRecommendation {
  type: WatchdogActionType;
  label: string;
  description: string;
  estimatedSavingsUsd: number;
  urgency: "IMMEDIATE" | "UPCOMING" | "OPTIONAL";
}

export interface WatchdogAuditResult {
  id: string;
  service: string;
  contract: ContractRenewalInfo;
  riskLevel: WatchdogRiskLevel;
  isUrgent: boolean;
  zombieSeats?: ZombieSeatAnalysis;
  priceCreep: {
    baselinePrice: number;
    currentPrice: number;
    creepPercent: number;
    hasCreep: boolean;
  };
  recommendedActions: WatchdogRecommendation[];
  totalPotentialSavingsUsd: number;
  matchedMandateId?: string;
  alertDispatched: boolean;
  omnichannelMessage: string;
  auditedAt: string;
}

export interface BatchWatchdogSummary {
  totalAudited: number;
  criticalRisksCount: number;
  upcomingRenewalsCount: number;
  zombieSeatsIdentifiedCount: number;
  totalPotentialAnnualSavingsUsd: number;
  audits: WatchdogAuditResult[];
  categoryBreakdown: {
    freeTrials: number;
    contractsToRenew: number;
    zombieSeatSavings: number;
    annualDiscountSavings: number;
  };
}
