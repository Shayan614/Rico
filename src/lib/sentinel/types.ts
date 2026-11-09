export type SentinelAlertStatus = "PENDING" | "APPROVED" | "BACKUP_PAID" | "CANCELLED";

export type SentinelAuditResultStatus =
  | "NORMAL"
  | "PRICE_DROP"
  | "PRICE_INCREASE_SAFE"
  | "ANOMALY_SPIKE"
  | "BUDGET_EXCEEDED"
  // The live price could not be read, so nothing is known and the rule was left unchanged.
  | "UNVERIFIED";

export interface SentinelAuditRecord {
  id: string;
  ownerId?: string | null;
  mandateId: string;
  service: string;
  oldPrice: number;
  newPrice: number;
  budgetCeiling: number;
  currency: string;
  status: SentinelAuditResultStatus;
  percentageDiff: number;
  details: string;
  alertDispatched: boolean;
  alertId?: string;
  timestamp: string;
}

export interface SentinelCycleSummary {
  cycleId: string;
  startedAt: string;
  completedAt: string;
  totalAudited: number;
  healthyCount: number;
  anomaliesDetected: number;
  savingsCount: number;
  unverifiedCount: number;
  /** Alerts recorded by this run, including simulated ones. */
  alertsDispatched: number;
  /** Alerts actually accepted by a real messaging service. */
  alertsDelivered: number;
  audits: SentinelAuditRecord[];
}

export interface OmnichannelAlert {
  id: string;
  mandateId: string;
  ownerId?: string | null;
  service: string;
  planName?: string;
  oldPrice: number;
  newPrice: number;
  jumpPercent: number;
  budgetCeiling: number;
  currency: string;
  channel: "telegram" | "whatsapp" | "slack";
  status: SentinelAlertStatus;
  timestamp: string;
  resolvedAt?: string;
  resolvedAction?: "approve" | "backup_card" | "cancel";
  transactionId?: string;
  orderId?: string;
  message?: string;
}

export interface RemoteActionResult {
  success: boolean;
  action: "approve" | "backup_card" | "cancel";
  mandateId: string;
  service: string;
  alertId?: string;
  amount?: number;
  orderId?: string;
  captureId?: string;
  fundingRail?: "PAYPAL" | "VISA" | "MASTERCARD";
  mandateStatus: "ACTIVE" | "PAUSED" | "ANOMALY_HOLD";
  message: string;
  timestamp: string;
}
