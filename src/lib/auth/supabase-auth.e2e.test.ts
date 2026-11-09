/**
 * Real-user auth through the production server: signup, login, live session checks, revocation,
 * expiry, logout and cross-user isolation. Supabase Auth is a local fake that speaks its HTTP API,
 * so no real project, account or secret is used. Needs a prior `npm run build`.
 *
 *   npm run build && npm run test:supabase-auth
 */
import assert from "assert";
import { spawn } from "child_process";
import { randomUUID } from "crypto";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "fs";
import http from "http";
import os from "os";
import path from "path";
import Database from "better-sqlite3";

if (process.env.NODE_ENV === "production") throw new Error("Refusing to run with NODE_ENV=production");

// ---- Fake Supabase Auth (GoTrue) ----
type FakeUser = { id: string; email: string; password: string; confirmed: boolean };
const usersByEmail = new Map<string, FakeUser>();
const liveTokens = new Map<string, string>(); // access token -> user id
const calls: string[] = [];
let authDown = false;
let autoConfirm = true;
let nextExpiresIn = 3600;
// Refresh tokens rotate, as in GoTrue: each session has one current token, and reuse after the
// reuse window kills the whole session.
const refreshTokens = new Map<string, { userId: string; sid: string; rotatedAt?: number; child?: string }>();
const accessSessions = new Map<string, string>(); // access token -> session id
const deadSessions = new Set<string>();
let reuseWindowMs = 10_000;
let refreshDown = false;
let refreshAsOtherUser: FakeUser | null = null;
const refreshCalls = () => calls.filter((c) => c.includes("grant_type=refresh_token")).length;
const killSessionsOf = (userId: string) => {
  refreshTokens.forEach((t) => { if (t.userId === userId) deadSessions.add(t.sid); });
};

const userJson = (u: FakeUser) => ({
  id: u.id,
  aud: "authenticated",
  role: "authenticated",
  email: u.email,
  app_metadata: { provider: "email" },
  // Users can write user_metadata themselves, so the app must never trust a role here.
  user_metadata: { full_name: "Attacker", role: "admin" },
  created_at: new Date().toISOString(),
});
const issue = (u: FakeUser, sid: string = randomUUID(), existingRefresh?: string) => {
  const token = `at-${randomUUID()}`;
  liveTokens.set(token, u.id);
  accessSessions.set(token, sid);
  const refresh = existingRefresh ?? `rt-${randomUUID()}`;
  refreshTokens.set(refresh, refreshTokens.get(refresh) ?? { userId: u.id, sid });
  return {
    access_token: token,
    token_type: "bearer",
    expires_in: nextExpiresIn,
    expires_at: Math.floor(Date.now() / 1000) + nextExpiresIn,
    refresh_token: refresh,
    user: userJson(u),
  };
};

const fake = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const url = new URL(req.url || "", "http://x");
    calls.push(`${req.method} ${url.pathname}${url.search}`);
    const send = (status: number, json?: unknown) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(json === undefined ? "" : JSON.stringify(json));
    };
    if (req.headers.apikey !== "test-anon-key-0123456789") return send(401, { message: "Invalid API key" });
    const input = body ? JSON.parse(body) : {};
    const bearer = String(req.headers.authorization || "").replace(/^Bearer /, "");

    if (url.pathname === "/auth/v1/signup") {
      if (usersByEmail.has(input.email)) return send(200, { ...userJson(usersByEmail.get(input.email)!), id: randomUUID(), identities: [] });
      const u = { id: randomUUID(), email: input.email, password: input.password, confirmed: autoConfirm };
      usersByEmail.set(input.email, u);
      return send(200, autoConfirm ? issue(u) : userJson(u));
    }
    if (url.pathname === "/auth/v1/token" && url.searchParams.get("grant_type") === "refresh_token") {
      if (refreshDown) return send(503, { message: "unavailable" });
      const current = refreshTokens.get(input.refresh_token);
      if (!current || deadSessions.has(current.sid)) return send(400, { code: "refresh_token_not_found", message: "Invalid Refresh Token" });
      if (current.child) {
        if (Date.now() - current.rotatedAt! > reuseWindowMs) {
          deadSessions.add(current.sid);
          return send(400, { code: "refresh_token_already_used", message: "Invalid Refresh Token: Already Used" });
        }
        const owner = Array.from(usersByEmail.values()).find((x) => x.id === current.userId)!;
        return send(200, issue(owner, current.sid, current.child));
      }
      const owner = refreshAsOtherUser ?? Array.from(usersByEmail.values()).find((x) => x.id === current.userId)!;
      const next = issue(owner, current.sid);
      current.child = next.refresh_token;
      current.rotatedAt = Date.now();
      return send(200, next);
    }
    if (url.pathname === "/auth/v1/token") {
      const u = usersByEmail.get(input.email);
      if (!u || u.password !== input.password) return send(400, { code: "invalid_credentials", message: "Invalid login credentials" });
      if (!u.confirmed) return send(400, { code: "email_not_confirmed", message: "Email not confirmed" });
      return send(200, issue(u));
    }
    if (url.pathname === "/auth/v1/user") {
      if (authDown) return send(500, { message: "unavailable" });
      const id = liveTokens.get(bearer);
      if (!id || deadSessions.has(accessSessions.get(bearer) ?? "")) return send(403, { code: "session_not_found", message: "Session not found" });
      return send(200, userJson(Array.from(usersByEmail.values()).find((u) => u.id === id)!));
    }
    if (url.pathname === "/auth/v1/logout") {
      liveTokens.delete(bearer);
      deadSessions.add(accessSessions.get(bearer) ?? "");
      return send(204);
    }
    send(404, { message: "not found" });
  });
});

// ---- Temporary SQLite database with the real migration ----
const tempDir = mkdtempSync(path.join(os.tmpdir(), "rico-auth-"));
const sqlitePath = path.join(tempDir, "test.db");
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
`);
raw.exec(readFileSync(path.join(process.cwd(), "drizzle", "sqlite-manual", "0001_add_mandate_owner.sql"), "utf8"));

const PORT = 3200 + Math.floor(Math.random() * 500);
const BASE = `http://127.0.0.1:${PORT}`;
let server: ReturnType<typeof spawn> | null = null;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A tiny cookie jar per simulated browser. */
function browser() {
  let cookie = "";
  let refresh = "";
  return {
    get cookie() { return cookie; },
    set cookie(value: string) { cookie = value; },
    get refresh() { return refresh; },
    set refresh(value: string) { refresh = value; },
    async call(pathname: string, init: { method?: string; body?: unknown } = {}) {
      const response = await fetch(`${BASE}${pathname}`, {
        method: init.method || (init.body ? "POST" : "GET"),
        headers: { "content-type": "application/json", ...(cookie || refresh ? { cookie: [cookie, refresh].filter(Boolean).join("; ") } : {}) },
        body: init.body ? JSON.stringify(init.body) : undefined,
        redirect: "manual",
      });
      const set = response.headers.getSetCookie?.() ?? [];
      const bridge = set.find((c) => c.startsWith("rico_auth_session="));
      if (bridge) cookie = bridge.split(";")[0].endsWith("=") ? "" : bridge.split(";")[0];
      const rotated = set.find((c) => c.startsWith("rico_auth_refresh="));
      if (rotated) refresh = rotated.split(";")[0].endsWith("=") ? "" : rotated.split(";")[0];
      const text = await response.text();
      return { status: response.status, text, json: text.startsWith("{") ? JSON.parse(text) : null, setCookies: set };
    },
  };
}

(async () => {
  await new Promise<void>((r) => fake.listen(0, "127.0.0.1", () => r()));
  const fakeUrl = `http://127.0.0.1:${(fake.address() as { port: number }).port}`;

  // NEXT_PUBLIC_* values are baked in at build time and win over the env below. A build made with a
  // real project URL would send these test signups to that project, so refuse to run against it.
  const scan = (dir: string): string | null => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const hit = scan(full);
        if (hit) return hit;
      } else if (entry.name.endsWith(".js") && /https:\/\/[a-z0-9-]+\.supabase\.(co|in)/.test(readFileSync(full, "utf8"))) {
        return full;
      }
    }
    return null;
  };
  const baked = scan(path.join(process.cwd(), ".next", "server"));
  if (baked) {
    console.error(
      `REFUSING TO RUN: the build has a real Supabase URL baked in (${path.relative(process.cwd(), baked)}).\n` +
        "Run `npm run build:auth-test` first, then `npm run build` again before using the app."
    );
    process.exit(1);
  }

  // Explicit values override .env.local, so no real project, key or telemetry is used.
  server = spawn(process.execPath, [path.join("node_modules", "next", "dist", "bin", "next"), "start", "-p", String(PORT)], {
    env: {
      ...process.env,
      NODE_ENV: "production",
      SUPABASE_URL: fakeUrl,
      SUPABASE_ANON_KEY: "test-anon-key-0123456789",
      NEXT_PUBLIC_SUPABASE_URL: fakeUrl,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key-0123456789",
      SUPABASE_SESSION_CACHE_MS: "0",
      AUTH_SECRET: `test-${randomUUID()}`,
      DATABASE_PROVIDER: "sqlite",
      DATABASE_URL: sqlitePath,
      SUPABASE_DATABASE_URL: "",
      PAYPAL_MODE: "mock",
      PAYPAL_CLIENT_ID: "",
      PAYPAL_CLIENT_SECRET: "",
      POSTHOG_API_KEY: "",
      NEXT_PUBLIC_POSTHOG_KEY: "",
      GEMINI_API_KEY: "",
      TELEGRAM_BOT_TOKEN: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  server.stdout?.on("data", (d) => (log += d));
  server.stderr?.on("data", (d) => (log += d));
  for (let i = 0; i < 60; i++) {
    try { await fetch(`${BASE}/api/savings/deals`); break; } catch { await sleep(500); }
  }

  const userIdOf = (b: ReturnType<typeof browser>) =>
    JSON.parse(Buffer.from(decodeURIComponent(b.cookie.split("=")[1]).split(".")[0], "base64url").toString()).user.id as string;
  const row = (id: string) => raw.prepare("SELECT id, email, role FROM users WHERE id = ?").get(id) as { id: string; email: string; role: string } | undefined;

  const signIn = async (email: string, password: string) => {
    const b = browser();
    const res = await b.call("/api/auth/login", { body: { email, password } });
    assert.strictEqual(res.status, 200);
    return b;
  };
  /** Sends a chat message and returns the raw event stream. */
  const chat = async (b: ReturnType<typeof browser>, message: string) => {
    const res = await fetch(`${BASE}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: b.cookie },
      body: JSON.stringify({ message, strictMode: false, mandates: [] }),
    });
    assert.strictEqual(res.status, 200, `${message}: ${res.status}`);
    return res.text();
  };
  const countFor = (ownerId: string) => ({
    mandates: (raw.prepare("SELECT count(*) n FROM mandates WHERE owner_id = ?").get(ownerId) as { n: number }).n,
    transactions: (raw.prepare("SELECT count(*) n FROM transactions t JOIN mandates m ON m.id = t.mandate_id WHERE m.owner_id = ?").get(ownerId) as { n: number }).n,
  });

  const tests: Array<[string, () => Promise<void>]> = [
    ["signup with confirmation off: one users row with the Supabase ID, no tokens sent to the browser", async () => {
      const a = browser();
      const res = await a.call("/api/auth/signup", { body: { email: "alice@example.test", password: "pw-alice-1", fullName: "Alice" } });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.json.session.isSimulated, false);
      assert.strictEqual(res.json.needsEmailConfirmation, false);
      assert.strictEqual(res.json.session.accessToken, "");
      assert.ok(!/at-[0-9a-f-]{36}|rt-[0-9a-f-]{36}/.test(res.text), "no Supabase token in JSON");
      const id = userIdOf(a);
      assert.strictEqual(row(id)?.email, "alice@example.test");
      assert.strictEqual(row(id)?.role, "user", "user_metadata.role must be ignored");
      assert.strictEqual(res.json.user.role, "user");
      assert.strictEqual((await a.call("/api/mandates")).status, 200);
    }],
    ["login maps to the same row and never duplicates the user", async () => {
      const a = browser();
      assert.strictEqual((await a.call("/api/auth/login", { body: { email: "alice@example.test", password: "pw-alice-1" } })).status, 200);
      const before = (raw.prepare("SELECT count(*) n FROM users").get() as { n: number }).n;
      const again = browser();
      await again.call("/api/auth/login", { body: { email: "alice@example.test", password: "pw-alice-1" } });
      assert.strictEqual(userIdOf(a), userIdOf(again));
      assert.strictEqual((raw.prepare("SELECT count(*) n FROM users").get() as { n: number }).n, before);
      const session = await a.call("/api/auth/session");
      assert.strictEqual(session.json.authenticated, true);
      assert.strictEqual(session.json.session.accessToken, "");
      assert.ok(!/at-[0-9a-f-]{36}/.test(session.text));
    }],
    ["wrong password gets no session", async () => {
      const x = browser();
      const res = await x.call("/api/auth/login", { body: { email: "alice@example.test", password: "wrong" } });
      assert.strictEqual(res.status, 401);
      assert.strictEqual(x.cookie, "");
    }],
    ["two real users cannot see or pay with each other's mandates", async () => {
      const a = browser();
      const b = browser();
      await a.call("/api/auth/login", { body: { email: "alice@example.test", password: "pw-alice-1" } });
      await b.call("/api/auth/signup", { body: { email: "bob@example.test", password: "pw-bob-1" } });
      const created = await a.call("/api/mandates", { body: { id: "alice-m1", ownerId: userIdOf(b), service: "Test", budgetCeiling: 50, lastScrapedPrice: 40, status: "ANOMALY_HOLD" } });
      assert.strictEqual(created.status, 201);
      assert.strictEqual((raw.prepare("SELECT owner_id o FROM mandates WHERE id='alice-m1'").get() as { o: string }).o, userIdOf(a));
      assert.ok(!(await b.call("/api/mandates")).text.includes("alice-m1"));
      assert.ok(!(await b.call("/api/dashboard")).text.includes("alice-m1"));
      assert.notStrictEqual((await b.call("/api/sentinel/webhook", { body: { action: "approve", mandateId: "alice-m1" } })).status, 200);
      assert.strictEqual((await a.call("/api/sentinel/webhook", { body: { action: "approve", mandateId: "alice-m1" } })).status, 200);
    }],
    ["logout revokes the Supabase session, so a copied cookie stops working", async () => {
      const a = browser();
      await a.call("/api/auth/login", { body: { email: "alice@example.test", password: "pw-alice-1" } });
      const stolen = a.cookie;
      const logoutCalls = calls.filter((c) => c.startsWith("POST /auth/v1/logout")).length;
      assert.strictEqual((await a.call("/api/auth/logout", { method: "POST" })).status, 200);
      assert.strictEqual(calls.filter((c) => c.startsWith("POST /auth/v1/logout")).length, logoutCalls + 1);
      const thief = browser();
      thief.cookie = stolen;
      assert.strictEqual((await thief.call("/api/mandates")).status, 401);
      assert.strictEqual((await thief.call("/api/auth/session")).json.authenticated, false);
    }],
    ["revocation in Supabase (ban, password reset, admin sign-out) ends the app session", async () => {
      const a = browser();
      await a.call("/api/auth/login", { body: { email: "alice@example.test", password: "pw-alice-1" } });
      assert.strictEqual((await a.call("/api/mandates")).status, 200);
      for (const [token, id] of Array.from(liveTokens)) if (id === userIdOf(a)) liveTokens.delete(token);
      assert.strictEqual((await a.call("/api/mandates")).status, 401);
    }],
    ["the session ends when the Supabase access token expires", async () => {
      nextExpiresIn = 2;
      const c = browser();
      await c.call("/api/auth/signup", { body: { email: "carol@example.test", password: "pw-carol-1" } });
      nextExpiresIn = 3600;
      assert.strictEqual((await c.call("/api/mandates")).status, 200);
      await sleep(3000);
      assert.strictEqual((await c.call("/api/mandates")).status, 401);
    }],
    ["if Supabase cannot be reached, requests are refused rather than trusted", async () => {
      const a = browser();
      await a.call("/api/auth/login", { body: { email: "alice@example.test", password: "pw-alice-1" } });
      authDown = true;
      assert.strictEqual((await a.call("/api/mandates")).status, 503);
      authDown = false;
      assert.strictEqual((await a.call("/api/mandates")).status, 200);
    }],
    ["unconfirmed signup is mock-only and never stores the unverified email", async () => {
      autoConfirm = false;
      const d = browser();
      const res = await d.call("/api/auth/signup", { body: { email: "dave@example.test", password: "pw-dave-1" } });
      autoConfirm = true;
      assert.strictEqual(res.json.session.isSimulated, true);
      assert.strictEqual(res.json.needsEmailConfirmation, true);
      assert.strictEqual(row(userIdOf(d)), undefined);
      assert.strictEqual((await d.call("/api/mandates", { body: { id: "dave-m1", service: "x", budgetCeiling: 5 } })).status, 201);
      assert.strictEqual(row(userIdOf(d))?.email, `${userIdOf(d)}@sandbox.invalid`);
      assert.strictEqual((raw.prepare("SELECT count(*) n FROM users WHERE email = 'dave@example.test'").get() as { n: number }).n, 0);
    }],
    ["signing up with someone else's registered email gets no access to their account", async () => {
      const e = browser();
      const res = await e.call("/api/auth/signup", { body: { email: "alice@example.test", password: "guess" } });
      assert.strictEqual(res.json.session.isSimulated, true);
      assert.notStrictEqual(userIdOf(e), (raw.prepare("SELECT id FROM users WHERE email='alice@example.test'").get() as { id: string }).id);
      assert.ok(!(await e.call("/api/mandates")).text.includes("alice-m1"));
    }],
    ["passwordless sandbox login cannot claim a real user's email", async () => {
      const f = browser();
      const res = await f.call("/api/auth/login", { body: { email: "alice@example.test" } });
      assert.strictEqual(res.json.session.isSimulated, true);
      assert.strictEqual((raw.prepare("SELECT count(*) n FROM users WHERE email='alice@example.test'").get() as { n: number }).n, 1);
      assert.ok(!(await f.call("/api/mandates")).text.includes("alice-m1"));
    }],
    ["the demo login still works and stays mock-only", async () => {
      const j = browser();
      const res = await j.call("/api/auth/login", { body: { isDemo: true } });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.json.session.accessToken, "");
      assert.strictEqual((await j.call("/api/mandates")).status, 200);
    }],
    ["a forged or tampered cookie is rejected", async () => {
      const x = browser();
      const payload = Buffer.from(JSON.stringify({ user: { id: "x", email: "x@x", role: "admin" }, accessToken: "", expiresAt: Date.now() + 9e6, isSimulated: false })).toString("base64url");
      x.cookie = `rico_auth_session=${payload}.forged`;
      assert.strictEqual((await x.call("/api/mandates")).status, 401);
    }],
    // ---- Payment safety: chat never pays; only an explicit, server-confirmed run can.
    ["a new user's dashboard is genuinely empty, with no sample data", async () => {
      const erin = browser();
      await erin.call("/api/auth/signup", { body: { email: "erin@example.test", password: "pw-erin-1" } });
      const dash = await erin.call("/api/dashboard");
      assert.strictEqual(dash.status, 200);
      assert.deepStrictEqual([dash.json.mandates?.length ?? 0, dash.json.transactions?.length ?? 0, dash.json.auditLogs?.length ?? 0], [0, 0, 0]);
      assert.ok(!/Netflix|Spotify|Copilot|ORD-84920491/.test(dash.text));
    }],
    ["greetings, price questions, unknown services and running a missing rule never create or pay", async () => {
      const erin = await signIn("erin@example.test", "pw-erin-1");
      for (const message of [
        "Hello",
        "How much is Netflix?",
        "Can you pay Netflix now?",
        "Pay my landlord now",
        "Execute mandate now for Merchant Service",
        "Execute mandate now for Netflix Standard HD",
      ]) {
        const reply = await chat(erin, message);
        assert.ok(!reply.includes('"type":"receipt"'), `${message} produced a receipt`);
        assert.ok(!reply.includes('"type":"payment_confirmation"'), `${message} asked for a payment`);
      }
      assert.strictEqual(countFor(userIdOf(erin)).mandates, 0);
      assert.strictEqual(countFor(userIdOf(erin)).transactions, 0);
    }],
    ["creating a rule in chat does not pay", async () => {
      const erin = await signIn("erin@example.test", "pw-erin-1");
      const reply = await chat(erin, "Create a rule for Netflix, max $20 monthly");
      assert.ok(!reply.includes('"type":"receipt"'));
      assert.deepStrictEqual(countFor(userIdOf(erin)), { mandates: 1, transactions: 0 });
    }],
    ["running a rule in chat only asks for confirmation; confirming pays once and repeats say already paid", async () => {
      const erin = await signIn("erin@example.test", "pw-erin-1");
      const reply = await chat(erin, "Run Netflix now");
      const event = reply.split("\n").find((l) => l.includes('"type":"payment_confirmation"'));
      assert.ok(event, "no confirmation was requested");
      assert.strictEqual(countFor(userIdOf(erin)).transactions, 0, "asking must not pay");
      const quote = JSON.parse(event!.slice(6)).quote;
      assert.strictEqual(quote.service, "Netflix Standard HD");
      assert.strictEqual(quote.budgetCeiling, 20);
      assert.ok(quote.amount > 0 && quote.amount <= 20 && quote.currency === "USD");

      const paid = await erin.call("/api/payments/execute", { body: { confirmToken: quote.confirmToken } });
      assert.strictEqual(paid.status, 201, paid.text);
      assert.strictEqual(paid.json.receipt.mode, "SIMULATED_SANDBOX", "mock provider only");
      const again = await erin.call("/api/payments/execute", { body: { confirmToken: quote.confirmToken } });
      assert.strictEqual(again.status, 409);
      assert.strictEqual(again.json.code, "ALREADY_PAID");
      assert.match(again.json.error, /already paid for this billing period/);
      const requote = await erin.call("/api/payments/quote", { body: { mandateId: quote.mandateId } });
      assert.strictEqual(requote.json.code, "ALREADY_PAID");

      const tx = raw.prepare("SELECT status, idempotency_key k FROM transactions WHERE mandate_id = ?").all(quote.mandateId) as { status: string; k: string }[];
      assert.strictEqual(tx.length, 1, "recorded once");
      assert.strictEqual(tx[0].status, "COMPLETED");
      assert.match(tx[0].k, new RegExp(`^period:${quote.mandateId}:\\d{4}-\\d{2}$`));
      assert.strictEqual((await erin.call("/api/dashboard")).json.transactions.length, 1);
    }],
    ["another user cannot quote or execute someone else's rule", async () => {
      const erin = await signIn("erin@example.test", "pw-erin-1");
      const frank = browser();
      await frank.call("/api/auth/signup", { body: { email: "frank@example.test", password: "pw-frank-1" } });
      const created = await erin.call("/api/mandates", { body: { id: "erin-spotify", service: "Spotify Premium", budgetCeiling: 15, recurrence: "Monthly on 1st" } });
      assert.strictEqual(created.status, 201);
      assert.strictEqual((await frank.call("/api/payments/quote", { body: { mandateId: "erin-spotify" } })).status, 404);
      const quote = await erin.call("/api/payments/quote", { body: { mandateId: "erin-spotify" } });
      assert.strictEqual(quote.status, 200, quote.text);
      const stolen = await frank.call("/api/payments/execute", { body: { confirmToken: quote.json.quote.confirmToken } });
      assert.strictEqual(stolen.status, 400);
      assert.strictEqual(countFor(userIdOf(frank)).transactions, 0);
      assert.strictEqual((raw.prepare("SELECT count(*) n FROM transactions WHERE mandate_id='erin-spotify'").get() as { n: number }).n, 0);
    }],
    ["a cancelled or invalid confirmation charges nothing", async () => {
      const erin = await signIn("erin@example.test", "pw-erin-1");
      const quote = await erin.call("/api/payments/quote", { body: { mandateId: "erin-spotify" } });
      assert.strictEqual(quote.status, 200);
      // Cancelled: the token is simply never sent. Invalid ones are refused.
      for (const confirmToken of [undefined, "", "garbage", `${quote.json.quote.confirmToken}x`]) {
        const res = await erin.call("/api/payments/execute", { body: { confirmToken } });
        assert.strictEqual(res.status, 400, String(confirmToken));
      }
      assert.strictEqual((raw.prepare("SELECT count(*) n FROM transactions WHERE mandate_id='erin-spotify'").get() as { n: number }).n, 0);
      assert.strictEqual((await browser().call("/api/payments/quote", { body: { mandateId: "erin-spotify" } })).status, 401);
    }],
    // ---- Session refresh. The refresh token must stay server-side, in one sealed HttpOnly cookie.
    ["login stores no Supabase session in script-readable cookies, and the refresh token stays hidden", async () => {
      const email = "gina@example.test";
      const g = browser();
      const res = await g.call("/api/auth/signup", { body: { email, password: "pw-gina-1" } });
      const login = await g.call("/api/auth/login", { body: { email, password: "pw-gina-1" } });
      for (const r of [res, login]) {
        assert.deepStrictEqual(r.setCookies.filter((c) => c.startsWith("sb-")), [], "no sb-* session cookies");
        assert.ok(!/rt-[0-9a-f-]{36}/.test(r.text), "no refresh token in JSON");
        const cookie = r.setCookies.find((c) => c.startsWith("rico_auth_refresh="));
        assert.ok(cookie, "refresh cookie is set");
        assert.match(cookie!, /HttpOnly/i);
        assert.match(cookie!, /Secure/i);
        assert.match(cookie!, /SameSite=lax/i);
        assert.ok(!/rt-[0-9a-f-]{36}/.test(cookie!), "the refresh token is sealed inside the cookie");
      }
    }],
    ["after the access token expires, refresh restores the same user and rotates the token", async () => {
      nextExpiresIn = 2;
      const g = await signIn("gina@example.test", "pw-gina-1");
      nextExpiresIn = 3600;
      const id = userIdOf(g);
      const before = g.refresh;
      await sleep(3000);
      assert.strictEqual((await g.call("/api/mandates")).status, 401, "the expired access token alone is refused");
      const res = await g.call("/api/auth/refresh", { method: "POST" });
      assert.strictEqual(res.status, 200, res.text);
      assert.strictEqual(res.json.session.accessToken, "");
      assert.ok(!/(at|rt)-[0-9a-f-]{36}/.test(res.text), "no tokens in JSON");
      assert.notStrictEqual(g.refresh, before, "the refresh cookie rotated");
      assert.strictEqual(userIdOf(g), id);
      assert.strictEqual((await g.call("/api/mandates")).status, 200);
      for (const name of ["rico_auth_session=", "rico_auth_refresh="]) {
        assert.match(res.setCookies.find((c) => c.startsWith(name))!, /HttpOnly/i);
      }
    }],
    ["reloading the page after expiry restores the session from the refresh cookie", async () => {
      const g = await signIn("gina@example.test", "pw-gina-1");
      const id = userIdOf(g);
      g.cookie = ""; // The browser drops the bridge cookie when its Max-Age ends.
      const res = await g.call("/api/auth/session");
      assert.strictEqual(res.json.authenticated, true);
      assert.strictEqual(res.json.user.id, id);
      assert.ok(!/(at|rt)-[0-9a-f-]{36}/.test(res.text));
      assert.strictEqual((await g.call("/api/mandates")).status, 200);
    }],
    ["with no refresh cookie an expired session stays signed out", async () => {
      const g = await signIn("gina@example.test", "pw-gina-1");
      g.cookie = "";
      g.refresh = "";
      const before = refreshCalls();
      assert.strictEqual((await g.call("/api/auth/refresh", { method: "POST" })).status, 401);
      assert.strictEqual((await g.call("/api/auth/session")).json.authenticated, false);
      assert.strictEqual(refreshCalls(), before);
    }],
    ["a revoked session cannot refresh, and both cookies are cleared", async () => {
      const email = "hana@example.test";
      const h = browser();
      await h.call("/api/auth/signup", { body: { email, password: "pw-hana-1" } });
      killSessionsOf(userIdOf(h));
      h.cookie = "";
      const res = await h.call("/api/auth/refresh", { method: "POST" });
      assert.strictEqual(res.status, 401);
      assert.strictEqual(h.refresh, "");
      assert.match(res.setCookies.find((c) => c.startsWith("rico_auth_session="))!, /Max-Age=0/i);
      assert.strictEqual((await h.call("/api/mandates")).status, 401);
    }],
    ["a forged, tampered or reused refresh cookie is refused", async () => {
      const g = await signIn("gina@example.test", "pw-gina-1");
      const genuine = g.refresh;
      g.cookie = "";
      const before = refreshCalls();
      for (const value of ["rico_auth_refresh=garbage", "rico_auth_refresh=rt-00000000-0000-0000-0000-000000000000", `${genuine.slice(0, -2)}xx`]) {
        const x = browser();
        x.refresh = value;
        assert.strictEqual((await x.call("/api/auth/refresh", { method: "POST" })).status, 401, value);
      }
      assert.strictEqual(refreshCalls(), before, "sealed cookies that fail to open never reach Supabase");

      reuseWindowMs = 0;
      assert.strictEqual((await g.call("/api/auth/refresh", { method: "POST" })).status, 200);
      await sleep(5);
      const thief = browser();
      thief.refresh = genuine;
      assert.strictEqual((await thief.call("/api/auth/refresh", { method: "POST" })).status, 401, "a rotated token cannot be replayed");
      reuseWindowMs = 10_000;
      g.cookie = "";
      assert.strictEqual((await g.call("/api/auth/refresh", { method: "POST" })).status, 401, "replay ends the whole session");
    }],
    ["if Supabase is down, refresh says so and keeps the cookie for a retry", async () => {
      const g = await signIn("gina@example.test", "pw-gina-1");
      const kept = g.refresh;
      g.cookie = "";
      refreshDown = true;
      const res = await g.call("/api/auth/refresh", { method: "POST" });
      refreshDown = false;
      assert.strictEqual(res.status, 503);
      assert.strictEqual(g.refresh, kept);
      assert.strictEqual((await g.call("/api/auth/refresh", { method: "POST" })).status, 200);
    }],
    ["parallel refreshes from one browser share one Supabase call", async () => {
      const g = await signIn("gina@example.test", "pw-gina-1");
      g.cookie = "";
      const before = refreshCalls();
      const results = await Promise.all(Array.from({ length: 8 }, () => {
        const tab = browser();
        tab.refresh = g.refresh;
        return tab.call("/api/auth/refresh", { method: "POST" });
      }));
      assert.deepStrictEqual(results.map((r) => r.status), Array(8).fill(200));
      assert.strictEqual(refreshCalls(), before + 1);
    }],
    ["logout revokes the session, so a copied refresh cookie stops working", async () => {
      const g = await signIn("gina@example.test", "pw-gina-1");
      const copied = g.refresh;
      assert.strictEqual((await g.call("/api/auth/logout", { method: "POST" })).status, 200);
      assert.strictEqual(g.refresh, "", "the refresh cookie is cleared");
      const thief = browser();
      thief.refresh = copied;
      assert.strictEqual((await thief.call("/api/auth/refresh", { method: "POST" })).status, 401);
    }],
    ["logout still revokes when the access cookie has already expired", async () => {
      const g = await signIn("gina@example.test", "pw-gina-1");
      g.cookie = "";
      const copied = g.refresh;
      const logouts = calls.filter((c) => c.startsWith("POST /auth/v1/logout")).length;
      assert.strictEqual((await g.call("/api/auth/logout", { method: "POST" })).status, 200);
      assert.strictEqual(calls.filter((c) => c.startsWith("POST /auth/v1/logout")).length, logouts + 1);
      const thief = browser();
      thief.refresh = copied;
      assert.strictEqual((await thief.call("/api/auth/refresh", { method: "POST" })).status, 401);
    }],
    ["refresh cannot mix two users' sessions", async () => {
      const a = await signIn("gina@example.test", "pw-gina-1");
      const b = browser();
      await b.call("/api/auth/signup", { body: { email: "ivan@example.test", password: "pw-ivan-1" } });
      assert.strictEqual((await a.call("/api/mandates", { body: { id: "gina-m1", service: "Test", budgetCeiling: 5 } })).status, 201);

      // One user's bridge cookie with another user's refresh cookie is refused.
      const mixed = browser();
      mixed.cookie = b.cookie;
      mixed.refresh = a.refresh;
      const refused = await mixed.call("/api/auth/refresh", { method: "POST" });
      assert.strictEqual(refused.status, 401);
      assert.ok(!refused.text.includes("gina@example.test"));

      // If Supabase ever answered with a different user, no session is issued.
      const c = await signIn("gina@example.test", "pw-gina-1");
      c.cookie = "";
      refreshAsOtherUser = usersByEmail.get("ivan@example.test")!;
      const wrong = await c.call("/api/auth/refresh", { method: "POST" });
      refreshAsOtherUser = null;
      assert.strictEqual(wrong.status, 401);
      assert.strictEqual(c.cookie, "");

      // After refreshing, each user still sees only their own data.
      const a2 = await signIn("gina@example.test", "pw-gina-1");
      a2.cookie = "";
      b.cookie = "";
      await a2.call("/api/auth/refresh", { method: "POST" });
      await b.call("/api/auth/refresh", { method: "POST" });
      assert.notStrictEqual(userIdOf(a2), userIdOf(b));
      assert.ok((await a2.call("/api/mandates")).text.includes("gina-m1"));
      assert.ok(!(await b.call("/api/mandates")).text.includes("gina-m1"));
    }],
    ["a demo login drops any earlier user's refresh cookie", async () => {
      const g = await signIn("gina@example.test", "pw-gina-1");
      const res = await g.call("/api/auth/login", { body: { isDemo: true } });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(g.refresh, "");
    }],
    ["the server logged no unexpected errors", async () => {
      const unexpected = log.split("\n").filter((l) => /TypeError|ReferenceError|Unhandled/.test(l));
      assert.deepStrictEqual(unexpected, []);
    }],
  ];

  let failed = 0;
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
  await shutdown();
  process.exit(failed ? 1 : 0);
})().catch(async (error) => {
  console.error(error);
  await shutdown();
  process.exit(2);
});

async function shutdown() {
  server?.kill();
  await sleep(500);
  fake.close();
  raw.close();
  try { rmSync(tempDir, { recursive: true, force: true }); } catch {}
}
