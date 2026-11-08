export type InvoiceSourceType =
  | "IMAGE_BASE64"
  | "IMAGE_URL"
  | "TEXT_SNIPPET"
  | "PDF_SIMULATION";

export type ExpenseCategory =
  | "SAAS_SUBSCRIPTION"
  | "CLOUD_INFRASTRUCTURE"
  | "OFFICE_EQUIPMENT"
  | "TRAVEL_TRANSPORT"
  | "MEALS_ENTERTAINMENT"
  | "PROFESSIONAL_SERVICES"
  | "MARKETING_ADVERTISING"
  | "UTILITIES_COMMUNICATION"
  | "OTHER";

export interface TaxDeductionInfo {
  isDeductible: boolean;
  deductionPercentage: number;
  deductibleAmount: number;
  taxSchedule: string;
  taxCode: string;
  guidelines: string;
}

export interface ParsedLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  category: ExpenseCategory;
  taxDeduction: TaxDeductionInfo;
}

export interface MatchedMandateInfo {
  mandateId: string;
  service: string;
  budgetCeiling: number;
  exceedsCeiling: boolean;
  discrepancyUsd: number;
  status: "WITHIN_BUDGET" | "EXCEEDS_BUDGET" | "ANOMALY_HOLD";
}

export interface TaxSummary {
  totalDeductibleAmount: number;
  effectiveDeductionPercent: number;
  primaryTaxSchedule: string;
}

export interface ParsedInvoice {
  id: string;
  invoiceNumber: string;
  vendor: {
    name: string;
    domain?: string;
    taxId?: string;
    address?: string;
  };
  date: string;
  dueDate?: string;
  currency: string;
  subtotal: number;
  taxAmount: number;
  tipAmount: number;
  totalAmount: number;
  lineItems: ParsedLineItem[];
  paymentDetails?: {
    method?: "PAYPAL" | "CREDIT_CARD" | "BANK_TRANSFER" | "UNKNOWN";
    cardLast4?: string;
    paypalTransactionId?: string;
    status?: "PAID" | "UNPAID" | "PENDING";
  };
  matchedMandate?: MatchedMandateInfo;
  taxSummary: TaxSummary;
  confidenceScore: number;
  anomalies: string[];
  rawOcrText?: string;
  sourceType: InvoiceSourceType;
  parsedAt: string;
}

export interface InvoiceParseInput {
  id?: string;
  content: string;
  sourceType?: InvoiceSourceType;
  vendorHint?: string;
  currencyHint?: string;
  filename?: string;
}

export interface BatchInvoiceSummary {
  totalInvoices: number;
  totalAmountUsd: number;
  totalTaxDeductibleUsd: number;
  mandateMatchesCount: number;
  anomaliesDetectedCount: number;
  invoices: ParsedInvoice[];
  categoryBreakdown: Record<ExpenseCategory, number>;
}
