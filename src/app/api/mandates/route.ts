import { NextResponse } from "next/server";
import { db, mandates } from "@/db";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const list = db.select().from(mandates).orderBy(desc(mandates.createdAt)).all();
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
  try {
    const body = await request.json();
    const id = body.id || `mandate-${Date.now()}`;

    const newMandate = {
      id,
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

    db.insert(mandates).values(newMandate).run();

    return NextResponse.json({ mandate: newMandate }, { status: 201 });
  } catch (error) {
    console.error("Failed to create mandate:", error);
    return NextResponse.json(
      { error: "Failed to create mandate" },
      { status: 500 }
    );
  }
}
