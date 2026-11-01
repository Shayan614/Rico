import { NextResponse } from "next/server";
import { db, transactions } from "@/db";
import { desc } from "drizzle-orm";

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
    const id = body.id || `tx-${Date.now()}`;

    const newTx = {
      id,
      mandateId: body.mandateId || null,
      orderId: body.orderId,
      service: body.service,
      amount: Number(body.amount) || 0,
      currency: body.currency || "USD",
      status: (body.status || "COMPLETED") as "COMPLETED" | "PENDING" | "BLOCKED",
      timestamp:
        body.timestamp ||
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      receiptData: body.receiptData || null,
    };

    db.insert(transactions).values(newTx).run();

    return NextResponse.json({ transaction: newTx }, { status: 201 });
  } catch (error) {
    console.error("Failed to create transaction:", error);
    return NextResponse.json(
      { error: "Failed to create transaction" },
      { status: 500 }
    );
  }
}
