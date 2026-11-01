import { NextResponse } from "next/server";
import { db, mandates, transactions, auditLogs } from "@/db";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const allMandates = db
      .select()
      .from(mandates)
      .orderBy(desc(mandates.createdAt))
      .all();

    const allTransactions = db
      .select()
      .from(transactions)
      .orderBy(desc(transactions.timestamp))
      .all();

    const allAuditLogs = db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.timestamp))
      .all();

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
