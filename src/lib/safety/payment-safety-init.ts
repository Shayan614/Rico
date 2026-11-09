import type { PaymentDb } from "./payment-reservation.pg";

const REQUIRED_INDEXES = [
  "mandates_owner_id_idx",
  "transactions_idempotency_active_uq",
  "transactions_mandate_pending_uq",
  "transactions_order_completed_uq",
];

let ready: PaymentDb | null = null;

/**
 * Connects the guarded payment path to PostgreSQL after proving its safeguards exist in the
 * database in use. Throws if any is missing. Only success is cached, so a fixed problem recovers.
 */
export async function initPaymentReservationDb(): Promise<PaymentDb> {
  if (ready) return ready;

  if (!process.env.AUTH_SECRET) {
    throw new Error("AUTH_SECRET is required");
  }

  const { pgDb, postgresClient } = await import("@/db/postgres");

  const indexes = await postgresClient<{ indexname: string }[]>`
    SELECT indexname FROM pg_indexes WHERE schemaname = current_schema()`;
  const found = new Set(indexes.map((row) => row.indexname));
  const missing = REQUIRED_INDEXES.filter((name) => !found.has(name));
  if (missing.length > 0) {
    throw new Error(`Missing database indexes: ${missing.join(", ")}`);
  }

  const [owner] = await postgresClient<{ is_nullable: string }[]>`
    SELECT is_nullable FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'mandates' AND column_name = 'owner_id'`;
  if (owner?.is_nullable !== "NO") {
    throw new Error("mandates.owner_id must exist and be required");
  }

  ready = pgDb;
  return ready;
}
