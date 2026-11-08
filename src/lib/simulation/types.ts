export type ScenarioCategory =
  | "CEILING_BREACH"
  | "PRICE_SPIKE_ANOMALY"
  | "PROMPT_INJECTION_JAILBREAK"
  | "DOUBLE_BILLING_RACE"
  | "CURRENCY_SLIPPAGE"
  | "UNAUTHORIZED_MERCHANT"
  | "STRICT_MODE_ENFORCEMENT"
  | "SAFE_EXECUTION";

export interface AdversarialInput {
  serviceName: string;
  attemptedAmount: number;
  budgetCeiling: number;
  expectedBaselinePrice?: number;
  strictMode?: boolean;
  currency?: string;
  orderId?: string;
  idempotencyKey?: string;
  promptInjectionPayload?: string;
  merchantUrl?: string;
  concurrencyCount?: number;
}

export interface SimulationScenario {
  id: string;
  name: string;
  category: ScenarioCategory;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "INFO";
  description: string;
  adversarialInput: AdversarialInput;
  expectedStatus: "BLOCKED" | "ANOMALY_HOLD" | "APPROVAL_REQUIRED" | "PASSED";
  expectedGuardrail: string;
}

export interface InterceptProof {
  auditLogCreated: boolean;
  telemetryCaptured: boolean;
  zeroDollarsLost: boolean;
}

export interface SimulationRunResult {
  scenarioId: string;
  scenarioName: string;
  category: ScenarioCategory;
  passed: boolean;
  intercepted: boolean;
  actualStatus: string;
  latencyMs: number;
  safetyScore: number; // 0 to 100
  ruleTriggered: string;
  reason: string;
  interceptProof: InterceptProof;
}

export interface HarnessReport {
  totalScenarios: number;
  passedScenarios: number;
  failedScenarios: number;
  compositeSafetyIndex: number; // 0 to 100%
  zeroPhantomChargeGuarantee: boolean;
  averageLatencyMs: number;
  results: SimulationRunResult[];
  executedAt: string;
}
