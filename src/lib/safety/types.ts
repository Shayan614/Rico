export type GuardrailStatus =
  | "PASSED"
  | "BLOCKED"
  | "ANOMALY_HOLD"
  | "APPROVAL_REQUIRED";

export interface DoubleBillingCheckResult {
  allowed: boolean;
  reason?: string;
  existingTransactionId?: string;
  cooldownRemainingSeconds?: number;
}

export interface AtomicPaymentExecutionParams {
  mandateId?: string;
  /** The verified user paying. Required on the PostgreSQL path whenever a mandate is named. */
  ownerId?: string;
  orderId: string;
  serviceName: string;
  amount: number;
  currency?: string;
  budgetCeiling: number;
  idempotencyKey?: string;
  cooldownSeconds?: number; // default: 300s (5 mins)
  allowDuplicateWithinWindow?: boolean;
  receiptData?: object | null;
  /** When set, the stored mandate must exist in one of these states and its own ceiling applies. */
  allowedMandateStatuses?: Array<"ACTIVE" | "PAUSED" | "ANOMALY_HOLD">;
  mandateStatusOnCommit?: "ACTIVE" | "PAUSED" | "ANOMALY_HOLD";
  auditDetails?: string;
  auditMetadata?: Record<string, unknown>;
  /** Custom async payment executor (e.g. PayPal API call). If omitted, receiptData is used */
  executePaymentFn?: () => Promise<{
    orderId: string;
    captureId: string;
    receipt: object;
  }>;
}

export interface AtomicPaymentExecutionResult {
  success: boolean;
  transactionId?: string;
  orderId: string;
  /** NEEDS_RECONCILIATION: money moved or may have moved, and the reservation stays PENDING. */
  status: "COMPLETED" | "BLOCKED" | "FAILED" | "NEEDS_RECONCILIATION";
  message: string;
  receiptData?: object | null;
  captureId?: string;
  paymentOutcome?: "CAPTURED" | "UNKNOWN" | "DECLINED";
  rolledBack?: boolean;
  error?: string;
}

export interface GuardrailEvaluationParams {
  serviceName: string;
  scrapedPrice: number;
  budgetCeiling: number;
  expectedPrice?: number;
  strictMode?: boolean;
  anomalyThresholdPercent?: number; // default: 20%
}

export interface GuardrailEvaluationResult {
  passed: boolean;
  status: GuardrailStatus;
  reason: string;
  budgetExceeded: boolean;
  exceededBy?: number;
  anomalyDetected: boolean;
  anomalyPercent?: number;
  approvalRequired: boolean;
  approvalReason?: string;
}

export interface SafetyApprovalRequest {
  id: string;
  service: string;
  detectedPrice: number;
  budgetCeiling: number;
  reason: string;
  currency: string;
  status: GuardrailStatus;
  anomalyPercent?: number;
  mandateId?: string;
}
