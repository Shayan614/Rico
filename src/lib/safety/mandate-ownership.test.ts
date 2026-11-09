/**
 * Two-user ownership tests through the real routes, on a temporary SQLite file in mock mode.
 * Every outbound request fails, and the merchant scraper is stubbed.
 */
import assert from "assert";
import { mkdtempSync, readFileSync } from "fs";
import os from "os";
import path from "path";
import Database from "better-sqlite3";

if (process.env.NODE_ENV === "production") throw new Error("Refusing to run with NODE_ENV=production");

const sqlitePath = path.join(mkdtempSync(path.join(os.tmpdir(), "rico-owner-")), "test.db");
Object.assign(process.env, {
  DATABASE_URL: sqlitePath,
  PAYPAL_MODE: "mock",
  AUTH_SECRET: "test-only-secret",
  TELEGRAM_WEBHOOK_SECRET: "test-telegram-secret",
  TELEGRAM_CHAT_ID: "12345",
  TELEGRAM_OWNER_ID: "user-a",
});
delete process.env.TELEGRAM_BOT_TOKEN;

let outboundRequests = 0;
globalThis.fetch = (async () => {
  outboundRequests++;
  throw new Error("Network is disabled in ownership tests");
}) as typeof fetch;

// Builds the legacy table, then applies the real manual migration to it.
const raw = new Database(sqlitePath);
raw.exec(`
  CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, full_name TEXT, avatar_url TEXT, role TEXT NOT NULL DEFAULT 'user',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE mandates (id TEXT PRIMARY KEY, service TEXT NOT NULL, budget_ceiling REAL NOT NULL, last_scraped_price REAL NOT NULL DEFAULT 0,
    recurrence TEXT NOT NULL, next_run TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'ACTIVE', category TEXT NOT NULL DEFAULT 'Subscription',
    currency TEXT NOT NULL DEFAULT 'USD', strict_mode INTEGER NOT NULL DEFAULT 0, merchant_url TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE transactions (id TEXT PRIMARY KEY, mandate_id TEXT REFERENCES mandates(id) ON DELETE SET NULL, order_id TEXT NOT NULL, idempotency_key TEXT,
    service TEXT NOT NULL, amount REAL NOT NULL, currency TEXT NOT NULL DEFAULT 'USD', status TEXT NOT NULL DEFAULT 'PENDING',
    timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, receipt_data TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE audit_logs (id TEXT PRIMARY KEY, mandate_id TEXT REFERENCES mandates(id) ON DELETE SET NULL, timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, event_type TEXT NOT NULL,
    service TEXT NOT NULL, details TEXT NOT NULL, severity TEXT NOT NULL DEFAULT 'info', metadata TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
  INSERT INTO mandates (id, service, budget_ceiling, last_scraped_price, recurrence, next_run, status)
    VALUES ('legacy-1', 'Legacy Service', 50, 40, 'Monthly', 'Dec 1', 'ANOMALY_HOLD');
`);
raw.exec(readFileSync(path.join(process.cwd(), "drizzle", "sqlite-manual", "0001_add_mandate_owner.sql"), "utf8"));

(async () => {
  const { createUserSession, getJudgeDemoSession, serializeSessionToken, SESSION_COOKIE_NAME } = await import("../auth/session-bridge");
  const { omnichannelDispatcher } = await import("../sentinel/omnichannel");
  const { dispatchAgentTool } = await import("../gemini/tool-executors");
  const { priceWorker } = await import("../browser");
  const { executeAtomicPaymentTransaction } = await import("./atomic-transaction");
  const mandatesRoute = await import("../../app/api/mandates/route");
  const dashboardRoute = await import("../../app/api/dashboard/route");
  const txRoute = await import("../../app/api/transactions/route");
  const auditRoute = await import("../../app/api/audit-logs/route");
  const webhook = await import("../../app/api/sentinel/webhook/route");
  const sentinelRun = await import("../../app/api/sentinel/run/route");
  const sentinelStatus = await import("../../app/api/sentinel/status/route");
  const savingsApply = await import("../../app/api/savings/apply/route");
  const savingsProbe = await import("../../app/api/savings/probe/route");
  const chatRoute = await import("../../app/api/chat/route");

  (priceWorker as unknown as { scrapeMerchantPrice: unknown }).scrapeMerchantPrice = async () => ({
    price: 40, currency: "USD", planName: "Plan", service: "Test", source: "live_browser", confidence: 1,
  });

  const cookie = (id: string, simulated = false) => ({
    cookie: `${SESSION_COOKIE_NAME}=${encodeURIComponent(
      serializeSessionToken(createUserSession({ id, email: `${id}@example.test`, fullName: id, role: "user" }, simulated))
    )}`,
  });
  const A = cookie("user-a");
  const B = cookie("user-b");
  const post = (headers: Record<string, string>, body: unknown) =>
    new Request("http://test.local/api", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
  const get = (headers: Record<string, string> = {}) => new Request("http://test.local/api", { headers });

  const mandateRow = (id: string) => raw.prepare("SELECT * FROM mandates WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  const txCount = (id: string) => (raw.prepare("SELECT count(*) n FROM transactions WHERE mandate_id = ?").get(id) as { n: number }).n;

  let counter = 0;
  async function createFor(headers: Record<string, string>, over: Record<string, unknown> = {}) {
    const id = `m-${++counter}`;
    const response = await mandatesRoute.POST(post(headers, {
      id, service: "Test Service", budgetCeiling: 50, lastScrapedPrice: 40, status: "ANOMALY_HOLD", ...over,
    }));
    assert.strictEqual(response.status, 201);
    return id;
  }
  async function alertFor(mandateId: string, ownerId: string) {
    const id = `alert-${++counter}`;
    await omnichannelDispatcher.dispatchAlert({
      id, mandateId, ownerId, service: "Test Service", oldPrice: 30, newPrice: 40, jumpPercent: 33,
      budgetCeiling: 50, currency: "USD", channel: "telegram", status: "PENDING", timestamp: new Date().toISOString(),
    });
    return id;
  }
  const webhookError = async (headers: Record<string, string>, body: unknown) => {
    const response = await webhook.POST(post(headers, body));
    return { status: response.status, error: ((await response.json()) as { error?: string }).error };
  };

  const tests: Array<[string, () => Promise<void>]> = [
    ["every mandate, transaction, audit, Sentinel and savings route rejects anonymous callers", async () => {
      const responses = await Promise.all([
        mandatesRoute.GET(get()), mandatesRoute.POST(post({}, {})), dashboardRoute.GET(get()),
        txRoute.GET(get()), txRoute.POST(post({}, {})), auditRoute.GET(get()), auditRoute.POST(post({}, {})),
        webhook.POST(post({}, { action: "cancel", mandateId: "x" })), sentinelRun.POST(post({}, {})), sentinelStatus.GET(get()),
        savingsApply.POST(post({}, {}) as never), savingsProbe.GET(get() as never), savingsProbe.POST(post({}, {}) as never),
        chatRoute.POST(post({}, {}) as never),
      ]);
      assert.deepStrictEqual(responses.map((r) => r.status), responses.map(() => 401));
    }],
    ["creation takes the owner from the session, never the request body", async () => {
      const id = await createFor(A, { ownerId: "user-b", owner_id: "user-b", userId: "user-b" });
      assert.strictEqual(mandateRow(id)?.owner_id, "user-a");
    }],
    ["User B cannot read User A's mandates, transactions or audit logs", async () => {
      const id = await createFor(A);
      const paid = await webhook.POST(post(A, { action: "approve", mandateId: id }));
      assert.strictEqual(paid.status, 200);
      const secret = JSON.stringify;
      const forB = await Promise.all([mandatesRoute.GET(get(B)), dashboardRoute.GET(get(B)), txRoute.GET(get(B)), auditRoute.GET(get(B))]);
      for (const response of forB) assert.ok(!secret(await response.json()).includes(id));
      const forA = await (await dashboardRoute.GET(get(A))).json() as { mandates: { id: string }[]; transactions: unknown[]; auditLogs: unknown[] };
      assert.ok(forA.mandates.some((m) => m.id === id));
      assert.ok(forA.transactions.length > 0);
      assert.ok(forA.auditLogs.length > 0);
    }],
    ["User B cannot cancel User A's mandate, and gets the same error as a missing one", async () => {
      const id = await createFor(A);
      const denied = await webhookError(B, { action: "cancel", mandateId: id });
      const missing = await webhookError(B, { action: "cancel", mandateId: "does-not-exist" });
      assert.strictEqual(denied.status, missing.status);
      assert.strictEqual(denied.error?.replace(id, "ID"), missing.error?.replace("does-not-exist", "ID"));
      assert.strictEqual(mandateRow(id)?.status, "ANOMALY_HOLD");
    }],
    ["User B cannot approve or pay by backup card, with or without A's alert", async () => {
      const id = await createFor(A);
      const alertId = await alertFor(id, "user-a");
      for (const action of ["approve", "backup_card"]) {
        assert.strictEqual((await webhook.POST(post(B, { action, mandateId: id }))).status, 500);
        assert.strictEqual((await webhook.POST(post(B, { action, mandateId: id, alertId }))).status, 500);
      }
      assert.strictEqual(txCount(id), 0);
      assert.strictEqual((await webhook.POST(post(A, { action: "approve", mandateId: id, alertId }))).status, 200);
      assert.strictEqual(txCount(id), 1);
    }],
    ["User B cannot modify A's mandate through Sentinel, audit or transaction routes", async () => {
      const id = await createFor(A, { status: "ACTIVE" });
      const before = mandateRow(id);
      const run = await sentinelRun.POST(post(B, { mandateId: id, forceSpike: true }));
      assert.strictEqual(((await run.json()) as { summary: { totalAudited: number } }).summary.totalAudited, 0);
      assert.deepStrictEqual(mandateRow(id), before);
      assert.strictEqual((await auditRoute.POST(post(B, { mandateId: id, eventType: "PRICE_VERIFIED", service: "x", details: "forged" }))).status, 404);
      assert.strictEqual((await txRoute.POST(post(B, { mandateId: id, orderId: "forged", service: "x", amount: 1 }))).status, 404);
      assert.strictEqual((await savingsProbe.POST(post(B, { service: "x", mandateId: id }) as never)).status, 404);
      assert.strictEqual(txCount(id), 0);
    }],
    ["User B cannot see A's alerts or audit results in Sentinel status", async () => {
      const id = await createFor(A, { status: "ACTIVE" });
      const alertId = await alertFor(id, "user-a");
      const run = await sentinelRun.POST(post(A, { mandateId: id, forceSpike: true }));
      assert.strictEqual(((await run.json()) as { summary: { totalAudited: number } }).summary.totalAudited, 1);
      const seenByB = JSON.stringify(await (await sentinelStatus.GET(get(B))).json());
      assert.ok(!seenByB.includes(id));
      assert.ok(!seenByB.includes(alertId));
      assert.ok(JSON.stringify(await (await sentinelStatus.GET(get(A))).json()).includes(alertId));
    }],
    ["User B cannot pay A's mandate through savings, by ID or by service name", async () => {
      const id = await createFor(A, { service: "Spotify Premium", status: "ACTIVE", budgetCeiling: 15, lastScrapedPrice: 11.99 });
      const body = { serviceName: "Spotify Premium", discountedPrice: 5.99, dealId: "deal-spotify-student" };
      assert.strictEqual((await savingsApply.POST(post(B, { ...body, mandateId: id }) as never)).status, 500);
      assert.strictEqual((await savingsApply.POST(post(B, body) as never)).status, 500);
      assert.strictEqual(txCount(id), 0);
      assert.strictEqual((await savingsApply.POST(post(A, { ...body, mandateId: id }) as never)).status, 200);
      assert.strictEqual(txCount(id), 1);
    }],
    ["the agent acts only for the verified user, whatever the model asks for", async () => {
      const id = await createFor(A, { status: "ACTIVE" });
      await createFor(B); // Creates the users row, as /api/chat does before running tools.
      await assert.rejects(
        dispatchAgentTool("execute_paypal_payment", { service_name: "x", verified_price: 40, budget_ceiling: 50, recipient_email: "a@b.test", mandate_id: id, owner_id: "user-a" }, "user-b"),
        /No payment was made: Spending rule not found/
      );
      assert.strictEqual(txCount(id), 0);
      const created = await dispatchAgentTool("create_mandate", { service: "Own", max_amount: 10, schedule: "Monthly", owner_id: "user-a" }, "user-b") as { mandate: { id: string } };
      assert.strictEqual(mandateRow(created.mandate.id)?.owner_id, "user-b");
      // The tool only quotes; only the owner's explicit confirmation pays.
      const quoted = await dispatchAgentTool("execute_paypal_payment", { service_name: "x", verified_price: 40, budget_ceiling: 50, recipient_email: "a@b.test", mandate_id: id }, "user-a");
      assert.strictEqual(txCount(id), 0);
      const { executeConfirmedMandatePayment } = await import("../payments/mandate-execution");
      const token = (quoted.quote as { confirmToken: string }).confirmToken;
      assert.strictEqual((await executeConfirmedMandatePayment(token, "user-b")).ok, false);
      assert.strictEqual(txCount(id), 0);
      assert.ok((await executeConfirmedMandatePayment(token, "user-a")).ok);
      assert.strictEqual(txCount(id), 1);
    }],
    ["the wrapper itself refuses the wrong owner", async () => {
      const id = await createFor(A, { status: "ACTIVE" });
      let charges = 0;
      const result = await executeAtomicPaymentTransaction({
        mandateId: id, ownerId: "user-b", orderId: "tmp", idempotencyKey: `w-${id}`, serviceName: "x", amount: 1, budgetCeiling: 50,
        allowedMandateStatuses: ["ACTIVE"],
        executePaymentFn: async () => { charges++; return { orderId: "o", captureId: "c", receipt: {} }; },
      });
      assert.strictEqual(result.status, "BLOCKED");
      assert.strictEqual(charges, 0);
    }],
    ["Telegram callbacks act only for the user bound to the chat", async () => {
      const ofB = await createFor(B);
      const ofA = await createFor(A);
      const update = (mandateId: string) => ({ callback_query: { id: "cb", data: `approve:${mandateId}:`, message: { chat: { id: 12345 } } } });
      const headers = { "x-telegram-bot-api-secret-token": "test-telegram-secret" };
      await webhook.POST(post(headers, update(ofB)));
      assert.strictEqual(txCount(ofB), 0);
      assert.strictEqual((await webhook.POST(post(headers, update(ofA)))).status, 200);
      assert.strictEqual(txCount(ofA), 1);
      delete process.env.TELEGRAM_OWNER_ID;
      assert.strictEqual((await webhook.POST(post(headers, update(ofA)))).status, 401);
      process.env.TELEGRAM_OWNER_ID = "user-a";
    }],
    ["legacy mandates with no owner are unusable by everyone and stay unassigned", async () => {
      for (const user of [A, B]) {
        assert.ok(!JSON.stringify(await (await mandatesRoute.GET(get(user))).json()).includes("legacy-1"));
        assert.strictEqual((await webhook.POST(post(user, { action: "approve", mandateId: "legacy-1" }))).status, 500);
      }
      assert.strictEqual(mandateRow("legacy-1")?.owner_id, null);
      assert.strictEqual(txCount("legacy-1"), 0);
    }],
    ["the owner foreign key rejects unknown users and blocks deleting an owner", async () => {
      raw.pragma("foreign_keys = ON");
      assert.throws(() => raw.prepare("UPDATE mandates SET owner_id = 'ghost' WHERE id = 'legacy-1'").run());
      assert.throws(() => raw.prepare("DELETE FROM users WHERE id = 'user-a'").run());
    }],
    ["demo and sandbox sessions keep mock features and separate data, but not real PayPal", async () => {
      const demo = { cookie: `${SESSION_COOKIE_NAME}=${encodeURIComponent(getJudgeDemoSession().accessToken)}` };
      const id = await createFor(demo);
      assert.strictEqual(mandateRow(id)?.owner_id, "usr_judge_paypal_hackathon");
      assert.strictEqual((await webhook.POST(post(demo, { action: "approve", mandateId: id }))).status, 200);
      assert.ok(!JSON.stringify(await (await mandatesRoute.GET(get(B))).json()).includes(id));

      // A second sandbox login with the same email gets a new ID and must still own its mandates.
      const repeat = {
        cookie: `${SESSION_COOKIE_NAME}=${encodeURIComponent(serializeSessionToken(createUserSession(
          { id: "usr_second_login", email: "user-a@example.test", fullName: "x", role: "user" }, true)))}`,
      };
      const repeatId = await createFor(repeat);
      assert.strictEqual(mandateRow(repeatId)?.owner_id, "usr_second_login");
      assert.ok(!JSON.stringify(await (await mandatesRoute.GET(get(repeat))).json()).includes(`"${id}"`));

      Object.assign(process.env, { PAYPAL_MODE: "real", PAYPAL_CLIENT_ID: "fake-client-id-123456", PAYPAL_CLIENT_SECRET: "fake-client-secret-123456" });
      assert.strictEqual((await mandatesRoute.GET(get(demo))).status, 403);
      assert.strictEqual((await webhook.POST(post(demo, { action: "approve", mandateId: id }))).status, 403);
      assert.strictEqual((await mandatesRoute.GET(get(repeat))).status, 403);
      delete process.env.AUTH_SECRET;
      assert.strictEqual((await mandatesRoute.GET(get(A))).status, 503, "real mode needs a private signing secret");
      Object.assign(process.env, { PAYPAL_MODE: "mock", AUTH_SECRET: "test-only-secret" });
    }],
    ["no request left the process", async () => {
      assert.strictEqual(outboundRequests, 0);
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
  process.exit(failed ? 1 : 0);
})().catch((error) => {
  console.error(error);
  process.exit(2);
});
