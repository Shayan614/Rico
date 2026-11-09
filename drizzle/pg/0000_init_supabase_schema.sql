CREATE TYPE "public"."audit_event_type" AS ENUM('PRICE_VERIFIED', 'GUARDRAIL_BLOCKED', 'PAYMENT_CAPTURED', 'MANDATE_CREATED', 'ANOMALY_DETECTED', 'MANUAL_APPROVAL_REQUIRED', 'DOUBLE_BILLING_BLOCKED');--> statement-breakpoint
CREATE TYPE "public"."audit_severity" AS ENUM('info', 'warning', 'success', 'danger');--> statement-breakpoint
CREATE TYPE "public"."mandate_status" AS ENUM('ACTIVE', 'PAUSED', 'ANOMALY_HOLD');--> statement-breakpoint
CREATE TYPE "public"."transaction_status" AS ENUM('COMPLETED', 'PENDING', 'BLOCKED');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"mandate_id" text,
	"timestamp" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL,
	"event_type" "audit_event_type" NOT NULL,
	"service" text NOT NULL,
	"details" text NOT NULL,
	"severity" "audit_severity" DEFAULT 'info' NOT NULL,
	"metadata" jsonb,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "mandates" (
	"id" text PRIMARY KEY NOT NULL,
	"service" text NOT NULL,
	"budget_ceiling" double precision NOT NULL,
	"last_scraped_price" double precision DEFAULT 0 NOT NULL,
	"recurrence" text NOT NULL,
	"next_run" text NOT NULL,
	"status" "mandate_status" DEFAULT 'ACTIVE' NOT NULL,
	"category" text DEFAULT 'Subscription' NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"strict_mode" boolean DEFAULT false NOT NULL,
	"merchant_url" text,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL,
	"updated_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mandates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"mandate_id" text,
	"order_id" text NOT NULL,
	"idempotency_key" text,
	"service" text NOT NULL,
	"amount" double precision NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"status" "transaction_status" DEFAULT 'PENDING' NOT NULL,
	"timestamp" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL,
	"receipt_data" jsonb,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transactions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"full_name" text,
	"avatar_url" text,
	"role" text DEFAULT 'user' NOT NULL,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL,
	"updated_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_mandate_id_mandates_id_fk" FOREIGN KEY ("mandate_id") REFERENCES "public"."mandates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_mandate_id_mandates_id_fk" FOREIGN KEY ("mandate_id") REFERENCES "public"."mandates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Hand-added: drizzle-kit cannot express REVOKE. Re-apply if this migration is regenerated.
REVOKE ALL ON TABLE "public"."users", "public"."mandates", "public"."transactions", "public"."audit_logs" FROM anon, authenticated;
