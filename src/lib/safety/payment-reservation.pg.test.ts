/**
 * Isolated PostgreSQL tests for payment-reservation.pg.ts. PayPal is a counting mock.
 *
 *   TEST_DATABASE_URL=postgres://... npm run test:payment-pg
 *
 * Applies the real migrations to a uniquely named schema, which is dropped at the end.
 * The public schema is never read or written.
 */
import assert from "assert";
import { randomUUID } from "crypto";
import { readFileSync } from "fs";
import path from "path";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../db/schema.pg";
import { auditLogs, mandates, transactions, users, type ReceiptData } from "../../db/schema.pg";
import {
  DefinitePaymentFailure,
  alertPaymentKey,
  executeReservedPayment,
  type PaymentDb,
  type ReservedPaymentParams,
} from "./payment-reservation.pg";

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error("TEST_DATABASE_URL is required; refusing to run");
if (process.env.NODE_ENV === "production") throw new Error("Refusing to run with NODE_ENV=production");

function identity(raw: string): string {
  const u = new URL(raw);
  return `${u.username}@${u.hostname}:${u.port}${u.pathname}`;
}
if (process.env.SUPABASE_DATABASE_URL && identity(url) === identity(process.env.SUPABASE_DATABASE_URL)) {
  throw new Error("TEST_DATABASE_URL must not be the development database");
}

let networkAttempts = 0;
globalThis.fetch = (async () => {
  networkAttempts++;
  throw new Error("Network is disabled in payment tests");
}) as typeof fetch;

const testSchema = `rico_pay_test_${randomUUID().replace(/-/g, "")}`;
const POOLS = 4;

const admin = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
const clients = Array.from({ length: POOLS }, () =>
  postgres(url, {
    max: 2,
    prepare: false,
    onnotice: () => {},
    connection: { search_path: testSchema },
  })
);
const dbs: PaymentDb[] = clients.map((client) => drizzle(client, { schema }));
const db = dbs[0];

async function setUpSchema() {
  await admin.unsafe(`CREATE SCHEMA "${testSchema}"`);

  // A transaction-mode pooler can drop search_path, which would point tests at public.
  for (const client of clients) {
    const [{ current }] = await client`SELECT current_schema() AS current`;
    assert.strictEqual(current, testSchema, "search_path not applied; use a direct connection");
  }

  const folder = path.join(process.cwd(), "drizzle", "pg");
  const journal = JSON.parse(readFileSync(path.join(folder, "meta", "_journal.json"), "utf8"));
  for (const { tag } of journal.entries as { tag: string }[]) {
    const statements = readFileSync(path.join(folder, `${tag}.sql`), "utf8").split("--> statement-breakpoint");
    for (const statement of statements) {
      // anon/authenticated exist only on Supabase; REVOKE does not affect these tests.
      if (statement.includes("REVOKE ALL")) continue;
      await clients[0].unsafe(statement.replaceAll(`"public".`, `"${testSchema}".`));
    }
  }

  // Fault injection at the database, so rollback is real rather than mocked.
  await clients[0].unsafe(`
    CREATE FUNCTION fail_write() RETURNS trigger AS $$
    BEGIN RAISE EXCEPTION 'injected failure'; END $$ LANGUAGE plpgsql;
    CREATE TRIGGER fail_tx BEFORE UPDATE ON transactions FOR EACH ROW
      WHEN (NEW.status = 'COMPLETED' AND NEW.service = 'FAIL_TX') EXECUTE FUNCTION fail_write();
    CREATE TRIGGER fail_mandate BEFORE UPDATE ON mandates FOR EACH ROW
      WHEN (NEW.service = 'FAIL_MANDATE') EXECUTE FUNCTION fail_write();
    CREATE TRIGGER fail_audit BEFORE INSERT ON audit_logs FOR EACH ROW
      WHEN (NEW.service = 'FAIL_AUDIT' AND NEW.event_type = 'PAYMENT_CAPTURED') EXECUTE FUNCTION fail_write();
  `);
}

async function seedMandate(service = "Test Service") {
  const id = `mandate-${randomUUID()}`;
  await db.insert(users).values({ id: "owner-1", email: "owner-1@example.test" }).onConflictDoNothing();
  await db.insert(mandates).values({
    id,
    ownerId: "owner-1",
    service,
    budgetCeiling: 50,
    lastScrapedPrice: 1,
    recurrence: "Monthly",
    nextRun: "Dec 1",
    status: "ANOMALY_HOLD",
  });
  return id;
}

/** Counting PayPal stand-in. Delay keeps concurrent attempts overlapping. */
function paypal(options: { fail?: Error; orderId?: string; delayMs?: number } = {}) {
  const mock = {
    charges: 0,
    fn: async () => {
      mock.charges++;
      await new Promise((resolve) => setTimeout(resolve, options.delayMs ?? 0));
      if (options.fail) throw options.fail;
      const orderId = options.orderId ?? `ORDER-${randomUUID()}`;
      return { orderId, captureId: "CAP-1", receipt: { orderId, status: "COMPLETED" } as ReceiptData };
    },
  };
  return mock;
}

function params(over: Partial<ReservedPaymentParams> & { executePayment: ReservedPaymentParams["executePayment"] }): ReservedPaymentParams {
  return {
    idempotencyKey: `key-${randomUUID()}`,
    serviceName: "Test Service",
    amount: 20,
    budgetCeiling: 50,
    ...over,
  };
}

const rowsForKey = (key: string) =>
  db.select().from(transactions).where(eq(transactions.idempotencyKey, key));
const rowsForMandate = (id: string) =>
  db.select().from(transactions).where(eq(transactions.mandateId, id));
const mandateRow = async (id: string) =>
  (await db.select().from(mandates).where(eq(mandates.id, id)))[0];

const tests: [string, () => Promise<void>][] = [
  ["success: own PENDING row is not a duplicate, all writes commit", async () => {
    const mandateId = await seedMandate();
    const pay = paypal();
    const result = await executeReservedPayment(db, params({ mandateId, executePayment: pay.fn, mandateStatusOnCommit: "ACTIVE" }));
    assert.strictEqual(result.status, "COMPLETED");
    assert.strictEqual(pay.charges, 1);
    const [row] = await rowsForMandate(mandateId);
    assert.strictEqual(row.status, "COMPLETED");
    assert.ok(row.orderId.startsWith("ORDER-"));
    const mandate = await mandateRow(mandateId);
    assert.strictEqual(mandate.status, "ACTIVE");
    assert.strictEqual(mandate.lastScrapedPrice, 20);
    const logs = await db.select().from(auditLogs).where(and(eq(auditLogs.mandateId, mandateId), eq(auditLogs.eventType, "PAYMENT_CAPTURED")));
    assert.strictEqual(logs.length, 1);
  }],

  ["duplicate: replay after COMPLETED does not charge", async () => {
    const pay = paypal();
    const key = `key-${randomUUID()}`;
    const first = await executeReservedPayment(db, params({ idempotencyKey: key, executePayment: pay.fn }));
    const second = await executeReservedPayment(dbs[1], params({ idempotencyKey: key, executePayment: pay.fn }));
    assert.strictEqual(first.status, "COMPLETED");
    assert.ok(second.status === "BLOCKED" && second.reason === "DUPLICATE_KEY");
    assert.strictEqual(second.existingTransactionId, first.transactionId);
    assert.strictEqual(pay.charges, 1);
  }],

  ["concurrency: same key across separate pools charges once", async () => {
    const pay = paypal({ delayMs: 100 });
    const key = `key-${randomUUID()}`;
    const results = await Promise.all(
      Array.from({ length: 24 }, (_, i) =>
        executeReservedPayment(dbs[i % POOLS], params({ idempotencyKey: key, executePayment: pay.fn }))
      )
    );
    assert.strictEqual(pay.charges, 1);
    assert.strictEqual(results.filter((r) => r.status === "COMPLETED").length, 1);
    assert.strictEqual(results.filter((r) => r.status === "BLOCKED").length, 23);
    assert.strictEqual((await rowsForKey(key)).length, 1);
  }],

  ["concurrency: different keys on one mandate charge once", async () => {
    const mandateId = await seedMandate();
    const pay = paypal({ delayMs: 100 });
    const results = await Promise.all(
      Array.from({ length: 24 }, (_, i) =>
        executeReservedPayment(dbs[i % POOLS], params({ mandateId, executePayment: pay.fn }))
      )
    );
    assert.strictEqual(pay.charges, 1);
    assert.strictEqual(results.filter((r) => r.status === "COMPLETED").length, 1);
    assert.strictEqual((await rowsForMandate(mandateId)).length, 1);
  }],

  ["concurrency: unrelated mandates do not block each other", async () => {
    const pay = paypal({ delayMs: 50 });
    const ids = await Promise.all(Array.from({ length: 8 }, () => seedMandate()));
    const results = await Promise.all(
      ids.map((mandateId, i) => executeReservedPayment(dbs[i % POOLS], params({ mandateId, executePayment: pay.fn })))
    );
    assert.ok(results.every((r) => r.status === "COMPLETED"));
    assert.strictEqual(pay.charges, 8);
  }],

  ["alert: approve then backup_card charges once, sequential and concurrent", async () => {
    const pay = paypal();
    const key = alertPaymentKey(`alert-${randomUUID()}`);
    const approve = await executeReservedPayment(db, params({ idempotencyKey: key, executePayment: pay.fn }));
    const backup = await executeReservedPayment(db, params({ idempotencyKey: key, executePayment: pay.fn }));
    assert.strictEqual(approve.status, "COMPLETED");
    assert.strictEqual(backup.status, "BLOCKED");
    assert.strictEqual(pay.charges, 1);

    const racing = paypal({ delayMs: 50 });
    const raceKey = alertPaymentKey(`alert-${randomUUID()}`);
    await Promise.all(dbs.map((d) => executeReservedPayment(d, params({ idempotencyKey: raceKey, executePayment: racing.fn }))));
    assert.strictEqual(racing.charges, 1);
  }],

  ["cooldown: blocks a new key without leaving a row; explicit override allows it", async () => {
    const mandateId = await seedMandate();
    const pay = paypal();
    await executeReservedPayment(db, params({ mandateId, executePayment: pay.fn }));
    const blocked = await executeReservedPayment(db, params({ mandateId, executePayment: pay.fn }));
    assert.ok(blocked.status === "BLOCKED" && blocked.reason === "MANDATE_COOLDOWN");
    assert.strictEqual((await rowsForMandate(mandateId)).length, 1);
    const allowed = await executeReservedPayment(db, params({ mandateId, executePayment: pay.fn, allowDuplicateWithinWindow: true }));
    assert.strictEqual(allowed.status, "COMPLETED");
    assert.strictEqual(pay.charges, 2);
  }],

  ["declined: row becomes BLOCKED and the same key can retry", async () => {
    const mandateId = await seedMandate();
    const key = `key-${randomUUID()}`;
    const declined = paypal({ fail: new DefinitePaymentFailure("card declined") });
    const first = await executeReservedPayment(db, params({ idempotencyKey: key, mandateId, executePayment: declined.fn }));
    assert.strictEqual(first.status, "DECLINED");
    assert.strictEqual((await rowsForKey(key))[0].status, "BLOCKED");
    const retry = paypal();
    const second = await executeReservedPayment(db, params({ idempotencyKey: key, mandateId, executePayment: retry.fn }));
    assert.strictEqual(second.status, "COMPLETED");
    assert.strictEqual(retry.charges, 1);
  }],

  ["timeout: outcome UNKNOWN stays PENDING and blocks retries", async () => {
    const mandateId = await seedMandate();
    const key = `key-${randomUUID()}`;
    const timeout = paypal({ fail: new Error("504 Gateway Timeout") });
    const result = await executeReservedPayment(db, params({ idempotencyKey: key, mandateId, executePayment: timeout.fn }));
    assert.ok(result.status === "NEEDS_RECONCILIATION" && result.paymentOutcome === "UNKNOWN");
    assert.ok(!("rolledBack" in result));
    assert.strictEqual((await rowsForKey(key))[0].status, "PENDING");

    const retry = paypal();
    const sameKey = await executeReservedPayment(db, params({ idempotencyKey: key, mandateId, executePayment: retry.fn }));
    const otherKey = await executeReservedPayment(db, params({ mandateId, executePayment: retry.fn }));
    assert.ok(sameKey.status === "BLOCKED" && sameKey.reason === "DUPLICATE_KEY");
    assert.ok(otherKey.status === "BLOCKED" && otherKey.reason === "MANDATE_IN_FLIGHT");
    assert.strictEqual(retry.charges, 0);
  }],

  ...(["FAIL_TX", "FAIL_MANDATE", "FAIL_AUDIT"] as const).map((service): [string, () => Promise<void>] => [
    `failed commit (${service}): writes roll back, capture stays PENDING for reconciliation`,
    async () => {
      const mandateId = await seedMandate(service);
      const key = `key-${randomUUID()}`;
      const pay = paypal({ orderId: `ORDER-${randomUUID()}` });
      const result = await executeReservedPayment(db, params({
        idempotencyKey: key, mandateId, serviceName: service, executePayment: pay.fn, mandateStatusOnCommit: "ACTIVE",
      }));
      assert.ok(result.status === "NEEDS_RECONCILIATION" && result.paymentOutcome === "CAPTURED");
      assert.ok(result.orderId?.startsWith("ORDER-"));
      assert.ok(!("rolledBack" in result));

      const [row] = await rowsForKey(key);
      assert.strictEqual(row.status, "PENDING");
      assert.ok(row.orderId.startsWith("pending:"), "transaction update rolled back");
      assert.ok(row.receiptData, "capture evidence retained");
      const mandate = await mandateRow(mandateId);
      assert.strictEqual(mandate.status, "ANOMALY_HOLD", "mandate update rolled back");
      assert.strictEqual(mandate.lastScrapedPrice, 1, "mandate update rolled back");
      const logs = await db.select().from(auditLogs).where(eq(auditLogs.mandateId, mandateId));
      assert.ok(!logs.some((l) => l.eventType === "PAYMENT_CAPTURED"), "audit insert rolled back");
      assert.ok(logs.some((l) => l.eventType === "MANUAL_APPROVAL_REQUIRED"), "reconciliation logged");

      const retry = paypal();
      await executeReservedPayment(db, params({ idempotencyKey: key, mandateId, serviceName: service, executePayment: retry.fn }));
      assert.strictEqual(retry.charges, 0, "a captured payment must not be charged again");
    },
  ]),

  ["failed commit: duplicate PayPal order id stays PENDING", async () => {
    const orderId = `ORDER-${randomUUID()}`;
    await executeReservedPayment(db, params({ executePayment: paypal({ orderId }).fn }));
    const key = `key-${randomUUID()}`;
    const result = await executeReservedPayment(db, params({ idempotencyKey: key, executePayment: paypal({ orderId }).fn }));
    assert.ok(result.status === "NEEDS_RECONCILIATION" && result.paymentOutcome === "CAPTURED");
    assert.strictEqual((await rowsForKey(key))[0].status, "PENDING");
  }],

  ["validation: missing or blank key rejects with no charge and no row", async () => {
    const pay = paypal();
    const before = (await db.select().from(transactions)).length;
    for (const idempotencyKey of [undefined, "", "   "]) {
      await assert.rejects(
        executeReservedPayment(db, params({ idempotencyKey: idempotencyKey as string, executePayment: pay.fn })),
        /requires a stable idempotencyKey/
      );
    }
    assert.strictEqual(pay.charges, 0);
    assert.strictEqual((await db.select().from(transactions)).length, before);
  }],

  ["budget: over ceiling blocks with no charge and no row", async () => {
    const pay = paypal();
    const key = `key-${randomUUID()}`;
    const result = await executeReservedPayment(db, params({ idempotencyKey: key, amount: 60, executePayment: pay.fn }));
    assert.ok(result.status === "BLOCKED" && result.reason === "BUDGET_EXCEEDED");
    assert.strictEqual(pay.charges, 0);
    assert.strictEqual((await rowsForKey(key)).length, 0);
  }],

  ["reservation failure: unknown mandate rejects before charging", async () => {
    const pay = paypal();
    await assert.rejects(executeReservedPayment(db, params({ mandateId: "does-not-exist", executePayment: pay.fn })));
    assert.strictEqual(pay.charges, 0);
  }],

  ["indexes: legacy rows without keys stay compatible", async () => {
    const legacy = (id: string, status: "COMPLETED" | "BLOCKED") => ({
      id, orderId: `legacy-${id}`, service: "Legacy", amount: 1, status,
    });
    await db.insert(transactions).values([legacy(randomUUID(), "COMPLETED"), legacy(randomUUID(), "COMPLETED")]);
    const orderId = `blocked-${randomUUID()}`;
    await db.insert(transactions).values([
      { ...legacy(randomUUID(), "BLOCKED"), orderId },
      { ...legacy(randomUUID(), "BLOCKED"), orderId },
    ]);
  }],
];

async function main() {
  let failed = 0;
  try {
    await setUpSchema();
    const originalError = console.error;
    for (const [name, test] of tests) {
      try {
        console.error = () => {};
        await test();
        console.log(`PASS  ${name}`);
      } catch (error) {
        failed++;
        console.log(`FAIL  ${name}\n      ${error instanceof Error ? error.message : error}`);
      } finally {
        console.error = originalError;
      }
    }
    assert.strictEqual(networkAttempts, 0, "a test attempted network access");
    console.log(`\n${tests.length - failed}/${tests.length} passed; network attempts: ${networkAttempts}`);
  } finally {
    await Promise.all(clients.map((client) => client.end({ timeout: 5 })));
    await admin.unsafe(`DROP SCHEMA IF EXISTS "${testSchema}" CASCADE`);
    await admin.end({ timeout: 5 });
    console.log("Test schema dropped");
  }
  if (failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error("Payment test run failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
