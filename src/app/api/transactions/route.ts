import { NextResponse } from "next/server";
import { db, mandates, transactions } from "@/db";
import { desc, eq, getTableColumns } from "drizzle-orm";
import { payPalOAuth } from "@/lib/paypal";
import { getOwnedMandate } from "@/lib/safety/mandate-access";
import { requireSession } from "@/lib/auth/require-session";
import { executeAtomicPaymentTransaction } from "@/lib/safety";
import { mandatePeriodKey } from "@/lib/safety/billing-period";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;

  try {
    // Transactions with no mandate have no owner, so they are returned to nobody.
    const list = await db
      .select(getTableColumns(transactions))
      .from(transactions)
      .innerJoin(mandates, eq(transactions.mandateId, mandates.id))
      .where(eq(mandates.ownerId, auth.session.user.id))
      .orderBy(desc(transactions.timestamp));
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
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;

  // This route records a payment without charging, so it is for mock demos only.
  if (payPalOAuth.getMode() === "real") {
    return NextResponse.json(
      { error: "Recording transactions directly is disabled in real PayPal mode." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();

    const ownedMandate = body.mandateId
      ? await getOwnedMandate(String(body.mandateId), auth.session.user.id)
      : undefined;
    if (body.mandateId && !ownedMandate) {
      return NextResponse.json({ error: "Mandate not found" }, { status: 404 });
    }

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
      // A mandate's records share its billing-period key with every payment path. Otherwise the
      // key is scoped per user, so one user's key can neither collide with nor reveal another's.
      idempotencyKey: ownedMandate
        ? mandatePeriodKey(ownedMandate)
        : body.idempotencyKey
        ? `user:${auth.session.user.id}:${body.idempotencyKey}`
        : undefined,
      serviceName: body.service,
      amount,
      currency: body.currency || "USD",
      budgetCeiling,
      receiptData: body.receiptData || null,
      allowDuplicateWithinWindow: Boolean(body.allowDuplicateWithinWindow),
    });

    if (!atomicResult.success) {
      const statusCode = atomicResult.status === "BLOCKED" ? 409 : 500;
      // A duplicate order ID may belong to another user, so its details are withheld.
      return NextResponse.json(
        {
          error:
            atomicResult.status === "BLOCKED"
              ? "This payment was rejected as a duplicate or by a guardrail."
              : atomicResult.message,
          status: atomicResult.status,
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
