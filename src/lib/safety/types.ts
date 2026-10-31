export type GuardrailStatus =
  | "PASSED"
  | "BLOCKED"
  | "ANOMALY_HOLD"
  | "APPROVAL_REQUIRED";

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
