import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-session";
import { quoteMandatePayment } from "@/lib/payments/mandate-execution";

export const dynamic = "force-dynamic";

const REFUSAL_STATUS: Record<string, number> = {
  NOT_FOUND: 404,
  NOT_ACTIVE: 409,
  ALREADY_PAID: 409,
  IN_PROGRESS: 409,
  OVER_BUDGET: 422,
  PRICE_UNVERIFIED: 503,
  CONFIG: 503,
};

/** Step 1 of a manual run: shows what would be charged. Never charges. */
export async function POST(request: Request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const result = await quoteMandatePayment(String(body?.mandateId ?? ""), auth.session.user.id);
    if (!result.ok) {
      return NextResponse.json({ error: result.message, code: result.code }, { status: REFUSAL_STATUS[result.code] ?? 400 });
    }
    return NextResponse.json({ quote: result.quote });
  } catch (error) {
    console.error("Payment quote failed:", error);
    return NextResponse.json({ error: "The payment could not be prepared. No payment was made." }, { status: 500 });
  }
}
