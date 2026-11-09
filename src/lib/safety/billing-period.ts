/**
 * Billing periods for mandate payments. Every path that charges a mandate uses
 * mandatePeriodKey() as its idempotency key, so the database's unique index on active
 * idempotency keys (PENDING or COMPLETED) allows at most one charge per mandate per period,
 * whichever entry point (manual run, chat, savings, Sentinel approval) makes it.
 */

export type BillingPeriod = "once" | "daily" | "weekly" | "monthly" | "quarterly" | "yearly";

/**
 * Reads the period from a mandate's free-text recurrence ("Monthly on 5th", "Weekly", ...).
 * Anything unrecognised is treated as monthly, the most common and a conservative default.
 */
export function billingPeriodOf(recurrence: string | null | undefined): BillingPeriod {
  const r = (recurrence ?? "").toLowerCase();
  if (/\b(once|one[- ]time|single)\b/.test(r)) return "once";
  if (/\b(daily|every day|each day|per day)\b/.test(r)) return "daily";
  if (/\b(weekly|every week|each week|per week)\b/.test(r)) return "weekly";
  if (/\b(quarterly|every quarter|each quarter|per quarter)\b/.test(r)) return "quarterly";
  if (/\b(yearly|annual|annually|every year|each year|per year)\b/.test(r)) return "yearly";
  return "monthly";
}

const pad = (n: number) => String(n).padStart(2, "0");

/** ISO-8601 week number and week-year, in UTC. */
function isoWeek(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  return { year: d.getUTCFullYear(), week: Math.ceil(((d.getTime() - yearStart) / 86400000 + 1) / 7) };
}

/** The current period's label in UTC, e.g. "2026-11", "2026-W45", "2026-Q4". */
export function billingPeriodLabel(recurrence: string | null | undefined, now = new Date()): string {
  const y = now.getUTCFullYear();
  switch (billingPeriodOf(recurrence)) {
    case "once":
      return "once";
    case "daily":
      return `${y}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}`;
    case "weekly": {
      const { year, week } = isoWeek(now);
      return `${year}-W${pad(week)}`;
    }
    case "quarterly":
      return `${y}-Q${Math.floor(now.getUTCMonth() / 3) + 1}`;
    case "yearly":
      return `${y}`;
    default:
      return `${y}-${pad(now.getUTCMonth() + 1)}`;
  }
}

/** The idempotency key shared by every charge of this mandate in the current period. */
export function mandatePeriodKey(
  mandate: { id: string; recurrence: string | null | undefined },
  now = new Date()
): string {
  return `period:${mandate.id}:${billingPeriodLabel(mandate.recurrence, now)}`;
}
