import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-session";
import { executeConfirmedMandatePayment } from "@/lib/payments/mandate-execution";

export const dynamic = "force-dynamic";

const STATUS: Record<string, number> = {
  INVALID_CONFIRMATION: 400,
  CONFIRMATION_EXPIRED: 409,
  PRICE_CHANGED: 409,
  NOT_FOUND: 404,
  NOT_ACTIVE: 409,
  ALREADY_PAID: 409,
  IN_PROGRESS: 409,
  OVER_BUDGET: 422,
  PRICE_UNVERIFIED: 503,
  CONFIG: 503,
  BLOCKED: 409,
  FAILED: 502,
  NEEDS_RECONCILIATION: 202,
};

/** Step 2 of a manual run: charges only with the signed confirmation from step 1. */
export async function POST(request: Request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const rail = body?.fundingRail === "VISA" ? "VISA" : "PAYPAL";
    const result = await executeConfirmedMandatePayment(body?.confirmToken, auth.session.user.id, rail);
    if (!result.ok) {
      return NextResponse.json({ error: result.message, code: result.status }, { status: STATUS[result.status] ?? 400 });
    }
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Confirmed payment failed:", error);
    return NextResponse.json({ error: "The payment could not be completed." }, { status: 500 });
  }
}
