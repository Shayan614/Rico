/**
 * End-to-end tests of the guarded payment paths against an isolated PostgreSQL schema
 * and a temporary SQLite file. PayPal is mocked at HTTP level; every other request fails.
 *
 *   TEST_DATABASE_URL=postgres://... npm run test:payment-paths
 */
import assert from "assert";
import { randomUUID } from "crypto";
import { mkdtempSync, readFileSync, rmSync } from "fs";
import os from "os";
import path from "path";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../db/schema.pg";
import { auditLogs, mandates, transactions, users } from "../../db/schema.pg";

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error("TEST_DATABASE_URL is required; refusing to run");
if (process.env.NODE_ENV === "production") throw new Error("Refusing to run with NODE_ENV=production");
const identity = (raw: string) => {
  const u = new URL(raw);
  return `${u.username}@${u.hostname}:${u.port}${u.pathname}`;
};
if (process.env.SUPABASE_DATABASE_URL && identity(url) === identity(process.env.SUPABASE_DATABASE_URL)) {
  throw new Error("TEST_DATABASE_URL must not be the development database");
}

// Fixed before any app module loads.
const tempDir = mkdtempSync(path.join(os.tmpdir(), "rico-pay-"));
const sqlitePath = path.join(tempDir, "test.db");
Object.assign(process.env, {
  DATABASE_URL: sqlitePath,
  PAYPAL_MODE: "real",
  PAYPAL_REAL_PAYMENTS_APPROVED: "true",
  PAYPAL_ENVIRONMENT: "sandbox",
  PAYPAL_CLIENT_ID: "fake-client-id-123456",
  PAYPAL_CLIENT_SECRET: "fake-client-secret-123456",
  PAYPAL_TIMEOUT_MS: "50",
  AUTH_SECRET: "test-only-secret",
  TELEGRAM_WEBHOOK_SECRET: "test-telegram-secret",
  TELEGRAM_CHAT_ID: "12345",
  TELEGRAM_OWNER_ID: "u1",
  POSTHOG_API_KEY: "",
  NEXT_PUBLIC_POSTHOG_KEY: "",
});
delete process.env.TELEGRAM_BOT_TOKEN;

const sqlite = new Database(sqlitePath);
sqlite.exec(`
  CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT NOT NULL, full_name TEXT, avatar_url TEXT, role TEXT NOT NULL DEFAULT 'user',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE mandates (id TEXT PRIMARY KEY, owner_id TEXT, service TEXT NOT NULL, budget_ceiling REAL NOT NULL, last_scraped_price REAL NOT NULL DEFAULT 0,
    recurrence TEXT NOT NULL, next_run TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'ACTIVE', category TEXT NOT NULL DEFAULT 'Subscription',
    currency TEXT NOT NULL DEFAULT 'USD', strict_mode INTEGER NOT NULL DEFAULT 0, merchant_url TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE audit_logs (id TEXT PRIMARY KEY, mandate_id TEXT, timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, event_type TEXT NOT NULL,
    service TEXT NOT NULL, details TEXT NOT NULL, severity TEXT NOT NULL DEFAULT 'info', metadata TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
`);

const testSchema = `rico_paths_test_${randomUUID().replace(/-/g, "")}`;
const admin = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
const client = postgres(url, { max: 8, prepare: false, onnotice: () => {}, connection: { search_path: testSchema } });
const pg = drizzle(client, { schema });

async function setUpSchema() {
  await admin.unsafe(`CREATE SCHEMA "${testSchema}"`);
  const [{ current }] = await client`SELECT current_schema() AS current`;
  assert.strictEqual(current, testSchema, "search_path not applied; use a direct connection");
  const folder = path.join(process.cwd(), "drizzle", "pg");
  const journal = JSON.parse(readFileSync(path.join(folder, "meta", "_journal.json"), "utf8"));
  for (const { tag } of journal.entries as { tag: string }[]) {
    for (const statement of readFileSync(path.join(folder, `${tag}.sql`), "utf8").split("--> statement-breakpoint")) {
      if (statement.includes("REVOKE ALL")) continue;
      await client.unsafe(statement.replaceAll(`"public".`, `"${testSchema}".`));
    }
  }
  await client.unsafe(`
    CREATE FUNCTION fail_write() RETURNS trigger AS $$
    BEGIN RAISE EXCEPTION 'injected failure'; END $$ LANGUAGE plpgsql;
    CREATE TRIGGER fail_audit BEFORE INSERT ON audit_logs FOR EACH ROW
      WHEN (NEW.service = 'FAIL_AUDIT' AND NEW.event_type = 'PAYMENT_CAPTURED') EXECUTE FUNCTION fail_write();
  `);
}

// ---- PayPal HTTP mock. Same request ID returns the same order, as PayPal documents.
type Behaviour = { token?: () => Response; create?: () => Response; capture?: (signal?: AbortSignal) => Promise<Response> | Response };
let behaviour: Behaviour = {};
let captureRequests = 0;
let createRequests = 0;
let otherRequests = 0;
const orders = new Map<string, { id: string; value: string }>();
const orderById = new Map<string, { id: string; value: string }>();

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const issue = (status: number, name: string) => json(status, { debug_id: "dbg", details: [{ issue: name }] });
const hang = (signal?: AbortSignal) =>
  new Promise<Response>((_resolve, reject) => signal?.addEventListener("abort", () => reject(signal.reason)));

globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
  const target = String(input);
  const signal = init?.signal ?? undefined;
  if (target.endsWith("/v1/oauth2/token")) {
    return behaviour.token ? behaviour.token() : json(200, { access_token: "fake", expires_in: 3600 });
  }
  if (target.endsWith("/v2/checkout/orders")) {
    createRequests++;
    if (behaviour.create) return behaviour.create();
    const requestId = new Headers(init?.headers).get("paypal-request-id")!;
    const value = JSON.parse(String(init?.body)).purchase_units[0].amount.value;
    const order = orders.get(requestId) ?? { id: `PP-${randomUUID()}`, value };
    orders.set(requestId, order);
    orderById.set(order.id, order);
    return json(201, { id: order.id, status: "CREATED", intent: "CAPTURE", purchase_units: [] });
  }
  if (target.endsWith("/capture")) {
    captureRequests++;
    if (behaviour.capture) return behaviour.capture(signal);
    const id = target.split("/").at(-2)!;
    return json(201, {
      id,
      status: "COMPLETED",
      purchase_units: [{ payments: { captures: [{ id: `CAP-${id}`, status: "COMPLETED", amount: { currency_code: "USD", value: orderById.get(id)!.value } }] } }],
    });
  }
  otherRequests++;
  throw new Error(`Blocked request: ${target}`);
}) as typeof fetch;

async function seed(over: Partial<typeof mandates.$inferInsert> = {}) {
  const row = {
    id: `mandate-${randomUUID()}`,
    ownerId: "u1",
    service: "Test Service",
    budgetCeiling: 50,
    lastScrapedPrice: 40,
    recurrence: "Monthly",
    nextRun: "Dec 1",
    status: "ANOMALY_HOLD" as const,
    ...over,
  };
  await pg.insert(mandates).values(row);
  sqlite
    .prepare(`INSERT INTO mandates (id, owner_id, service, budget_ceiling, last_scraped_price, recurrence, next_run, status) VALUES (?,?,?,?,?,?,?,?)`)
    .run(row.id, row.ownerId, row.service, row.budgetCeiling, row.lastScrapedPrice, row.recurrence, row.nextRun, row.status);
  return row;
}

const rows = (mandateId: string) => pg.select().from(transactions).where(eq(transactions.mandateId, mandateId));
const reset = (next: Behaviour = {}) => {
  behaviour = next;
  captureRequests = 0;
  createRequests = 0;
};

(async () => {
  await setUpSchema();
  await pg.insert(users).values({ id: "u1", email: "u1@example.test" });
  const { configurePaymentReservationDb, executeAtomicPaymentTransaction } = await import("./atomic-transaction");
  const { handleRemoteAction } = await import("../sentinel/callback-handler");
  const { omnichannelAlertStore, omnichannelDispatcher } = await import("../sentinel/omnichannel");
  const { executePayPalPayment } = await import("../gemini/tool-executors");
  const { quoteMandatePayment, executeConfirmedMandatePayment } = await import("../payments/mandate-execution");
  const quoteRoute = await import("../../app/api/payments/quote/route");
  const executeRoute = await import("../../app/api/payments/execute/route");
  const { personaSavingsOptimizer } = await import("../savings/savings-engine");
  const { priceWorker } = await import("../browser");
  const { createUserSession, getJudgeDemoSession, serializeSessionToken, SESSION_COOKIE_NAME } = await import("../auth/session-bridge");
  const webhook = await import("../../app/api/sentinel/webhook/route");
  const savingsRoute = await import("../../app/api/savings/apply/route");
  const chatRoute = await import("../../app/api/chat/route");
  const txRoute = await import("../../app/api/transactions/route");
  const ordersRoute = await import("../../app/api/paypal/orders/route");

  let scrapedPrice = 40;
  (priceWorker as unknown as { scrapeMerchantPrice: unknown }).scrapeMerchantPrice = async () => ({
    price: scrapedPrice, currency: "USD", planName: "Plan", service: "Test Service", source: "live_browser", confidence: 1,
  });

  async function alertFor(mandateId: string, newPrice = 40) {
    const id = `alert-${randomUUID()}`;
    await omnichannelDispatcher.dispatchAlert({
      id, mandateId, service: "Test Service", oldPrice: 30, newPrice, jumpPercent: 33, budgetCeiling: 50,
      currency: "USD", channel: "telegram", status: "PENDING", timestamp: new Date().toISOString(),
    });
    assert.ok(omnichannelAlertStore.getAlert(id));
    return id;
  }

  const realUser = { id: "u1", email: "u1@example.test", fullName: "U", role: "user" as const };
  const cookieFor = (token: string) => `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`;
  const userCookie = cookieFor(serializeSessionToken(createUserSession(realUser, false)));
  const post = (headers: Record<string, string>, body: unknown) =>
    new Request("http://test.local/api", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });

  const tests: Array<[string, () => Promise<void>]> = [
    ["SQLite stays active by default and refuses real PayPal with no HTTP", async () => {
      reset();
      const m = await seed();
      const result = await handleRemoteAction({ ownerId: "u1", action: "approve", mandateId: m.id, alertId: await alertFor(m.id) });
      assert.strictEqual(result.success, false);
      assert.match(result.message, /disabled until/);
      assert.strictEqual(createRequests + captureRequests, 0);
      assert.strictEqual((await rows(m.id)).length, 0);
    }],
    ["(reservation database injected for all following tests)", async () => {
      configurePaymentReservationDb(pg);
    }],
    ["approve charges once, keeps identifiers and audit details, restores ACTIVE", async () => {
      reset();
      const m = await seed();
      const alertId = await alertFor(m.id);
      const result = await handleRemoteAction({ ownerId: "u1", action: "approve", mandateId: m.id, alertId });
      assert.strictEqual(result.success, true);
      assert.ok(result.captureId?.startsWith("CAP-PP-"));
      const [tx] = await rows(m.id);
      assert.strictEqual(tx.status, "COMPLETED");
      assert.strictEqual(tx.orderId, result.orderId);
      assert.match(String(tx.idempotencyKey), new RegExp(`^period:${m.id}:\\d{4}-\\d{2}$`));
      const [stored] = await pg.select().from(mandates).where(eq(mandates.id, m.id));
      assert.strictEqual(stored.status, "ACTIVE");
      const [log] = await pg.select().from(auditLogs).where(eq(auditLogs.mandateId, m.id));
      assert.match(log.details, /Remote Payment Approved/);
      assert.strictEqual(log.metadata?.source, "omnichannel_remote_callback");
      assert.strictEqual(log.metadata?.captureId, result.captureId);
      assert.strictEqual(omnichannelAlertStore.getAlert(alertId)?.status === "PENDING", false);
    }],
    ["approve and backup_card racing on one alert make one capture", async () => {
      reset();
      const m = await seed();
      const alertId = await alertFor(m.id);
      const results = await Promise.all(
        Array.from({ length: 12 }, (_, i) =>
          handleRemoteAction({ ownerId: "u1", action: i % 2 ? "backup_card" : "approve", mandateId: m.id, alertId })
        )
      );
      assert.strictEqual(results.filter((r) => r.success).length, 1);
      assert.strictEqual(captureRequests, 1);
      assert.strictEqual((await rows(m.id)).length, 1);
    }],
    ["callback replay after success charges nothing, even if the alert is forgotten", async () => {
      reset();
      const m = await seed();
      const alertId = await alertFor(m.id);
      await handleRemoteAction({ ownerId: "u1", action: "approve", mandateId: m.id, alertId });
      const replay = await handleRemoteAction({ ownerId: "u1", action: "backup_card", mandateId: m.id, alertId });
      assert.strictEqual(replay.success, false);
      const unknownAlert = await handleRemoteAction({ ownerId: "u1", action: "approve", mandateId: m.id, alertId: "alert-unknown" });
      assert.strictEqual(unknownAlert.success, false);
      assert.strictEqual(captureRequests, 1);
    }],
    ["a hold approved without an alert shares one key and cannot be replayed", async () => {
      reset();
      const m = await seed();
      const results = await Promise.all([
        handleRemoteAction({ ownerId: "u1", action: "approve", mandateId: m.id }),
        handleRemoteAction({ ownerId: "u1", action: "backup_card", mandateId: m.id }),
      ]);
      assert.strictEqual(results.filter((r) => r.success).length, 1);
      assert.strictEqual(captureRequests, 1);
    }],
    ["price above the real ceiling is blocked, with no Math.max bypass", async () => {
      reset();
      const m = await seed();
      const result = await handleRemoteAction({ ownerId: "u1", action: "approve", mandateId: m.id, alertId: await alertFor(m.id, 54.99) });
      assert.strictEqual(result.success, false);
      assert.match(result.message, /exceeds budget ceiling/);
      assert.strictEqual(createRequests, 0);
      assert.strictEqual((await rows(m.id)).length, 0);
    }],
    ["the ceiling in PostgreSQL wins over a stale caller value", async () => {
      reset();
      const m = await seed();
      await pg.update(mandates).set({ budgetCeiling: 10 }).where(eq(mandates.id, m.id));
      const result = await handleRemoteAction({ ownerId: "u1", action: "approve", mandateId: m.id, alertId: await alertFor(m.id) });
      assert.strictEqual(result.success, false);
      assert.strictEqual(createRequests, 0);
    }],
    ["paused mandates cannot pay, including when only the database knows", async () => {
      reset();
      const paused = await seed({ status: "PAUSED" });
      assert.strictEqual((await handleRemoteAction({ ownerId: "u1", action: "approve", mandateId: paused.id })).success, false);
      const racing = await seed();
      const alertId = await alertFor(racing.id);
      await pg.update(mandates).set({ status: "PAUSED" }).where(eq(mandates.id, racing.id));
      const result = await handleRemoteAction({ ownerId: "u1", action: "approve", mandateId: racing.id, alertId });
      assert.match(result.message, /not eligible/);
      assert.strictEqual(createRequests, 0);
    }],
    ["the PostgreSQL reservation refuses another user, even if SQLite says otherwise", async () => {
      reset();
      await pg.insert(users).values({ id: "u2", email: "u2@example.test" }).onConflictDoNothing();
      const m = await seed();
      // Simulates data drift: only the reservation transaction knows the real owner.
      await pg.update(mandates).set({ ownerId: "u2" }).where(eq(mandates.id, m.id));
      const result = await handleRemoteAction({ ownerId: "u1", action: "approve", mandateId: m.id, alertId: await alertFor(m.id) });
      assert.strictEqual(result.success, false);
      assert.match(result.message, /was not found/);
      assert.strictEqual(createRequests, 0);
      assert.strictEqual((await rows(m.id)).length, 0);
      await assert.rejects(executeAtomicPaymentTransaction({
        mandateId: m.id, orderId: "tmp", idempotencyKey: "no-owner", serviceName: "x", amount: 1, budgetCeiling: 50,
        executePaymentFn: async () => { throw new Error("must not charge"); },
      }), /verified owner/);
    }],
    ["an alert for another mandate is refused", async () => {
      reset();
      const a = await seed();
      const b = await seed();
      const result = await handleRemoteAction({ ownerId: "u1", action: "approve", mandateId: b.id, alertId: await alertFor(a.id) });
      assert.strictEqual(result.success, false);
      assert.strictEqual(createRequests, 0);
    }],
    ["confirmed decline releases the reservation and the same alert can retry", async () => {
      reset({ capture: () => issue(422, "INSTRUMENT_DECLINED") });
      const m = await seed();
      const alertId = await alertFor(m.id);
      const declined = await handleRemoteAction({ ownerId: "u1", action: "approve", mandateId: m.id, alertId });
      assert.strictEqual(declined.success, false);
      assert.strictEqual((await rows(m.id))[0].status, "BLOCKED");
      reset();
      const retry = await handleRemoteAction({ ownerId: "u1", action: "backup_card", mandateId: m.id, alertId });
      assert.strictEqual(retry.success, true);
      assert.strictEqual((await rows(m.id)).filter((r) => r.status === "COMPLETED").length, 1);
    }],
    ["capture timeout stays PENDING and blocks every retry", async () => {
      reset({ capture: (signal) => hang(signal) });
      const m = await seed();
      const alertId = await alertFor(m.id);
      const result = await handleRemoteAction({ ownerId: "u1", action: "approve", mandateId: m.id, alertId });
      assert.strictEqual(result.success, false);
      assert.match(result.message, /needs reconciliation \(outcome: UNKNOWN\)/);
      assert.strictEqual((await rows(m.id))[0].status, "PENDING");
      const retry = await handleRemoteAction({ ownerId: "u1", action: "backup_card", mandateId: m.id, alertId });
      assert.strictEqual(retry.success, false);
      const otherAlert = await handleRemoteAction({ ownerId: "u1", action: "approve", mandateId: m.id, alertId: await alertFor(m.id) });
      assert.strictEqual(otherAlert.success, false);
      assert.strictEqual(captureRequests, 1);
    }],
    ["capture 5xx and non-decline 4xx stay PENDING", async () => {
      for (const reply of [() => issue(500, "INTERNAL_SERVER_ERROR"), () => issue(422, "ORDER_NOT_APPROVED"), () => issue(422, "ORDER_ALREADY_CAPTURED")]) {
        reset({ capture: reply });
        const m = await seed();
        await handleRemoteAction({ ownerId: "u1", action: "approve", mandateId: m.id, alertId: await alertFor(m.id) });
        assert.strictEqual((await rows(m.id))[0].status, "PENDING");
      }
    }],
    ["failure before any capture request releases the reservation", async () => {
      for (const failing of [{ create: () => issue(500, "INTERNAL_SERVER_ERROR") }, { token: () => json(401, {}) }] as Behaviour[]) {
        reset(failing);
        const { payPalOAuth } = await import("../paypal");
        payPalOAuth.clearCache();
        const m = await seed();
        await handleRemoteAction({ ownerId: "u1", action: "approve", mandateId: m.id, alertId: await alertFor(m.id) });
        assert.strictEqual((await rows(m.id))[0].status, "BLOCKED");
        assert.strictEqual(captureRequests, 0);
        reset();
        payPalOAuth.clearCache();
      }
    }],
    ["captured payment with a failed commit stays PENDING and claims no rollback", async () => {
      reset();
      const m = await seed({ service: "FAIL_AUDIT" });
      const result = await executeAtomicPaymentTransaction({
        mandateId: m.id, ownerId: "u1", allowedMandateStatuses: ["ANOMALY_HOLD"], orderId: "tmp", idempotencyKey: `commit-${m.id}`, serviceName: "FAIL_AUDIT", amount: 40, budgetCeiling: 50,
        executePaymentFn: async () => ({ orderId: "PP-COMMIT", captureId: "CAP-COMMIT", receipt: { orderId: "PP-COMMIT" } }),
      });
      assert.strictEqual(result.status, "NEEDS_RECONCILIATION");
      assert.strictEqual(result.paymentOutcome, "CAPTURED");
      assert.strictEqual(result.rolledBack, false);
      assert.strictEqual((await rows(m.id))[0].status, "PENDING");
    }],
    ["the agent tool only prepares a quote and never charges", async () => {
      reset();
      scrapedPrice = 40;
      const m = await seed({ status: "ACTIVE" });
      const result = await executePayPalPayment({ service_name: "x", verified_price: 1, budget_ceiling: 9999, recipient_email: "a@b.test", mandate_id: m.id }, "u1");
      assert.strictEqual(result.requiresConfirmation, true);
      assert.strictEqual(result.quote.amount, 40, "server price, not the model's");
      assert.strictEqual(result.quote.budgetCeiling, 50, "stored ceiling, not the model's");
      await assert.rejects(executePayPalPayment({ service_name: "x", verified_price: 40, budget_ceiling: 9999, recipient_email: "a@b.test" }, "u1"), /not found/);
      assert.strictEqual(createRequests + captureRequests, 0);
      assert.strictEqual((await rows(m.id)).length, 0);
    }],
    ["a confirmed run charges an owned mandate once; repeats report the billing period", async () => {
      reset();
      scrapedPrice = 40;
      const m = await seed({ status: "ACTIVE", recurrence: "Monthly on 5th" });
      const quote = await quoteMandatePayment(m.id, "u1");
      assert.ok(quote.ok);
      assert.strictEqual(createRequests, 0, "quoting charges nothing");
      const paid = await executeConfirmedMandatePayment(quote.quote.confirmToken, "u1");
      assert.ok(paid.ok, JSON.stringify(paid));
      const again = await executeConfirmedMandatePayment(quote.quote.confirmToken, "u1");
      assert.strictEqual(again.ok, false);
      assert.strictEqual(again.ok === false && again.status, "ALREADY_PAID");
      assert.match(again.message, /already paid for this billing period/);
      const requote = await quoteMandatePayment(m.id, "u1");
      assert.strictEqual(requote.ok === false && requote.code, "ALREADY_PAID");
      const recorded = await rows(m.id);
      assert.strictEqual(recorded.length, 1, "recorded exactly once");
      assert.strictEqual(recorded[0].status, "COMPLETED");
      assert.match(String(recorded[0].idempotencyKey), new RegExp(`^period:${m.id}:\\d{4}-\\d{2}$`));
      assert.strictEqual(captureRequests, 1);
    }],
    ["racing confirmations for one period charge once", async () => {
      reset();
      scrapedPrice = 40;
      const m = await seed({ status: "ACTIVE" });
      const quotes = await Promise.all([quoteMandatePayment(m.id, "u1"), quoteMandatePayment(m.id, "u1")]);
      const tokens = quotes.map((q) => (q.ok ? q.quote.confirmToken : ""));
      const results = await Promise.all(Array.from({ length: 10 }, (_, i) => executeConfirmedMandatePayment(tokens[i % 2], "u1")));
      assert.strictEqual(results.filter((r) => r.ok).length, 1);
      for (const r of results.filter((x) => !x.ok)) {
        assert.ok(["ALREADY_PAID", "IN_PROGRESS", "BLOCKED"].includes(r.ok === false ? r.status : ""), JSON.stringify(r));
      }
      assert.strictEqual(captureRequests, 1);
      assert.strictEqual((await rows(m.id)).length, 1);
    }],
    ["another user cannot quote or execute someone else's mandate; forged or expired confirmations fail", async () => {
      reset();
      scrapedPrice = 40;
      await pg.insert(users).values({ id: "u2", email: "u2@example.test" }).onConflictDoNothing();
      const m = await seed({ status: "ACTIVE" });
      assert.strictEqual((await quoteMandatePayment(m.id, "u2")).ok, false);
      const quote = await quoteMandatePayment(m.id, "u1");
      assert.ok(quote.ok);
      const asOther = await executeConfirmedMandatePayment(quote.quote.confirmToken, "u2");
      assert.strictEqual(asOther.ok === false && asOther.status, "INVALID_CONFIRMATION");
      const [body, mac] = quote.quote.confirmToken.split(".");
      const tampered = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, "base64url").toString()), a: 1 })).toString("base64url");
      assert.strictEqual((await executeConfirmedMandatePayment(`${tampered}.${mac}`, "u1")).ok, false);
      assert.strictEqual((await executeConfirmedMandatePayment("not-a-token", "u1")).ok, false);
      assert.strictEqual((await executeConfirmedMandatePayment(undefined, "u1")).ok, false);
      const realNow = Date.now;
      Date.now = () => realNow() + 10 * 60 * 1000;
      try {
        const late = await executeConfirmedMandatePayment(quote.quote.confirmToken, "u1");
        assert.strictEqual(late.ok === false && late.status, "CONFIRMATION_EXPIRED");
      } finally {
        Date.now = realNow;
      }
      assert.strictEqual(createRequests + captureRequests, 0);
      assert.strictEqual((await rows(m.id)).length, 0);
    }],
    ["a price change, lowered ceiling or paused mandate after confirmation charges nothing", async () => {
      reset();
      scrapedPrice = 40;
      const m = await seed({ status: "ACTIVE" });
      const quote = await quoteMandatePayment(m.id, "u1");
      assert.ok(quote.ok);
      scrapedPrice = 45;
      const changed = await executeConfirmedMandatePayment(quote.quote.confirmToken, "u1");
      assert.strictEqual(changed.ok === false && changed.status, "PRICE_CHANGED");
      scrapedPrice = 40;
      await pg.update(mandates).set({ budgetCeiling: 30 }).where(eq(mandates.id, m.id));
      assert.strictEqual((await executeConfirmedMandatePayment(quote.quote.confirmToken, "u1")).ok, false);
      await pg.update(mandates).set({ budgetCeiling: 50, status: "PAUSED" }).where(eq(mandates.id, m.id));
      assert.strictEqual((await executeConfirmedMandatePayment(quote.quote.confirmToken, "u1")).ok, false);
      scrapedPrice = 60;
      await pg.update(mandates).set({ status: "ACTIVE" }).where(eq(mandates.id, m.id));
      const over = await quoteMandatePayment(m.id, "u1");
      assert.strictEqual(over.ok === false && over.code, "OVER_BUDGET");
      scrapedPrice = 40;
      assert.strictEqual(createRequests + captureRequests, 0);
      assert.strictEqual((await rows(m.id)).length, 0);
    }],
    ["a declined confirmed payment does not use up the billing period", async () => {
      reset({ capture: () => issue(422, "INSTRUMENT_DECLINED") });
      scrapedPrice = 40;
      const m = await seed({ status: "ACTIVE" });
      const quote = await quoteMandatePayment(m.id, "u1");
      assert.ok(quote.ok);
      assert.strictEqual((await executeConfirmedMandatePayment(quote.quote.confirmToken, "u1")).ok, false);
      reset();
      const retry = await quoteMandatePayment(m.id, "u1");
      assert.ok(retry.ok);
      assert.ok((await executeConfirmedMandatePayment(retry.quote.confirmToken, "u1")).ok);
      assert.strictEqual((await rows(m.id)).filter((r) => r.status === "COMPLETED").length, 1);
    }],
    ["one charge per billing period across manual run, savings and Sentinel approval", async () => {
      reset();
      scrapedPrice = 11.99;
      const m = await seed({ status: "ACTIVE", service: "Spotify Premium", lastScrapedPrice: 11.99, budgetCeiling: 15 });
      const quote = await quoteMandatePayment(m.id, "u1");
      assert.ok(quote.ok);
      assert.ok((await executeConfirmedMandatePayment(quote.quote.confirmToken, "u1")).ok);
      await assert.rejects(personaSavingsOptimizer.applySavingsPayment({
        ownerId: "u1", serviceName: m.service, discountedPrice: 5.99, mandateId: m.id, dealId: "deal-spotify-student",
      }));
      const approval = await handleRemoteAction({ ownerId: "u1", action: "approve", mandateId: m.id, alertId: await alertFor(m.id, 12.99) });
      assert.strictEqual(approval.success, false);
      assert.strictEqual(captureRequests, 1);
      assert.strictEqual((await rows(m.id)).length, 1);
      scrapedPrice = 40;
    }],
    ["a payment recorded under an older key format still counts for its billing period", async () => {
      reset();
      scrapedPrice = 40;
      const m = await seed({ status: "ACTIVE" });
      const now = new Date().toISOString();
      await pg.insert(transactions).values({
        id: `tx-legacy-${randomUUID()}`, mandateId: m.id, orderId: `ORD-LEGACY-${randomUUID()}`,
        idempotencyKey: `agent:${m.id}:${now.slice(0, 10)}`, service: m.service, amount: 40, currency: "USD",
        status: "COMPLETED", timestamp: now, createdAt: now,
      });
      const quote = await quoteMandatePayment(m.id, "u1");
      assert.strictEqual(quote.ok === false && quote.code, "ALREADY_PAID");
      const old = await seed({ status: "ACTIVE" });
      await pg.insert(transactions).values({
        id: `tx-old-${randomUUID()}`, mandateId: old.id, orderId: `ORD-OLD-${randomUUID()}`,
        idempotencyKey: `agent:${old.id}:2020-01-15`, service: old.service, amount: 40, currency: "USD",
        status: "COMPLETED", timestamp: "2020-01-15T10:00:00.000Z", createdAt: "2020-01-15T10:00:00.000Z",
      });
      assert.ok((await quoteMandatePayment(old.id, "u1")).ok, "a payment from an earlier period does not block this one");
      assert.strictEqual(createRequests + captureRequests, 0);
    }],
    ["quote and execute routes need a real session and return clear statuses", async () => {
      reset();
      scrapedPrice = 40;
      const m = await seed({ status: "ACTIVE" });
      const quoted = await quoteRoute.POST(post({ cookie: userCookie }, { mandateId: m.id }));
      assert.strictEqual(quoted.status, 200);
      const { quote } = await quoted.json();
      assert.strictEqual(createRequests, 0);
      const paid = await executeRoute.POST(post({ cookie: userCookie }, { confirmToken: quote.confirmToken }));
      assert.strictEqual(paid.status, 201);
      const again = await executeRoute.POST(post({ cookie: userCookie }, { confirmToken: quote.confirmToken }));
      assert.strictEqual(again.status, 409);
      assert.strictEqual((await again.json()).code, "ALREADY_PAID");
      assert.strictEqual((await quoteRoute.POST(post({ cookie: userCookie }, { mandateId: "mandate-1" }))).status, 404);
      assert.strictEqual(captureRequests, 1);
    }],
    ["savings uses the server price, and racing requests charge once", async () => {
      reset();
      const m = await seed({ status: "ACTIVE", service: "Spotify Premium", lastScrapedPrice: 11.99, budgetCeiling: 15 });
      const apply = () => personaSavingsOptimizer.applySavingsPayment({
        ownerId: "u1",
        serviceName: m.service, discountedPrice: 5.99, mandateId: m.id, dealId: "deal-spotify-student",
      }).then(() => true, () => false);
      const results = await Promise.all(Array.from({ length: 8 }, apply));
      assert.strictEqual(results.filter(Boolean).length, 1);
      assert.strictEqual(captureRequests, 1);
      assert.strictEqual((await rows(m.id))[0].amount, 5.99);
      const other = await seed({ status: "ACTIVE", service: "Spotify Premium", lastScrapedPrice: 11.99, budgetCeiling: 15 });
      await assert.rejects(personaSavingsOptimizer.applySavingsPayment({
        ownerId: "u1",
        serviceName: other.service, discountedPrice: 0.01, mandateId: other.id, dealId: "deal-spotify-student",
      }), /does not match/);
      await assert.rejects(personaSavingsOptimizer.applySavingsPayment({
        ownerId: "u1",
        serviceName: other.service, discountedPrice: 5.99, mandateId: other.id, dealId: "deal-posthog-startup",
      }), /No valid savings deal/);
    }],
    ["payment routes reject missing, forged and demo sessions", async () => {
      reset();
      const m = await seed();
      const body = { action: "approve", mandateId: m.id };
      const routes: Array<(r: Request) => Promise<Response>> = [
        webhook.POST,
        savingsRoute.POST as unknown as (r: Request) => Promise<Response>,
        chatRoute.POST as unknown as (r: Request) => Promise<Response>,
        txRoute.POST,
        ordersRoute.POST,
        quoteRoute.POST,
        executeRoute.POST,
      ];
      for (const route of routes) {
        assert.strictEqual((await route(post({}, body))).status, 401);
        const forged = Buffer.from(JSON.stringify({ user: realUser, expiresAt: Date.now() + 9e6 })).toString("base64url");
        assert.strictEqual((await route(post({ cookie: cookieFor(`${forged}.bad`) }, body))).status, 401);
        const demo = cookieFor(getJudgeDemoSession().accessToken);
        assert.strictEqual((await route(post({ cookie: demo }, body))).status, 403);
      }
      assert.strictEqual(createRequests + captureRequests, 0);
      assert.strictEqual((await rows(m.id)).length, 0);
    }],
    ["webhook ignores a caller-supplied price", async () => {
      reset();
      const m = await seed();
      const response = await webhook.POST(post({ cookie: userCookie }, { action: "approve", mandateId: m.id, alertId: await alertFor(m.id), price: 0.01 }));
      assert.strictEqual(response.status, 200);
      assert.strictEqual((await rows(m.id))[0].amount, 40);
    }],
    ["Telegram callbacks need the secret and allowed chat, and ignore the payload price", async () => {
      reset();
      const m = await seed();
      const alertId = await alertFor(m.id);
      const update = (chat: number) => ({ callback_query: { id: "cb", data: `approve:${m.id}:${alertId}:0.01`, message: { chat: { id: chat } } } });
      const header = "x-telegram-bot-api-secret-token";
      assert.strictEqual((await webhook.POST(post({}, update(12345)))).status, 401);
      assert.strictEqual((await webhook.POST(post({ [header]: "wrong-secret-value!!" }, update(12345)))).status, 401);
      assert.strictEqual((await webhook.POST(post({ [header]: "test-telegram-secret" }, update(999)))).status, 401);
      assert.strictEqual(createRequests, 0);
      const ok = await webhook.POST(post({ [header]: "test-telegram-secret" }, update(12345)));
      assert.strictEqual(ok.status, 200);
      assert.strictEqual((await rows(m.id))[0].amount, 40);
      const replay = await webhook.POST(post({ [header]: "test-telegram-secret" }, update(12345)));
      assert.strictEqual(replay.status, 200);
      assert.strictEqual(captureRequests, 1);
    }],
    ["direct capture is refused in real mode", async () => {
      reset();
      for (const body of [{ action: "capture", orderId: "X" }, { action: "mcp_tool", toolName: "paypal_orders_capture", args: { order_id: "X" } }]) {
        assert.strictEqual((await ordersRoute.POST(post({ cookie: userCookie }, body))).status, 403);
      }
      assert.strictEqual(captureRequests, 0);
    }],
    ["no request left the mock", async () => {
      assert.strictEqual(otherRequests, 0);
    }],
  ];

  let failed = 0;
  setInterval(() => {}, 1000);
  for (const [name, run] of tests) {
    try {
      await run();
      console.log(`PASS ${name}`);
    } catch (error) {
      failed++;
      console.error(`FAIL ${name}\n`, error);
    }
  }
  console.log(`\n${tests.length - failed}/${tests.length} passed`);

  configurePaymentReservationDb(null);
  await admin.unsafe(`DROP SCHEMA "${testSchema}" CASCADE`);
  await client.end();
  await admin.end();
  sqlite.close();
  try { rmSync(tempDir, { recursive: true, force: true }); } catch {}
  process.exit(failed ? 1 : 0);
})().catch(async (error) => {
  console.error(error);
  await admin.unsafe(`DROP SCHEMA IF EXISTS "${testSchema}" CASCADE`).catch(() => {});
  try { sqlite.close(); rmSync(tempDir, { recursive: true, force: true }); } catch {}
  process.exit(2);
});
