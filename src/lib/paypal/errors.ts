/**
 * CONFIRMED_DECLINE: PayPal explicitly refused the capture, so no money moved.
 * UNKNOWN_OUTCOME: everything else, including timeouts and server errors. Money may have moved.
 */
export type PayPalFailureKind = "CONFIRMED_DECLINE" | "UNKNOWN_OUTCOME";

export interface PayPalFailureDetails {
  kind: PayPalFailureKind;
  operation: "oauth" | "create" | "capture";
  httpStatus?: number;
  issue?: string;
  debugId?: string;
  requestId?: string;
  orderId?: string;
  captureId?: string;
  captureStatus?: string;
}

/** Carries the provider identifiers that reconciliation needs. */
export class PayPalPaymentError extends Error implements PayPalFailureDetails {
  readonly kind: PayPalFailureKind;
  readonly operation: PayPalFailureDetails["operation"];
  readonly httpStatus?: number;
  readonly issue?: string;
  readonly debugId?: string;
  readonly requestId?: string;
  readonly orderId?: string;
  readonly captureId?: string;
  readonly captureStatus?: string;

  constructor(message: string, details: PayPalFailureDetails) {
    super(message);
    this.name = "PayPalPaymentError";
    this.kind = details.kind;
    this.operation = details.operation;
    this.httpStatus = details.httpStatus;
    this.issue = details.issue;
    this.debugId = details.debugId;
    this.requestId = details.requestId;
    this.orderId = details.orderId;
    this.captureId = details.captureId;
    this.captureStatus = details.captureStatus;
  }
}

/** The configuration is unsafe, or the request cannot be valid. Nothing was sent to PayPal. */
export class PayPalConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PayPalConfigError";
  }
}
