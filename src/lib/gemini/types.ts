export interface ThoughtStep {
  step: string;
  status: "done" | "running" | "waiting";
  detail?: string;
}

export interface ThoughtProcess {
  summary: string;
  steps: ThoughtStep[];
}

export interface MandateToolParams {
  service: string;
  max_amount: number;
  schedule: string;
  currency?: string;
  category?: string;
  strict_mode?: boolean;
}

export interface VerifyPriceToolParams {
  service_url?: string;
  service_name: string;
  expected_price?: number;
}

export interface ExecutePaymentToolParams {
  mandate_id?: string;
  service_name: string;
  verified_price: number;
  budget_ceiling: number;
  recipient_email?: string;
  description?: string;
}

export interface StreamEvent {
  type: "token" | "step" | "thought" | "tool_call" | "receipt" | "done" | "error";
  text?: string;
  step?: ThoughtStep;
  thought?: ThoughtProcess;
  toolCall?: {
    name: string;
    args: Record<string, unknown>;
  };
  receipt?: Record<string, unknown>;
  error?: string;
}

export interface ChatContext {
  strictMode?: boolean;
  activeMandates?: Array<{
    id: string;
    service: string;
    budgetCeiling: number;
    lastScrapedPrice: number;
    recurrence: string;
    status: string;
  }>;
}
