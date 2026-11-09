export type FundingRail = "PAYPAL" | "VISA" | "MASTERCARD";

export interface PayPalOAuthToken {
  access_token: string;
  token_type: string;
  app_id: string;
  expires_in: number;
  nonce: string;
  scope: string;
  expires_at: number; // Unix timestamp ms
}

export interface PayPalCreateOrderParams {
  amount: number;
  currency?: string;
  serviceName: string;
  mandateId?: string;
  description?: string;
  customId?: string;
  fundingRail?: FundingRail | "AUTO";
  /** Identifies the logical payment and stays the same across retries. */
  paymentAttemptKey?: string;
}

export interface PayPalOrderResponse {
  id: string;
  status: "CREATED" | "SAVED" | "APPROVED" | "VOIDED" | "COMPLETED" | "PAYER_ACTION_REQUIRED";
  intent: "CAPTURE" | "AUTHORIZE";
  purchase_units: Array<{
    reference_id?: string;
    amount: {
      currency_code: string;
      value: string;
    };
    description?: string;
    custom_id?: string;
    payments?: {
      captures?: Array<{
        id: string;
        status: "COMPLETED" | "DECLINED" | "PARTIALLY_REFUNDED" | "PENDING" | "REFUNDED";
        amount: {
          currency_code: string;
          value: string;
        };
        final_capture: boolean;
        seller_protection?: {
          status: string;
        };
        create_time: string;
        update_time: string;
      }>;
    };
  }>;
  create_time?: string;
  links?: Array<{
    href: string;
    rel: string;
    method: string;
  }>;
}

export interface PayPalCaptureResponse {
  id: string; // Capture ID
  orderId: string;
  status: "COMPLETED" | "DECLINED" | "PENDING";
  amount: {
    currency_code: string;
    value: string;
  };
  payer: {
    email_address: string;
    payer_id: string;
  };
  transactionId: string;
  authorizationCode: string;
  create_time: string;
  fundingRail: FundingRail;
  cardLastFour?: string;
  routedGateway?: string;
}

export interface PayPalReceipt {
  orderId: string;
  captureId: string;
  service: string;
  planName: string;
  verifiedPrice: number;
  budgetCeiling: number;
  currency: string;
  paymentMethod: string;
  status: string;
  timestamp: string;
  payerEmail: string;
  sandboxAuthCode: string;
  mode: "LIVE_SANDBOX" | "SIMULATED_SANDBOX";
  fundingRail: FundingRail;
  cardLastFour?: string;
  routedGateway?: string;
  isCascaded?: boolean;
}
