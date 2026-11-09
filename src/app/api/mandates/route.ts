import { NextResponse } from "next/server";
import { db, mandates } from "@/db";
import { desc, eq } from "drizzle-orm";
import { ensureOwnerRecord, requireSession } from "@/lib/auth/require-session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;

  try {
    const list = await db
      .select()
      .from(mandates)
      .where(eq(mandates.ownerId, auth.session.user.id))
      .orderBy(desc(mandates.createdAt));
    return NextResponse.json({ mandates: list });
  } catch (error) {
    console.error("Failed to query mandates:", error);
    return NextResponse.json(
      { error: "Failed to query mandates" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;

  try {
    await ensureOwnerRecord(auth.session);
    const body = await request.json();
    const id = body.id || `mandate-${Date.now()}`;

    const newMandate = {
      id,
      // Always the verified session user; any owner field in the body is ignored.
      ownerId: auth.session.user.id,
      service: body.service,
      budgetCeiling: Number(body.budgetCeiling) || 0,
      lastScrapedPrice: Number(body.lastScrapedPrice) || 0,
      recurrence: body.recurrence || "Monthly on 1st",
      nextRun: body.nextRun || "Pending",
      status: (body.status || "ACTIVE") as "ACTIVE" | "PAUSED" | "ANOMALY_HOLD",
      category: body.category || "Subscription",
      currency: body.currency || "USD",
      strictMode: Boolean(body.strictMode),
      merchantUrl: body.merchantUrl || null,
    };

    await db.insert(mandates).values(newMandate);

    return NextResponse.json({ mandate: newMandate }, { status: 201 });
  } catch (error) {
    console.error("Failed to create mandate:", error);
    return NextResponse.json(
      { error: "Failed to create mandate" },
      { status: 500 }
    );
  }
}
