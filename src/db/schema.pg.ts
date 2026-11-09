import {
  pgTable,
  pgEnum,
  text,
  doublePrecision,
  boolean,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { sql, type InferSelectModel, type InferInsertModel } from "drizzle-orm";
// Type-only import: erased at build time, so it does not load the SQLite schema.
import type { ReceiptData } from "./schema";

export type { ReceiptData };

/**
 * First-stage PostgreSQL mirror of ./schema.ts. Its inferred row types are
 * intended to match the SQLite schema, so two deliberate choices apply:
 *
 * - Money is `double precision`, the same 8-byte float as SQLite REAL, so it
 *   still infers as `number`. Pg `real` is only 4 bytes and would lose cents on
 *   large values; `numeric` is exact but returns strings.
 * - Timestamps stay `text`, so they still infer as `string`. Defaults reproduce
 *   SQLite's CURRENT_TIMESTAMP format; a bare Pg CURRENT_TIMESTAMP cast to text
 *   would add microseconds and a session-dependent offset.
 */
const utcTimestampDefault = sql`to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')`;

// Enums
export const mandateStatusEnum = pgEnum("mandate_status", ["ACTIVE", "PAUSED", "ANOMALY_HOLD"]);

export const transactionStatusEnum = pgEnum("transaction_status", [
  "COMPLETED",
  "PENDING",
  "BLOCKED",
]);

export const auditEventTypeEnum = pgEnum("audit_event_type", [
  "PRICE_VERIFIED",
  "GUARDRAIL_BLOCKED",
  "PAYMENT_CAPTURED",
  "MANDATE_CREATED",
  "ANOMALY_DETECTED",
  "MANUAL_APPROVAL_REQUIRED",
  "DOUBLE_BILLING_BLOCKED",
]);

export const auditSeverityEnum = pgEnum("audit_severity", [
  "info",
  "warning",
  "success",
  "danger",
]);

// 0. Users Table
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  fullName: text("full_name"),
  avatarUrl: text("avatar_url"),
  role: text("role").notNull().default("user"),
  createdAt: text("created_at").notNull().default(utcTimestampDefault),
  updatedAt: text("updated_at").notNull().default(utcTimestampDefault),
}).enableRLS();

// 1. Mandates Table
export const mandates = pgTable("mandates", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  service: text("service").notNull(),
  budgetCeiling: doublePrecision("budget_ceiling").notNull(),
  lastScrapedPrice: doublePrecision("last_scraped_price").notNull().default(0),
  recurrence: text("recurrence").notNull(),
  nextRun: text("next_run").notNull(),
  status: mandateStatusEnum("status").notNull().default("ACTIVE"),
  category: text("category").notNull().default("Subscription"),
  currency: text("currency").notNull().default("USD"),
  strictMode: boolean("strict_mode").notNull().default(false),
  merchantUrl: text("merchant_url"),
  createdAt: text("created_at").notNull().default(utcTimestampDefault),
  updatedAt: text("updated_at").notNull().default(utcTimestampDefault),
}, (table) => [index("mandates_owner_id_idx").on(table.ownerId)]).enableRLS();

// 2. Transactions Table
export const transactions = pgTable("transactions", {
  id: text("id").primaryKey(),
  mandateId: text("mandate_id").references(() => mandates.id, { onDelete: "set null" }),
  orderId: text("order_id").notNull(),
  // Nullable and not unique, as in SQLite: the double-billing guard enforces it in code.
  idempotencyKey: text("idempotency_key"),
  service: text("service").notNull(),
  amount: doublePrecision("amount").notNull(),
  currency: text("currency").notNull().default("USD"),
  status: transactionStatusEnum("status").notNull().default("PENDING"),
  timestamp: text("timestamp").notNull().default(utcTimestampDefault),
  receiptData: jsonb("receipt_data").$type<ReceiptData>(),
  createdAt: text("created_at").notNull().default(utcTimestampDefault),
}, (table) => [
  // Payment reservations: a BLOCKED row (definite failure) frees its key for retry.
  uniqueIndex("transactions_idempotency_active_uq")
    .on(table.idempotencyKey)
    .where(sql`"idempotency_key" IS NOT NULL AND "status" IN ('PENDING', 'COMPLETED')`),
  uniqueIndex("transactions_mandate_pending_uq")
    .on(table.mandateId)
    .where(sql`"mandate_id" IS NOT NULL AND "status" = 'PENDING'`),
  uniqueIndex("transactions_order_completed_uq")
    .on(table.orderId)
    .where(sql`"status" = 'COMPLETED'`),
]).enableRLS();

// 3. Audit Logs Table
export const auditLogs = pgTable("audit_logs", {
  id: text("id").primaryKey(),
  mandateId: text("mandate_id").references(() => mandates.id, { onDelete: "set null" }),
  timestamp: text("timestamp").notNull().default(utcTimestampDefault),
  eventType: auditEventTypeEnum("event_type").notNull(),
  service: text("service").notNull(),
  details: text("details").notNull(),
  severity: auditSeverityEnum("severity").notNull().default("info"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: text("created_at").notNull().default(utcTimestampDefault),
}).enableRLS();

// TypeScript Types
export type UserRecord = InferSelectModel<typeof users>;
export type NewUserRecord = InferInsertModel<typeof users>;

export type MandateRecord = InferSelectModel<typeof mandates>;
export type NewMandateRecord = InferInsertModel<typeof mandates>;

export type TransactionRecord = InferSelectModel<typeof transactions>;
export type NewTransactionRecord = InferInsertModel<typeof transactions>;

export type AuditLogRecord = InferSelectModel<typeof auditLogs>;
export type NewAuditLogRecord = InferInsertModel<typeof auditLogs>;
