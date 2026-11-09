/**
 * Fast checks with no database or network: chat intent, billing periods, and that the sidebar
 * cannot start a payment. Run: npm run test:payment-intent
 */
import assert from "assert";
import { readFileSync } from "fs";
import path from "path";
import { classifyChatIntent, detectKnownService } from "../gemini/intent";
import { billingPeriodLabel, billingPeriodOf, mandatePeriodKey } from "../safety/billing-period";

const tests: Array<[string, () => void]> = [
  ["greetings, questions and price checks are never create or execute", () => {
    for (const msg of [
      "Hello", "hi", "hey there", "help", "How much is Netflix?", "how much is netflix",
      "What's the price of Spotify Premium", "Check the price of Netflix", "Compare Netflix and Spotify",
      "Can you pay Netflix now?", "Should I run Netflix now?", "Tell me about my spending rules",
      "Netflix", "I like Netflix", "Show me my spending rules",
    ]) {
      const intent = classifyChatIntent(msg);
      assert.ok(intent === "info" || intent === "greeting", `${msg} -> ${intent}`);
    }
  }],
  ["only explicit wording creates a rule", () => {
    for (const msg of ["Create a rule for Netflix, max $20", "Add a new spending rule for Spotify", "Pay Netflix $15.99 on the 5th, max $20", "Netflix monthly, cap at $20"]) {
      assert.strictEqual(classifyChatIntent(msg), "create", msg);
    }
  }],
  ["only explicit wording asks to run a rule", () => {
    for (const msg of ["Execute mandate now for Netflix Standard HD", "Run Netflix now", "Pay Spotify now", "Execute the rule for Netflix"]) {
      assert.strictEqual(classifyChatIntent(msg), "execute", msg);
    }
  }],
  ["unknown services are not matched, and there is no generic fallback", () => {
    assert.strictEqual(detectKnownService("Pay my landlord now"), null);
    assert.strictEqual(detectKnownService("what's my balance"), null);
    assert.strictEqual(detectKnownService("How much is Netflix?")?.service, "Netflix Standard HD");
  }],
  ["billing periods follow each mandate's recurrence", () => {
    const now = new Date("2026-11-08T10:00:00Z");
    assert.strictEqual(billingPeriodOf("Monthly on 5th"), "monthly");
    assert.strictEqual(billingPeriodLabel("Monthly on 5th", now), "2026-11");
    assert.strictEqual(billingPeriodLabel("Weekly on Monday", now), "2026-W45");
    assert.strictEqual(billingPeriodLabel("Daily", now), "2026-11-08");
    assert.strictEqual(billingPeriodLabel("Quarterly", now), "2026-Q4");
    assert.strictEqual(billingPeriodLabel("Yearly on Jan 1", now), "2026");
    assert.strictEqual(billingPeriodLabel("Annual plan", now), "2026");
    assert.strictEqual(billingPeriodLabel("One-time purchase", now), "once");
    assert.strictEqual(billingPeriodLabel("whenever", now), "2026-11", "unknown defaults to monthly");
    assert.strictEqual(mandatePeriodKey({ id: "m1", recurrence: "Monthly on 5th" }, now), "period:m1:2026-11");
  }],
  ["period boundaries are in UTC, and ISO weeks span the new year", () => {
    assert.strictEqual(billingPeriodLabel("Monthly", new Date("2026-11-30T23:59:59Z")), "2026-11");
    assert.strictEqual(billingPeriodLabel("Monthly", new Date("2026-12-01T00:00:00Z")), "2026-12");
    assert.strictEqual(billingPeriodLabel("Weekly", new Date("2027-01-01T12:00:00Z")), "2026-W53");
    assert.strictEqual(billingPeriodLabel("Weekly", new Date("2027-01-04T12:00:00Z")), "2027-W01");
  }],
  ["selecting a sidebar rule cannot start a payment; only Run now can", () => {
    // Static check of the component source (no DOM test library is installed).
    const src = readFileSync(path.join(process.cwd(), "src/components/zephium/RicoFrame13Canvas.tsx"), "utf8");
    const select = src.match(/data-testid="sidebar-rule"\s*onClick=\{(.*)\}\r?\n/);
    assert.ok(select, "sidebar rule button not found");
    assert.match(select[1], /^\(\) => setActiveThread\(`mandate-\$\{idx\}`\)$/);
    assert.ok(!/Execute mandate now/.test(src), "the sidebar must not send execute messages");
    const run = src.match(/data-testid="sidebar-run-now"\s*onClick=\{(.*)\}\r?\n/);
    assert.ok(run && /onTriggerMandate\(mandate\.id\)/.test(run[1]), "Run now must go through onTriggerMandate");
  }],
  ["Run now and chat confirmations only reach the server through quote and execute", () => {
    const page = readFileSync(path.join(process.cwd(), "src/app/page.tsx"), "utf8");
    const trigger = page.slice(page.indexOf("const handleTriggerMandate"), page.indexOf("const handleApprove"));
    assert.ok(trigger.includes("/api/payments/quote") && !trigger.includes("sendMessage("), "Run now must quote, not chat");
    const approve = page.slice(page.indexOf("const handleApprove"), page.indexOf("const handleReject"));
    assert.ok(approve.includes("/api/payments/execute") && approve.includes("confirmToken"));
    assert.ok(!/fetch\("\/api\/transactions"/.test(page), "the browser must not record payments itself");
    assert.ok(!/fetch\("\/api\/audit-logs"[\s\S]{0,200}PAYMENT_CAPTURED/.test(page));
  }],
];

let failed = 0;
for (const [name, run] of tests) {
  try {
    run();
    console.log(`PASS ${name}`);
  } catch (error) {
    failed++;
    console.error(`FAIL ${name}\n`, error);
  }
}
console.log(`\n${tests.length - failed}/${tests.length} passed`);
process.exit(failed ? 1 : 0);
