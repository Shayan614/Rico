/**
 * Scheduled Sentinel audits through the real routes on a new throwaway PostgreSQL database.
 * PayPal stays in mock mode, every outbound request fails, and the scraper is stubbed.
 *
 *   TEST_DATABASE_URL=postgres://user@127.0.0.1:5432/postgres npm run test:sentinel-cron
 *
 * Only a local server is accepted, because the test creates and drops a whole database.
 */
import assert from "assert";
import { randomUUID } from "crypto";
import { readFileSync } from "fs";
import path from "path";
import postgres from "postgres";

const adminUrl = process.env.TEST_DATABASE_URL;
if (!adminUrl) throw new Error("TEST_DATABASE_URL is required; refusing to run");
if (!["127.0.0.1", "localhost"].includes(new URL(adminUrl).hostname)) {
  throw new Error("This test creates and drops a database, so it only runs on a local server");
}
if (process.env.NODE_ENV === "production") throw new Error("Refusing to run with NODE_ENV=production");

const dbName = `rico_cron_${randomUUID().replace(/-/g, "")}`;
const targetUrl = new URL(adminUrl);
targetUrl.pathname = `/${dbName}`;

const CRON_SECRET = "test-cron-secret-0123456789-0123456789";
const userA = "11111111-1111-4111-8111-111111111111";
const userB = "22222222-2222-4222-8222-222222222222";

Object.assign(process.env, {
  DATABASE_PROVIDER: "postgres",
  SUPABASE_DATABASE_URL: targetUrl.toString(),
  PAYPAL_MODE: "mock",
  AUTH_SECRET: "test-only-secret",
  CRON_SECRET,
  TELEGRAM_WEBHOOK_SECRET: "test-telegram-secret",
  TELEGRAM_CHAT_ID: "12345",
  TELEGRAM_OWNER_ID: userA,
});
for (const key of ["DATABASE_URL", "TELEGRAM_BOT_TOKEN", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL", "NEXT_PUBLIC_POSTHOG_KEY", "POSTHOG_API_KEY"]) {
  delete process.env[key];
}

let outbound = 0;
globalThis.fetch = (async () => {
  outbound++;
  throw new Error("Network is disabled in this test");
}) as typeof fetch;

const admin = postgres(adminUrl, { max: 1, prepare: false, onnotice: () => {} });

type Scrape = { price: number; source: "live_browser" | "cache_fallback" };

(async () => {
  await admin.unsafe(`CREATE DATABASE "${dbName}"`);
  const direct = postgres(targetUrl.toString(), { max: 3, prepare: false, onnotice: () => {} });
  const folder = path.join(process.cwd(), "drizzle", "pg");
  const journal = JSON.parse(readFileSync(path.join(folder, "meta", "_journal.json"), "utf8"));
  for (const { tag } of journal.entries as { tag: string }[]) {
    for (const statement of readFileSync(path.join(folder, `${tag}.sql`), "utf8").split("--> statement-breakpoint")) {
      if (statement.includes("REVOKE ALL")) continue;
      await direct.unsafe(statement);
    }
  }
  await direct`INSERT INTO users (id, email) VALUES (${userA}, 'a@example.test'), (${userB}, 'b@example.test')`;

  const { priceWorker } = await import("../browser");
  const { postgresClient } = await import("../../db/postgres");
  const { createUserSession, serializeSessionToken, SESSION_COOKIE_NAME } = await import("../auth/session-bridge");
  const { omnichannelAlertStore, priceSentinel, SENTINEL_AUDIT_LOCK_KEY } = await import("./index");
  const cronRoute = await import("../../app/api/cron/sentinel/route");
  const runRoute = await import("../../app/api/sentinel/run/route");
  const statusRoute = await import("../../app/api/sentinel/status/route");
  const webhook = await import("../../app/api/sentinel/webhook/route");

  let scrapes = 0;
  let onScrape: (service: string) => Promise<Scrape> | Scrape = () => ({ price: 40, source: "live_browser" });
  (priceWorker as unknown as { scrapeMerchantPrice: unknown }).scrapeMerchantPrice = async (service: string) => {
    scrapes++;
    const result = await onScrape(service);
    return { ...result, currency: "USD", planName: "Plan", service, confidence: 1 };
  };

  const cookieFor = (id: string, email: string) => ({
    cookie: `${SESSION_COOKIE_NAME}=${encodeURIComponent(serializeSessionToken(createUserSession({ id, email, fullName: id, role: "user" }, false)))}`,
  });
  const A = cookieFor(userA, "a@example.test");
  const B = cookieFor(userB, "b@example.test");
  const post = (headers: Record<string, string>, body: unknown = {}) =>
    new Request("http://test.local/api", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
  const get = (headers: Record<string, string>) => new Request("http://test.local/api", { headers });
  const cron = (body: unknown = {}) => cronRoute.POST(post({ authorization: `Bearer ${CRON_SECRET}` }, body));

  let n = 0;
  async function seed(over: { owner?: string; status?: string; price?: number; ceiling?: number; service?: string } = {}) {
    const id = `m-${++n}`;
    await direct`INSERT INTO mandates (id, owner_id, service, budget_ceiling, last_scraped_price, recurrence, next_run, status)
      VALUES (${id}, ${over.owner ?? userA}, ${over.service ?? "Test Service"}, ${over.ceiling ?? 50}, ${over.price ?? 40}, 'Monthly on 1st', 'Dec 1', ${over.status ?? "ACTIVE"})`;
    return id;
  }
  const row = async (id: string) => (await direct`SELECT status, last_scraped_price FROM mandates WHERE id = ${id}`)[0];
  const payments = async () => (await direct`SELECT
    (SELECT count(*) FROM transactions)::int AS tx,
    (SELECT count(*) FROM audit_logs WHERE event_type = 'PAYMENT_CAPTURED')::int AS captured`)[0];
  const statusFor = async (headers: Record<string, string>) => (await statusRoute.GET(get(headers))).json();
  const clearAlerts = () => (omnichannelAlertStore as unknown as { alerts: Map<string, unknown> }).alerts.clear();
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const telegramTap = (data: string, secret = "test-telegram-secret") =>
    webhook.POST(post({ "x-telegram-bot-api-secret-token": secret }, { callback_query: { id: "cb", data, message: { chat: { id: 12345 } } } }));
  const assertNoPayments = async () => assert.deepStrictEqual({ ...(await payments()) }, { tx: 0, captured: 0 });

  const reset = async () => {
    await direct`TRUNCATE transactions, audit_logs, mandates CASCADE`;
    clearAlerts();
    scrapes = 0;
    onScrape = () => ({ price: 40, source: "live_browser" });
    process.env.CRON_SECRET = CRON_SECRET;
    process.env.PAYPAL_MODE = "mock";
  };

  const tests: Array<[string, () => Promise<void>]> = [
    ["the cron route fails closed when CRON_SECRET is missing or too short", async () => {
      const id = await seed();
      for (const value of [undefined, "", "short-secret"]) {
        if (value === undefined) delete process.env.CRON_SECRET;
        else process.env.CRON_SECRET = value;
        const res = await cronRoute.POST(post({ authorization: `Bearer ${value ?? "anything"}` }));
        assert.strictEqual(res.status, 503, String(value));
      }
      assert.strictEqual(scrapes, 0);
      assert.strictEqual((await row(id)).last_scraped_price, 40);
    }],
    ["missing or invalid cron authorization is refused before any work", async () => {
      await seed();
      for (const authorization of [undefined, "", "Bearer", "Bearer ", "Bearer wrong", `Basic ${CRON_SECRET}`, CRON_SECRET, `Bearer ${CRON_SECRET}x`]) {
        const res = await cronRoute.POST(post(authorization === undefined ? {} : { authorization }));
        assert.strictEqual(res.status, 401, String(authorization));
      }
      assert.strictEqual((await cronRoute.POST(post(A))).status, 401, "a user session is not a cron credential");
      assert.strictEqual(scrapes, 0);
    }],
    ["valid authorization runs the audit with no user session and returns counts only", async () => {
      const id = await seed();
      const res = await cron();
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.totalAudited, 1);
      assert.strictEqual(body.healthy, 1);
      assert.ok(!JSON.stringify(body).includes(id) && !JSON.stringify(body).includes(userA), "no per-user data");
    }],
    ["only ACTIVE rules are audited, by cron and by a manual run naming one rule", async () => {
      const active = await seed();
      const paused = await seed({ status: "PAUSED" });
      const held = await seed({ status: "ANOMALY_HOLD" });
      onScrape = () => ({ price: 999, source: "live_browser" });
      const body = await (await cron()).json();
      assert.strictEqual(body.totalAudited, 1);
      assert.strictEqual(scrapes, 1);
      assert.strictEqual((await row(active)).status, "ANOMALY_HOLD");
      for (const id of [paused, held]) assert.strictEqual((await row(id)).last_scraped_price, 40);
      assert.strictEqual((await row(paused)).status, "PAUSED");
      const manual = await (await runRoute.POST(post(A, { mandateId: paused, forceSpike: true }))).json();
      assert.strictEqual(manual.summary.totalAudited, 0);
      assert.strictEqual((await row(paused)).status, "PAUSED");
    }],
    ["a fallback or cached price is unverified: no hold, no price change, no alert", async () => {
      const id = await seed({ ceiling: 10 });
      onScrape = () => ({ price: 19.99, source: "cache_fallback" });
      const body = await (await cron()).json();
      assert.deepStrictEqual([body.unverified, body.healthy, body.anomalies, body.alertsRecorded], [1, 0, 0, 0]);
      assert.deepStrictEqual({ ...(await row(id)) }, { status: "ACTIVE", last_scraped_price: 40 });
      const [log] = await direct`SELECT severity, metadata FROM audit_logs WHERE mandate_id = ${id}`;
      assert.strictEqual(log.severity, "warning");
      assert.strictEqual(log.metadata.reason, "PRICE_UNVERIFIED");
    }],
    ["a failed price lookup is unverified, never reported as steady", async () => {
      const id = await seed();
      onScrape = () => { throw new Error("browser crashed"); };
      const body = await (await cron()).json();
      assert.deepStrictEqual([body.unverified, body.healthy], [1, 0]);
      assert.deepStrictEqual({ ...(await row(id)) }, { status: "ACTIVE", last_scraped_price: 40 });
      const status = await statusFor(A);
      assert.strictEqual(status.sentinel.recentAudits[0].status, "UNVERIFIED");
      assert.doesNotMatch(status.sentinel.recentAudits[0].details, /steady/);
    }],
    ["forced spikes are refused outside explicit mock mode, and cron ignores them", async () => {
      const id = await seed();
      Object.assign(process.env, { PAYPAL_MODE: "real", PAYPAL_CLIENT_ID: "fake-client-id-123456", PAYPAL_CLIENT_SECRET: "fake-client-secret-123456" });
      const res = await runRoute.POST(post(A, { forceSpike: true }));
      assert.strictEqual(res.status, 403);
      await assert.rejects(priceSentinel.runAuditCycle({ forceSpike: true }), /only available when PAYPAL_MODE=mock/);
      delete process.env.PAYPAL_MODE;
      await assert.rejects(priceSentinel.runAuditCycle({ forceSpike: true }), /only available when PAYPAL_MODE=mock/);
      process.env.PAYPAL_MODE = "mock";
      delete process.env.PAYPAL_CLIENT_ID;
      delete process.env.PAYPAL_CLIENT_SECRET;
      assert.strictEqual((await row(id)).status, "ACTIVE");
      const body = await (await cron({ forceSpike: true, service: "Test" })).json();
      assert.strictEqual(body.anomalies, 0, "the request body cannot force a spike");
      assert.strictEqual((await row(id)).last_scraped_price, 40);
    }],
    ["overlapping cron requests run one audit and raise one alert", async () => {
      const id = await seed();
      onScrape = async () => { await sleep(150); return { price: 999, source: "live_browser" }; };
      const results = await Promise.all(Array.from({ length: 6 }, () => cron()));
      assert.deepStrictEqual(results.map((r) => r.status).sort(), [200, 409, 409, 409, 409, 409]);
      assert.strictEqual(scrapes, 1);
      assert.strictEqual(omnichannelAlertStore.getAllAlerts().length, 1);
      assert.strictEqual((await row(id)).status, "ANOMALY_HOLD");
    }],
    ["the database lock refuses a run while another server instance holds it", async () => {
      await seed();
      let release = () => {};
      const gate = new Promise<void>((r) => { release = r; });
      let locked = () => {};
      const isLocked = new Promise<void>((r) => { locked = r; });
      const holder = direct.begin(async (tx) => {
        await tx`SELECT pg_advisory_xact_lock(${SENTINEL_AUDIT_LOCK_KEY}::bigint)`;
        locked();
        await gate;
      });
      await isLocked;
      assert.strictEqual((await cron()).status, 409);
      assert.strictEqual(scrapes, 0);
      release();
      await holder;
      assert.strictEqual((await cron()).status, 200, "the lock is released afterwards");
    }],
    ["a rule paused during the audit stays paused and raises no alert", async () => {
      const id = await seed();
      onScrape = async () => {
        await direct`UPDATE mandates SET status = 'PAUSED' WHERE id = ${id}`;
        return { price: 999, source: "live_browser" };
      };
      const body = await (await cron()).json();
      assert.strictEqual(body.alertsRecorded, 0);
      assert.deepStrictEqual({ ...(await row(id)) }, { status: "PAUSED", last_scraped_price: 40 });
    }],
    ["monitoring never makes a payment, even when holds and price drops occur", async () => {
      await seed({ service: "Spike" });
      await seed({ service: "Drop" });
      await seed({ service: "Steady" });
      onScrape = (service) => ({ price: service === "Spike" ? 999 : service === "Drop" ? 20 : 40, source: "live_browser" });
      const body = await (await cron()).json();
      assert.deepStrictEqual([body.anomalies, body.priceDrops, body.healthy], [1, 1, 1]);
      await assertNoPayments();
      assert.strictEqual(outbound, 0, "no PayPal or other outbound request");
      for (const file of ["src/lib/sentinel/price-sentinel.ts", "src/lib/sentinel/scheduled-audit.ts", "src/app/api/cron/sentinel/route.ts"]) {
        assert.doesNotMatch(readFileSync(path.join(process.cwd(), file), "utf8"), /executeMandatePayment|executeAtomicPaymentTransaction|handleRemoteAction/, file);
      }
    }],
    ["each user's rules, alerts and audits stay with that user", async () => {
      const a = await seed({ owner: userA });
      const b = await seed({ owner: userB });
      onScrape = () => ({ price: 999, source: "live_browser" });
      await cron();
      const alerts = omnichannelAlertStore.getAllAlerts();
      assert.strictEqual(alerts.find((x) => x.mandateId === a)?.ownerId, userA);
      assert.strictEqual(alerts.find((x) => x.mandateId === b)?.ownerId, userB);
      const seenByA = JSON.stringify(await statusFor(A));
      const seenByB = JSON.stringify(await statusFor(B));
      assert.ok(seenByA.includes(a) && !seenByA.includes(b));
      assert.ok(seenByB.includes(b) && !seenByB.includes(a));
      const other = await seed({ owner: userB });
      onScrape = () => ({ price: 40, source: "live_browser" });
      scrapes = 0;
      const manual = await (await runRoute.POST(post(A, { mandateId: other }))).json();
      assert.strictEqual(manual.summary.totalAudited, 0);
      assert.strictEqual(scrapes, 0);
    }],
    ["after a restart an old Telegram button fails closed and nothing is charged", async () => {
      const id = await seed({ owner: userA });
      onScrape = () => ({ price: 45, source: "live_browser" });
      await direct`UPDATE mandates SET last_scraped_price = 30 WHERE id = ${id}`;
      await cron();
      const alert = omnichannelAlertStore.getLatestAlertForMandate(id)!;
      assert.strictEqual((await row(id)).status, "ANOMALY_HOLD");
      const data = `approve:${id}:${alert.id}:45.00`;

      clearAlerts(); // Alerts are held in memory, so a restart loses them.
      assert.strictEqual((await telegramTap(data, "wrong-secret-value!!")).status, 401);
      const tapped = await (await telegramTap(data)).json();
      assert.strictEqual(tapped.result.success, false);
      assert.match(tapped.result.message, /could not be verified/);
      await assertNoPayments();
      assert.strictEqual((await row(id)).status, "ANOMALY_HOLD", "the hold survives for review");
    }],
    ["before a restart a verified Telegram approval charges mock PayPal once", async () => {
      const id = await seed({ owner: userA });
      onScrape = () => ({ price: 45, source: "live_browser" });
      await direct`UPDATE mandates SET last_scraped_price = 30 WHERE id = ${id}`;
      await cron();
      const alert = omnichannelAlertStore.getLatestAlertForMandate(id)!;
      const data = `approve:${id}:${alert.id}:0.01`;
      assert.strictEqual((await (await telegramTap(data)).json()).result.success, true);
      assert.strictEqual((await (await telegramTap(data)).json()).result.success, false, "a replay is refused");
      const rows = await direct`SELECT amount FROM transactions WHERE mandate_id = ${id}`;
      assert.deepStrictEqual(rows.map((r) => r.amount), [45], "the stored price, once");
      assert.strictEqual(outbound, 0);
    }],
    ["status is honest about scheduling and delivery", async () => {
      delete process.env.CRON_SECRET;
      let status = await statusFor(A);
      assert.strictEqual(status.sentinel.monitoring.mode, "manual_only");
      assert.strictEqual(status.sentinel.schedulerActive, false);
      process.env.CRON_SECRET = CRON_SECRET;
      status = await statusFor(A);
      assert.strictEqual(status.sentinel.monitoring.mode, "awaiting_run");
      assert.strictEqual(status.sentinel.monitoring.lastScheduledRunAt, null);
      await cron();
      status = await statusFor(A);
      assert.strictEqual(status.sentinel.monitoring.mode, "scheduled");
      assert.ok(status.sentinel.monitoring.lastScheduledRunAt);
      const stale = new Date(Date.now() - 27 * 3600 * 1000).toISOString();
      await direct`UPDATE audit_logs SET timestamp = ${stale} WHERE mandate_id IS NULL`;
      assert.strictEqual((await statusFor(A)).sentinel.monitoring.mode, "awaiting_run", "a stale run is not scheduled");
      const { telegram, whatsapp, slack } = status.sentinel.channels;
      assert.deepStrictEqual([telegram.configured, telegram.mode], [false, "SIMULATED_MOCK"]);
      for (const channel of [whatsapp, slack]) assert.deepStrictEqual({ ...channel }, { configured: false, delivers: false, mode: "FORMAT_ONLY" });
      const panel = readFileSync(path.join(process.cwd(), "src/components/dashboard/PriceSentinelPanel.tsx"), "utf8");
      assert.doesNotMatch(panel, /Active \(24h Cron\)|24\/7 DAEMON ACTIVE|Autonomous loop/);
    }],
    ["simulated alerts are not counted as delivered", async () => {
      await seed();
      onScrape = () => ({ price: 999, source: "live_browser" });
      const body = await (await cron()).json();
      assert.deepStrictEqual([body.alertsRecorded, body.alertsDelivered], [1, 0]);
    }],
  ];

  let failed = 0;
  for (const [name, run] of tests) {
    try {
      await reset();
      await run();
      console.log(`PASS ${name}`);
    } catch (error) {
      failed++;
      console.error(`FAIL ${name}\n`, error);
    }
  }
  console.log(`\n${tests.length - failed}/${tests.length} passed; outbound requests: ${outbound}`);

  await postgresClient.end({ timeout: 5 });
  await direct.end({ timeout: 5 });
  await admin.unsafe(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
  await admin.end({ timeout: 5 });
  process.exit(failed || outbound ? 1 : 0);
})().catch(async (error) => {
  console.error(error);
  await admin.unsafe(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`).catch(() => {});
  process.exit(2);
});
