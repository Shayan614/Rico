import { NextResponse } from "next/server";
import { db, transactions } from "@/db";
import { desc } from "drizzle-orm";
import { executeAtomicPaymentTransaction } from "@/lib/safety";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const list = db
      .select()
      .from(transactions)
      .orderBy(desc(transactions.timestamp))
      .all();
    return NextResponse.json({ transactions: list });
  } catch (error) {
    console.error("Failed to query transactions:", error);
    return NextResponse.json(
      { error: "Failed to query transactions" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.orderId || !body.service || body.amount === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: orderId, service, and amount are mandatory." },
        { status: 400 }
      );
    }

    const amount = Number(body.amount) || 0;
    const budgetCeiling = Number(body.budgetCeiling) || amount;

    // Use Atomic Transaction Wrapper with Double-Billing Guard
    const atomicResult = await executeAtomicPaymentTransaction({
      mandateId: body.mandateId || undefined,
      orderId: body.orderId,
      idempotencyKey: body.idempotencyKey || undefined,
      serviceName: body.service,
      amount,
      currency: body.currency || "USD",
      budgetCeiling,
      receiptData: body.receiptData || null,
      allowDuplicateWithinWindow: Boolean(body.allowDuplicateWithinWindow),
    });

    if (!atomicResult.success) {
      const statusCode = atomicResult.status === "BLOCKED" ? 409 : 500;
      return NextResponse.json(
        {
          error: atomicResult.message,
          status: atomicResult.status,
          transactionId: atomicResult.transactionId,
        },
        { status: statusCode }
      );
    }

    return NextResponse.json(
      {
        transaction: {
          id: atomicResult.transactionId,
          orderId: atomicResult.orderId,
          service: body.service,
          amount,
          currency: body.currency || "USD",
          status: "COMPLETED",
          receiptData: atomicResult.receiptData,
        },
        message: atomicResult.message,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("Failed to execute atomic transaction:", error);
    const message = error instanceof Error ? error.message : "Failed to create transaction";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
