import { NextResponse } from "next/server";
import { db, mandates, transactions, auditLogs } from "@/db";
import { desc, eq, getTableColumns } from "drizzle-orm";
import { requireSession } from "@/lib/auth/require-session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  const ownerId = auth.session.user.id;

  try {
    const [allMandates, allTransactions, allAuditLogs] = await Promise.all([
      db.select().from(mandates).where(eq(mandates.ownerId, ownerId)).orderBy(desc(mandates.createdAt)),
      db
        .select(getTableColumns(transactions))
        .from(transactions)
        .innerJoin(mandates, eq(transactions.mandateId, mandates.id))
        .where(eq(mandates.ownerId, ownerId))
        .orderBy(desc(transactions.timestamp)),
      db
        .select(getTableColumns(auditLogs))
        .from(auditLogs)
        .innerJoin(mandates, eq(auditLogs.mandateId, mandates.id))
        .where(eq(mandates.ownerId, ownerId))
        .orderBy(desc(auditLogs.timestamp)),
    ]);

    // Map database models to UI models
    const mappedMandates = allMandates.map((m) => ({
      id: m.id,
      service: m.service,
      budgetCeiling: m.budgetCeiling,
      lastScrapedPrice: m.lastScrapedPrice,
      recurrence: m.recurrence,
      nextRun: m.nextRun,
      status: m.status,
      category: m.category,
      currency: m.currency,
      strictMode: m.strictMode,
      merchantUrl: m.merchantUrl,
    }));

    const mappedTransactions = allTransactions.map((t) => ({
      id: t.id,
      orderId: t.orderId,
      service: t.service,
      amount: t.amount,
      currency: t.currency,
      status: t.status,
      timestamp: t.timestamp,
      receiptData: t.receiptData ?? undefined,
    }));

    const mappedAuditLogs = allAuditLogs.map((l) => ({
      id: l.id,
      timestamp: l.timestamp,
      eventType: l.eventType as
        | "PRICE_VERIFIED"
        | "GUARDRAIL_BLOCKED"
        | "PAYMENT_CAPTURED"
        | "MANDATE_CREATED",
      service: l.service,
      details: l.details,
      severity: l.severity,
    }));

    return NextResponse.json({
      mandates: mappedMandates,
      transactions: mappedTransactions,
      auditLogs: mappedAuditLogs,
    });
  } catch (error) {
    console.error("Failed to load dashboard data from SQLite:", error);
    return NextResponse.json(
      { error: "Failed to load database records" },
      { status: 500 }
    );
  }
}
