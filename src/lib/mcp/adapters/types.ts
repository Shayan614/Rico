export type AdapterName = "slack" | "github" | "notion" | "stripe";

export type AdapterStatus = "CONFIGURED_LIVE" | "SIMULATED_SANDBOX" | "ERROR";

export interface AdapterHealth {
  name: AdapterName;
  displayName: string;
  status: AdapterStatus;
  toolsCount: number;
  tools: string[];
  latencyMs: number;
  lastCheckedAt: string;
}

// Slack Types
export interface SlackAlertPayload {
  channel?: string;
  title: string;
  message: string;
  severity?: "info" | "warning" | "danger" | "success";
  serviceName?: string;
  amount?: number;
  budgetCeiling?: number;
  actionButtons?: Array<{
    id: string;
    label: string;
    style?: "primary" | "danger" | "default";
    action: string;
  }>;
}

export interface SlackDispatchResult {
  success: boolean;
  channel: string;
  timestamp: string;
  deliveryMode: "LIVE_WEBHOOK" | "SIMULATED_SANDBOX";
  messageId: string;
}

// GitHub Types
export interface GitHubIssuePayload {
  owner?: string;
  repo?: string;
  title: string;
  body: string;
  labels?: string[];
  assignees?: string[];
}

export interface GitHubIssueResult {
  success: boolean;
  issueNumber: number;
  issueUrl: string;
  state: "OPEN" | "CLOSED";
  labels: string[];
  deliveryMode: "LIVE_API" | "SIMULATED_SANDBOX";
}

// Notion Types
export interface NotionExpensePayload {
  databaseId?: string;
  service: string;
  amount: number;
  currency?: string;
  date?: string;
  category: string;
  taxDeductible: boolean;
  notes?: string;
}

export interface NotionSyncResult {
  success: boolean;
  pageId: string;
  pageUrl: string;
  syncedProperties: Record<string, unknown>;
  deliveryMode: "LIVE_API" | "SIMULATED_SANDBOX";
}

// Stripe Types
export interface StripeChargePayload {
  amount: number;
  currency?: string;
  serviceName: string;
  customerId?: string;
  budgetCeiling?: number;
  paymentMethodId?: string;
  idempotencyKey?: string;
}

export interface StripeChargeResult {
  success: boolean;
  paymentIntentId: string;
  amount: number;
  currency: string;
  status: "succeeded" | "requires_action" | "blocked";
  receiptUrl?: string;
  cardBrand?: string;
  last4?: string;
  deliveryMode: "LIVE_API" | "SIMULATED_SANDBOX";
  guardrailBlocked?: boolean;
  guardrailReason?: string;
}
