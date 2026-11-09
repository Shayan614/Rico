/**
 * Development smoke test: inserts one mandate, reads it back, then deletes it.
 *
 *   npm run test:postgres
 *   npm run test:postgres -- --fail-after-insert   (proves cleanup runs on failure)
 */
import { randomUUID } from "crypto";
import assert from "assert";
import { eq } from "drizzle-orm";
import { pgDb, postgresClient, mandates, users, type NewMandateRecord } from "./postgres";

if (process.env.NODE_ENV === "production") {
  throw new Error("Refusing to run the smoke test with NODE_ENV=production");
}

const testId = `smoke-test-${randomUUID()}`;

const testOwnerId = `${testId}-owner`;

const testMandate: NewMandateRecord = {
  id: testId,
  ownerId: testOwnerId,
  service: "Smoke Test (safe to delete)",
  budgetCeiling: 12.34,
  recurrence: "monthly",
  nextRun: new Date().toISOString(),
};

async function runChecks() {
  await pgDb.insert(users).values({ id: testOwnerId, email: `${testId}@example.test` });
  await pgDb.insert(mandates).values(testMandate);
  console.log("Inserted", testId);

  if (process.argv.includes("--fail-after-insert")) {
    throw new Error("Simulated failure after insert");
  }

  const [row] = await pgDb.select().from(mandates).where(eq(mandates.id, testId));
  assert.ok(row, "inserted mandate was not found");

  assert.strictEqual(row.service, testMandate.service);
  assert.strictEqual(row.budgetCeiling, 12.34);
  // Database defaults and PostgreSQL-specific column types
  assert.strictEqual(row.lastScrapedPrice, 0);
  assert.strictEqual(row.status, "ACTIVE");
  assert.strictEqual(row.strictMode, false);
  assert.match(row.createdAt, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  console.log("Read back and verified");
}

async function cleanUp() {
  await pgDb.delete(mandates).where(eq(mandates.id, testId));
  await pgDb.delete(users).where(eq(users.id, testOwnerId));
  const remaining = await pgDb
    .select({ id: mandates.id })
    .from(mandates)
    .where(eq(mandates.id, testId));
  assert.strictEqual(remaining.length, 0, `cleanup failed: ${testId} still exists`);
  console.log("Cleaned up");
}

function reportFailure(step: string, error: unknown) {
  const { code, message } = error as { code?: string; message?: string };
  console.error(`${step} failed:`, code ?? message ?? error);
  process.exitCode = 1;
}

async function main() {
  try {
    await runChecks();
  } catch (error) {
    reportFailure("Smoke test", error);
  } finally {
    try {
      await cleanUp();
    } catch (error) {
      reportFailure("Cleanup", error);
    }
    await postgresClient.end({ timeout: 5 });
  }

  console.log(process.exitCode ? "FAILED" : "PASSED");
}

main();
