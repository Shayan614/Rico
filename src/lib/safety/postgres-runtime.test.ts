/**
 * Runs the real routes and callers with DATABASE_PROVIDER=postgres on a new throwaway database.
 * PayPal stays in mock mode, every outbound request fails, and the scraper is stubbed.
 *
 *   TEST_DATABASE_URL=postgres://user@127.0.0.1:5432/postgres npm run test:postgres-runtime
 *
 * Only a local server is accepted, because the test creates and drops a whole database.
 */
import assert from "assert";
import { execFileSync } from "child_process";
import { randomUUID } from "crypto";
import { readFileSync, readdirSync, statSync } from "fs";
import path from "path";
import { pathToFileURL } from "url";
import postgres from "postgres";

const adminUrl = process.env.TEST_DATABASE_URL;
if (!adminUrl) throw new Error("TEST_DATABASE_URL is required; refusing to run");
if (!["127.0.0.1", "localhost"].includes(new URL(adminUrl).hostname)) {
  throw new Error("This test creates and drops a database, so it only runs on a local server");
}
if (process.env.NODE_ENV === "production") throw new Error("Refusing to run with NODE_ENV=production");

const dbName = `rico_runtime_${randomUUID().replace(/-/g, "")}`;
const targetUrl = new URL(adminUrl);
targetUrl.pathname = `/${dbName}`;

Object.assign(process.env, {
  DATABASE_PROVIDER: "postgres",
  SUPABASE_DATABASE_URL: targetUrl.toString(),
  PAYPAL_MODE: "mock",
  AUTH_SECRET: "test-only-secret",
});
delete process.env.DATABASE_URL;
delete process.env.TELEGRAM_BOT_TOKEN;

let outbound = 0;
globalThis.fetch = (async () => {
  outbound++;
  throw new Error("Network is disabled in runtime tests");
}) as typeof fetch;

const admin = postgres(adminUrl, { max: 1, prepare: false, onnotice: () => {} });

(async () => {
  await admin.unsafe(`CREATE DATABASE "${dbName}"`);
  const direct = postgres(targetUrl.toString(), { max: 2, prepare: false, onnotice: () => {} });
  const folder = path.join(process.cwd(), "drizzle", "pg");
  const journal = JSON.parse(readFileSync(path.join(folder, "meta", "_journal.json"), "utf8"));
  for (const { tag } of journal.entries as { tag: string }[]) {
    for (const statement of readFileSync(path.join(folder, `${tag}.sql`), "utf8").split("--> statement-breakpoint")) {
      if (statement.includes("REVOKE ALL")) continue;
      await direct.unsafe(statement);
    }
  }
  await direct.unsafe(`
    CREATE FUNCTION fail_write() RETURNS trigger AS $$
    BEGIN RAISE EXCEPTION 'injected failure'; END $$ LANGUAGE plpgsql;
    CREATE TRIGGER fail_audit BEFORE INSERT ON audit_logs FOR EACH ROW
      WHEN (NEW.service = 'FAIL_AUDIT' AND NEW.event_type = 'PAYMENT_CAPTURED') EXECUTE FUNCTION fail_write();
  `);

  const { db, dbProvider, mandates } = await import("../../db");
  const { createUserSession, getJudgeDemoSession, serializeSessionToken, SESSION_COOKIE_NAME } = await import("../auth/session-bridge");
  const { executeAtomicPaymentTransaction } = await import("./atomic-transaction");
  const { dispatchAgentTool } = await import("../gemini/tool-executors");
  const { executeConfirmedMandatePayment } = await import("../payments/mandate-execution");
  const { geminiAgent } = await import("../gemini");
  const { priceWorker } = await import("../browser");
  const { ensureOwnerRecord } = await import("../auth/require-session");
  const { eq } = await import("drizzle-orm");
  const mandatesRoute = await import("../../app/api/mandates/route");
  const dashboardRoute = await import("../../app/api/dashboard/route");
  const txRoute = await import("../../app/api/transactions/route");
  const auditRoute = await import("../../app/api/audit-logs/route");
  const webhook = await import("../../app/api/sentinel/webhook/route");
  const sentinelRun = await import("../../app/api/sentinel/run/route");
  const sentinelStatus = await import("../../app/api/sentinel/status/route");
  const savingsApply = await import("../../app/api/savings/apply/route");
  const savingsProbe = await import("../../app/api/savings/probe/route");
  const loginRoute = await import("../../app/api/auth/login/route");

  (priceWorker as unknown as { scrapeMerchantPrice: unknown }).scrapeMerchantPrice = async () => ({
    price: 40, currency: "USD", planName: "Plan", service: "Test", source: "live_browser", confidence: 1,
  });

  const session = (id: string, email: string, simulated = false) =>
    createUserSession({ id, email, fullName: id, role: "user" }, simulated);
  const cookie = (s: ReturnType<typeof session>) => ({
    cookie: `${SESSION_COOKIE_NAME}=${encodeURIComponent(serializeSessionToken(s))}`,
  });
  const userA = "11111111-1111-4111-8111-111111111111";
  const userB = "22222222-2222-4222-8222-222222222222";
  const sessionA = session(userA, "a@example.test");
  const sessionB = session(userB, "b@example.test");
  const A = cookie(sessionA);
  const B = cookie(sessionB);
  const post = (headers: Record<string, string>, body: unknown) =>
    new Request("http://test.local/api", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
  const get = (headers: Record<string, string> = {}) => new Request("http://test.local/api", { headers });

  let n = 0;
  async function createFor(headers: Record<string, string>, over: Record<string, unknown> = {}) {
    const id = `m-${++n}`;
    const response = await mandatesRoute.POST(post(headers, { id, service: "Test Service", budgetCeiling: 50, lastScrapedPrice: 40, status: "ANOMALY_HOLD", strictMode: false, ...over }));
    assert.strictEqual(response.status, 201);
    return id;
  }
  const row = async (id: string) => (await direct`SELECT * FROM mandates WHERE id = ${id}`)[0];
  const txRows = (id: string) => direct`SELECT * FROM transactions WHERE mandate_id = ${id}`;

  const tests: Array<[string, () => Promise<void>]> = [
    ["PostgreSQL mode opens no SQLite file or driver", async () => {
      assert.strictEqual(dbProvider, "postgres");
      assert.ok(!Object.keys(require.cache).some((p) => p.includes("better-sqlite3")));
    }],
    ["SQLite stays the default, and bad settings stop startup instead of falling back", async () => {
      const run = (env: Record<string, string | undefined>) => {
        const clean: NodeJS.ProcessEnv = { ...process.env, ...env, NODE_ENV: "test" };
        for (const [k, v] of Object.entries(env)) if (v === undefined) delete clean[k];
        return execFileSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e",
          `const m = await import(${JSON.stringify(pathToFileURL(path.join(process.cwd(), "src/db/index.ts")).href)}); console.log("PROVIDER=" + (m.dbProvider ?? m.default?.dbProvider)); process.exit(0);`],
          { env: clean, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      };
      const temp = path.join(process.env.TEMP || process.env.TMPDIR || ".", `rico-default-${randomUUID()}.db`);
      assert.match(run({ DATABASE_PROVIDER: undefined, DATABASE_URL: temp, SUPABASE_DATABASE_URL: undefined }), /PROVIDER=sqlite/);
      assert.throws(() => run({ DATABASE_PROVIDER: "postgres", SUPABASE_DATABASE_URL: undefined }), /SUPABASE_DATABASE_URL is missing/);
      assert.throws(() => run({ DATABASE_PROVIDER: "postgress", DATABASE_URL: temp }), /DATABASE_PROVIDER must be/);
    }],
    ["production code uses no SQLite-only synchronous database calls", async () => {
      const offenders: string[] = [];
      const walk = (dir: string) => {
        for (const name of readdirSync(dir)) {
          const file = path.join(dir, name);
          if (statSync(file).isDirectory()) { walk(file); continue; }
          if (!/\.tsx?$/.test(name) || /test|smoke|probe|seed/.test(name)) continue;
          const text = readFileSync(file, "utf8");
          if (!/@\/db|\/db"|db\/index/.test(text)) continue;
          if (/\.(run|all|get)\(\)/.test(text.replace(/sqliteRecordPayment[\s\S]*?\/\/ end sqliteRecordPayment/, ""))) offenders.push(file);
        }
      };
      walk(path.join(process.cwd(), "src"));
      assert.deepStrictEqual(offenders, []);
    }],
    ["payments fail closed when a safeguard is missing, then recover once it is restored", async () => {
      await createFor(A, { id: "safety-check", status: "ACTIVE" });
      await direct.unsafe(`DROP INDEX transactions_mandate_pending_uq`);
      let charges = 0;
      const attempt = () => executeAtomicPaymentTransaction({
        mandateId: "safety-check", ownerId: userA, allowedMandateStatuses: ["ACTIVE"], orderId: "tmp",
        idempotencyKey: "safety-key", serviceName: "x", amount: 1, budgetCeiling: 50,
        executePaymentFn: async () => { charges++; return { orderId: "safety-order", captureId: "c", receipt: {} }; },
      });
      const blocked = await attempt();
      assert.strictEqual(blocked.status, "BLOCKED");
      assert.match(blocked.message, /Payment safety could not be initialized/);
      assert.strictEqual(charges, 0);
      assert.strictEqual((await txRows("safety-check")).length, 0);

      await direct.unsafe(`CREATE UNIQUE INDEX transactions_mandate_pending_uq ON transactions (mandate_id) WHERE mandate_id IS NOT NULL AND status = 'PENDING'`);
      assert.strictEqual((await attempt()).status, "COMPLETED");
      assert.strictEqual(charges, 1);
    }],
    ["real PayPal stays disabled even with credentials and a healthy database", async () => {
      Object.assign(process.env, { PAYPAL_MODE: "real", PAYPAL_CLIENT_ID: "fake-client-id-123456", PAYPAL_CLIENT_SECRET: "fake-client-secret-123456" });
      let charges = 0;
      const result = await executeAtomicPaymentTransaction({
        orderId: "tmp", idempotencyKey: "real-off", serviceName: "x", amount: 1, budgetCeiling: 50,
        executePaymentFn: async () => { charges++; return { orderId: "o", captureId: "c", receipt: {} }; },
      });
      process.env.PAYPAL_MODE = "mock";
      assert.strictEqual(result.status, "BLOCKED");
      assert.match(result.message, /disabled/);
      assert.strictEqual(charges, 0);
    }],
    ["creating a mandate stores the verified owner and the right column types", async () => {
      const id = await createFor(A, { ownerId: userB, strictMode: true, merchantUrl: "https://example.test" });
      const stored = await row(id);
      assert.strictEqual(stored.owner_id, userA);
      assert.strictEqual(stored.strict_mode, true);
      const [viaApp] = await db.select().from(mandates).where(eq(mandates.id, id));
      assert.strictEqual(typeof viaApp.budgetCeiling, "number");
      assert.strictEqual(viaApp.strictMode, true);
      assert.strictEqual(typeof viaApp.createdAt, "string");
      assert.match(viaApp.createdAt, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    }],
    ["Supabase users map to one row, even when first requests race", async () => {
      const id = "33333333-3333-4333-8333-333333333333";
      const s = session(id, "race@example.test");
      await Promise.all(Array.from({ length: 10 }, () => ensureOwnerRecord(s)));
      assert.strictEqual((await direct`SELECT 1 FROM users WHERE id = ${id}`).length, 1);
      assert.strictEqual((await direct`SELECT 1 FROM users WHERE email = 'race@example.test'`).length, 1);
    }],
    ["a sandbox login cannot squat a real user's email", async () => {
      const email = "victim@example.test";
      const response = await loginRoute.POST(post({}, { email }));
      assert.strictEqual(response.status, 200);
      assert.strictEqual((await direct`SELECT 1 FROM users WHERE email = ${email}`).length, 0);
      const real = "44444444-4444-4444-8444-444444444444";
      await createFor(cookie(session(real, email)));
      const [stored] = await direct`SELECT id FROM users WHERE email = ${email}`;
      assert.strictEqual(stored.id, real);
    }],
    ["an older sandbox row holding an email gives way to the real account", async () => {
      const email = "reclaim@example.test";
      await direct`INSERT INTO users (id, email) VALUES ('usr_1700000000000_abcde', ${email})`;
      const real = "55555555-5555-4555-8555-555555555555";
      await createFor(cookie(session(real, email)));
      assert.strictEqual((await direct`SELECT id FROM users WHERE email = ${email}`)[0].id, real);
      assert.strictEqual((await direct`SELECT 1 FROM users WHERE id = 'usr_1700000000000_abcde'`).length, 1);
    }],
    ["another real account's email is refused, not merged", async () => {
      const s1 = session("66666666-6666-4666-8666-666666666666", "taken@example.test");
      await ensureOwnerRecord(s1);
      await assert.rejects(ensureOwnerRecord(session("77777777-7777-4777-8777-777777777777", "taken@example.test")), /already linked/);
    }],
    ["all routes read and write on PostgreSQL, scoped to the owner", async () => {
      await createFor(B); // creates B's users row
      const id = await createFor(A);
      assert.strictEqual((await webhook.POST(post(A, { action: "approve", mandateId: id }))).status, 200);
      const [tx] = await txRows(id);
      assert.strictEqual(tx.status, "COMPLETED");
      assert.strictEqual(typeof tx.receipt_data, "object");
      assert.strictEqual((await auditRoute.POST(post(A, { mandateId: id, eventType: "PRICE_VERIFIED", service: "x", details: "mine", metadata: { a: 1 } }))).status, 201);
      // The mandate was already paid this billing period, so a second record for it is refused.
      assert.strictEqual((await txRoute.POST(post(A, { mandateId: id, orderId: `rec-${id}`, service: "x", amount: 1, allowDuplicateWithinWindow: true }))).status, 409);
      assert.strictEqual((await txRows(id)).length, 1);

      const dash = await (await dashboardRoute.GET(get(A))).json() as { mandates: { id: string; strictMode: unknown }[]; transactions: { receiptData?: { orderId?: string } }[]; auditLogs: unknown[] };
      assert.ok(dash.mandates.some((m) => m.id === id));
      assert.ok(dash.mandates.every((m) => typeof m.strictMode === "boolean"));
      assert.ok(dash.transactions.some((t) => t.receiptData?.orderId));
      assert.ok(dash.auditLogs.length > 0);
      for (const route of [mandatesRoute, txRoute, auditRoute]) {
        assert.strictEqual((await route.GET(get(A))).status, 200);
        assert.ok(!JSON.stringify(await (await route.GET(get(B))).json()).includes(id));
      }
      assert.ok(!JSON.stringify(await (await dashboardRoute.GET(get(B))).json()).includes(id));
    }],
    ["User B cannot read, modify, cancel or pay using User A's mandate", async () => {
      const id = await createFor(A);
      const before = await row(id);
      for (const action of ["cancel", "approve", "backup_card"]) {
        assert.strictEqual((await webhook.POST(post(B, { action, mandateId: id }))).status, 500);
      }
      const run = await sentinelRun.POST(post(B, { mandateId: id, forceSpike: true }));
      assert.strictEqual(((await run.json()) as { summary: { totalAudited: number } }).summary.totalAudited, 0);
      assert.strictEqual((await auditRoute.POST(post(B, { mandateId: id, eventType: "PRICE_VERIFIED", service: "x", details: "f" }))).status, 404);
      assert.strictEqual((await txRoute.POST(post(B, { mandateId: id, orderId: "f", service: "x", amount: 1 }))).status, 404);
      assert.strictEqual((await savingsProbe.POST(post(B, { service: "x", mandateId: id }) as never)).status, 404);
      await assert.rejects(dispatchAgentTool("execute_paypal_payment", { service_name: "x", verified_price: 40, budget_ceiling: 50, recipient_email: "a@b.test", mandate_id: id }, userB));
      assert.deepStrictEqual(await row(id), before);
      assert.strictEqual((await txRows(id)).length, 0);
    }],
    ["the owner must exist: PostgreSQL enforces the foreign key", async () => {
      await assert.rejects(direct`INSERT INTO mandates (id, owner_id, service, budget_ceiling, recurrence, next_run) VALUES ('fk', 'ghost', 'x', 1, 'm', 'n')`);
      await assert.rejects(direct`INSERT INTO mandates (id, service, budget_ceiling, recurrence, next_run) VALUES ('fk', 'x', 1, 'm', 'n')`);
      await assert.rejects(direct`DELETE FROM users WHERE id = ${userA}`);
    }],
    ["Sentinel audits, alerts and cancels on PostgreSQL", async () => {
      const id = await createFor(A, { status: "ACTIVE", budgetCeiling: 100, lastScrapedPrice: 40 });
      const run = await sentinelRun.POST(post(A, { mandateId: id, forceSpike: true }));
      const summary = ((await run.json()) as { summary: { anomaliesDetected: number; audits: { alertId?: string }[] } }).summary;
      assert.strictEqual(summary.anomaliesDetected, 1);
      assert.strictEqual((await row(id)).status, "ANOMALY_HOLD");
      assert.ok(JSON.stringify(await (await sentinelStatus.GET(get(A))).json()).includes(summary.audits[0].alertId!));
      assert.strictEqual((await webhook.POST(post(A, { action: "cancel", mandateId: id }))).status, 200);
      assert.strictEqual((await row(id)).status, "PAUSED");
    }],
    ["savings and agent tools pay through the reservation path", async () => {
      const spotify = await createFor(A, { service: "Spotify Premium", status: "ACTIVE", budgetCeiling: 15, lastScrapedPrice: 11.99 });
      assert.strictEqual((await savingsApply.POST(post(A, { serviceName: "Spotify Premium", discountedPrice: 5.99, mandateId: spotify, dealId: "deal-spotify-student" }) as never)).status, 200);
      const [saving] = await txRows(spotify);
      assert.strictEqual(saving.amount, 5.99);
      assert.ok(String(saving.idempotency_key).startsWith(`period:${spotify}:`));

      // The agent tool only quotes; the user confirmed execution pays once per billing period.
      const agent = await createFor(A, { status: "ACTIVE" });
      const quoted = await dispatchAgentTool("execute_paypal_payment", { service_name: "x", verified_price: 40, budget_ceiling: 50, recipient_email: "a@b.test", mandate_id: agent }, userA);
      assert.strictEqual((await txRows(agent)).length, 0);
      const token = (quoted.quote as { confirmToken: string }).confirmToken;
      assert.ok((await executeConfirmedMandatePayment(token, userA)).ok);
      assert.ok(String((await txRows(agent))[0].idempotency_key).startsWith(`period:${agent}:`));
      assert.strictEqual((await executeConfirmedMandatePayment(token, userA)).ok, false);
      assert.strictEqual((await txRows(agent)).length, 1);
    }],
    ["the chat agent creates rules and quotes on PostgreSQL, but never pays", async () => {
      const events = [];
      for await (const event of geminiAgent.streamResponse("Pay Netflix $40.00 on 5th, max $50.00", { ownerId: userA, strictMode: false })) events.push(event);
      assert.ok(!events.some((e) => e.type === "receipt"), "a chat message must not pay");
      const run = [];
      for await (const event of geminiAgent.streamResponse("Run Netflix now", { ownerId: userA, strictMode: false })) run.push(event);
      assert.ok(run.some((e) => e.type === "payment_confirmation"), "expected a quote to confirm");
      assert.ok(!run.some((e) => e.type === "receipt"));
    }],
    ["concurrent requests through the real pool of 5 charge once", async () => {
      const id = await createFor(A);
      const results = await Promise.all(
        Array.from({ length: 24 }, (_, i) => webhook.POST(post(A, { action: i % 2 ? "approve" : "backup_card", mandateId: id })))
      );
      assert.strictEqual(results.filter((r) => r.status === 200).length, 1);
      const rows = await txRows(id);
      assert.strictEqual(rows.filter((r) => r.status === "COMPLETED").length, 1);
      assert.strictEqual(rows.length, 1);
    }],
    ["a failed commit on the record path rolls back everything", async () => {
      const id = await createFor(A, { status: "ACTIVE", service: "FAIL_AUDIT" });
      const before = await row(id);
      const result = await executeAtomicPaymentTransaction({ mandateId: id, orderId: `rb-${id}`, serviceName: "FAIL_AUDIT", amount: 3, budgetCeiling: 50 });
      assert.strictEqual(result.status, "FAILED");
      assert.strictEqual((await txRows(id)).length, 0);
      assert.deepStrictEqual(await row(id), before);
    }],
    ["a captured payment with a failed commit stays PENDING", async () => {
      const id = await createFor(A, { service: "FAIL_AUDIT" });
      const result = await executeAtomicPaymentTransaction({
        mandateId: id, ownerId: userA, allowedMandateStatuses: ["ANOMALY_HOLD"], orderId: "tmp", idempotencyKey: `pend-${id}`,
        serviceName: "FAIL_AUDIT", amount: 3, budgetCeiling: 50,
        executePaymentFn: async () => ({ orderId: `cap-${id}`, captureId: "c", receipt: { orderId: `cap-${id}` } }),
      });
      assert.strictEqual(result.status, "NEEDS_RECONCILIATION");
      assert.strictEqual(result.paymentOutcome, "CAPTURED");
      assert.strictEqual((await txRows(id))[0].status, "PENDING");
    }],
    ["the demo account works in mock mode and is refused in real mode", async () => {
      const demo = { cookie: `${SESSION_COOKIE_NAME}=${encodeURIComponent(getJudgeDemoSession().accessToken)}` };
      assert.strictEqual((await loginRoute.POST(post({}, { isDemo: true }))).status, 200);
      const id = await createFor(demo);
      assert.strictEqual((await webhook.POST(post(demo, { action: "approve", mandateId: id }))).status, 200);
      Object.assign(process.env, { PAYPAL_MODE: "real" });
      assert.strictEqual((await webhook.POST(post(demo, { action: "approve", mandateId: id }))).status, 403);
      process.env.PAYPAL_MODE = "mock";
    }],
    ["no request left the process", async () => {
      assert.strictEqual(outbound, 0);
    }],
  ];

  let failed = 0;
  const keepAlive = setInterval(() => {}, 1000);
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
  clearInterval(keepAlive);

  const { postgresClient } = await import("../../db/postgres");
  await postgresClient.end();
  await direct.end();
  await admin.unsafe(`DROP DATABASE "${dbName}" WITH (FORCE)`);
  await admin.end();
  process.exit(failed ? 1 : 0);
})().catch(async (error) => {
  console.error(error);
  await admin.unsafe(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`).catch(() => {});
  process.exit(2);
});
