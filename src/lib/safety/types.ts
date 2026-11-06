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
  orderId: string;
  serviceName: string;
  amount: number;
  currency?: string;
  budgetCeiling: number;
  idempotencyKey?: string;
  cooldownSeconds?: number; // default: 300s (5 mins)
  allowDuplicateWithinWindow?: boolean;
  receiptData?: object | null;
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
  status: "COMPLETED" | "BLOCKED" | "FAILED";
  message: string;
  receiptData?: object | null;
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
