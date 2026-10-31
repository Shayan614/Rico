import { sqliteTable, text, real, integer } from "drizzle-orm/sqlite-core";
import { sql, type InferSelectModel, type InferInsertModel } from "drizzle-orm";

export interface ReceiptData {
  orderId: string;
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
}

// 1. Mandates Table
export const mandates = sqliteTable("mandates", {
  id: text("id").primaryKey(),
  service: text("service").notNull(),
  budgetCeiling: real("budget_ceiling").notNull(),
  lastScrapedPrice: real("last_scraped_price").notNull().default(0),
  recurrence: text("recurrence").notNull(),
  nextRun: text("next_run").notNull(),
  status: text("status", { enum: ["ACTIVE", "PAUSED", "ANOMALY_HOLD"] })
    .notNull()
    .default("ACTIVE"),
  category: text("category").notNull().default("Subscription"),
  currency: text("currency").notNull().default("USD"),
  strictMode: integer("strict_mode", { mode: "boolean" }).notNull().default(false),
  merchantUrl: text("merchant_url"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

// 2. Transactions Table
export const transactions = sqliteTable("transactions", {
  id: text("id").primaryKey(),
  mandateId: text("mandate_id").references(() => mandates.id, { onDelete: "set null" }),
  orderId: text("order_id").notNull(),
  service: text("service").notNull(),
  amount: real("amount").notNull(),
  currency: text("currency").notNull().default("USD"),
  status: text("status", { enum: ["COMPLETED", "PENDING", "BLOCKED"] })
    .notNull()
    .default("PENDING"),
  timestamp: text("timestamp")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  receiptData: text("receipt_data", { mode: "json" }).$type<ReceiptData>(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

// 3. Audit Logs Table
export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  mandateId: text("mandate_id").references(() => mandates.id, { onDelete: "set null" }),
  timestamp: text("timestamp")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  eventType: text("event_type", {
    enum: [
      "PRICE_VERIFIED",
      "GUARDRAIL_BLOCKED",
      "PAYMENT_CAPTURED",
      "MANDATE_CREATED",
      "ANOMALY_DETECTED",
      "MANUAL_APPROVAL_REQUIRED",
    ],
  }).notNull(),
  service: text("service").notNull(),
  details: text("details").notNull(),
  severity: text("severity", {
    enum: ["info", "warning", "success", "danger"],
  })
    .notNull()
    .default("info"),
  metadata: text("metadata", { mode: "json" }).$type<Record<string, unknown>>(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

// TypeScript Types
export type MandateRecord = InferSelectModel<typeof mandates>;
export type NewMandateRecord = InferInsertModel<typeof mandates>;

export type TransactionRecord = InferSelectModel<typeof transactions>;
export type NewTransactionRecord = InferInsertModel<typeof transactions>;

export type AuditLogRecord = InferSelectModel<typeof auditLogs>;
export type NewAuditLogRecord = InferInsertModel<typeof auditLogs>;
