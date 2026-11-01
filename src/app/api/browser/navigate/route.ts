import { NextResponse } from "next/server";
import { priceWorker } from "@/lib/browser";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { url, service } = body;

    const targetService = service || "Live Inspection";
    const targetUrl = url || undefined;

    // Trigger Playwright worker to scrape and stream CDP screencast frames
    const result = await priceWorker.scrapeMerchantPrice(
      targetService,
      targetUrl,
      { timeoutMs: 12000 }
    );

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error("[API /api/browser/navigate] Navigation error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Navigation failed",
      },
      { status: 500 }
    );
  }
}
