/**
 * Checks the configured connection supports what the payment path does. Every write happens in a
 * transaction that is rolled back, so nothing is left behind. No schema changes.
 *
 *   npm run probe:pooler
 */
import assert from "assert";
import { randomUUID } from "crypto";
import postgres from "postgres";

const url = process.env.SUPABASE_DATABASE_URL;
if (!url) throw new Error("SUPABASE_DATABASE_URL is missing");

const parsed = new URL(url);
const local = ["localhost", "127.0.0.1"].includes(parsed.hostname);
const options = { ssl: (local ? false : "require") as false | "require", prepare: false, connect_timeout: 10, onnotice: () => {} };
const clientA = postgres(url, { ...options, max: 1 });
const clientB = postgres(url, { ...options, max: 1 });
const pool = postgres(url, { ...options, max: 5 });

class Rollback extends Error {}
const rollingBack = (run: Promise<unknown>) => run.catch((e) => { if (!(e instanceof Rollback)) throw e; });
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const countUsers = async () => (await pool<{ n: number }[]>`SELECT count(*)::int n FROM users`)[0].n;

async function main() {
  const mode = parsed.port === "6543" ? "transaction pooler" : parsed.hostname.includes("pooler") ? "session pooler" : "direct";
  console.log(`connection: ${mode} (port ${parsed.port || "5432"})`);
  const before = await countUsers();

  const [info] = await pool`SELECT current_setting('server_version') v, current_setting('max_connections') m, current_setting('transaction_isolation') i`;
  console.log(`server ${info.v}, max_connections ${info.m}, isolation ${info.i}`);

  const id = `probe-${randomUUID()}`;
  const email = `${id}@probe.invalid`;

  // 1. Rollback really discards writes.
  await rollingBack(pool.begin(async (tx) => {
    await tx`INSERT INTO users (id, email) VALUES (${id}, ${email})`;
    assert.strictEqual((await tx`SELECT 1 FROM users WHERE id = ${id}`).length, 1);
    throw new Rollback();
  }));
  assert.strictEqual((await pool`SELECT 1 FROM users WHERE id = ${id}`).length, 0);
  console.log("PASS rollback discards writes");

  // 2. A competing unique insert on another connection waits, as a payment reservation does.
  let releaseA = () => {};
  let holdingA = () => {};
  const aHolds = new Promise<void>((resolve) => { holdingA = resolve; });
  const aReleased = new Promise<void>((resolve) => { releaseA = resolve; });
  const pidA = clientA.begin(async (tx) => {
    const [{ pid }] = await tx`SELECT pg_backend_pid() pid`;
    await tx`INSERT INTO users (id, email) VALUES (${id}, ${email})`;
    holdingA();
    await aReleased;
    console.log(`  connection A backend ${pid}`);
    throw new Rollback();
  });
  await aHolds;
  let bFinished = false;
  let bInserted = -1;
  const pidB = clientB.begin(async (tx) => {
    const [{ pid }] = await tx`SELECT pg_backend_pid() pid`;
    console.log(`  connection B backend ${pid}`);
    const rows = await tx`INSERT INTO users (id, email) VALUES (${id}, ${email}) ON CONFLICT DO NOTHING RETURNING id`;
    bInserted = rows.length;
    bFinished = true;
    throw new Rollback();
  });
  await sleep(1500);
  assert.strictEqual(bFinished, false, "competing insert must wait for the open transaction");
  releaseA();
  await rollingBack(pidA);
  await rollingBack(pidB);
  assert.strictEqual(bInserted, 1, "after the rollback the waiting insert proceeds");
  console.log("PASS competing insert waits across connections");

  // 3. The pool handles more parallel transactions than connections, as under payment bursts.
  await Promise.all(
    Array.from({ length: 24 }, (_, i) =>
      rollingBack(pool.begin(async (tx) => {
        const rowId = `${id}-${i}`;
        await tx`INSERT INTO users (id, email) VALUES (${rowId}, ${`${rowId}@probe.invalid`}) ON CONFLICT DO NOTHING`;
        await tx`SELECT id FROM users WHERE id = ${rowId} FOR UPDATE`;
        throw new Rollback();
      }))
    )
  );
  console.log("PASS 24 parallel transactions with row locks on a pool of 5");

  // 4. The driver works without prepared statements, as the app's pool is configured.
  await pool.unsafe("SELECT 1");
  console.log("PASS unprepared statements");

  const after = await countUsers();
  assert.strictEqual(after, before, "the probe must leave no rows");
  console.log(`PASS no rows left behind (users ${before} -> ${after})`);
}

main()
  .then(() => Promise.all([clientA.end(), clientB.end(), pool.end()]).then(() => process.exit(0)))
  .catch((error) => {
    console.error("PROBE FAILED:", error instanceof Error ? error.message : error);
    process.exit(1);
  });
