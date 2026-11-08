import { NextRequest, NextResponse } from "next/server";
import { invoiceOCRParser } from "@/lib/ocr";
import { InvoiceParseInput } from "@/lib/ocr/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { items, priority, asyncMode } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: "Missing or empty required array: 'items'" },
        { status: 400 }
      );
    }

    const inputs: InvoiceParseInput[] = items.map((it: InvoiceParseInput | string, idx: number) => {
      if (typeof it === "string") {
        return {
          id: `inv_batch_${Date.now()}_${idx + 1}`,
          content: it,
          sourceType: "TEXT_SNIPPET",
        };
      }
      return {
        ...it,
        id: it.id || `inv_batch_${Date.now()}_${idx + 1}`,
      };
    });

    if (asyncMode) {
      // Async submission returning immediately with tracking summary
      const { batchQueueEngine } = await import("@/lib/batch");
      const jobs = await batchQueueEngine.addBatch("INVOICE_OCR", inputs, {
        priority: priority || "HIGH",
      });

      return NextResponse.json({
        success: true,
        mode: "ASYNC_QUEUED",
        count: jobs.length,
        jobIds: jobs.map((j) => j.id),
      });
    }

    // Synchronous resolution of the batch
    const summary = await invoiceOCRParser.parseBatch(inputs, { priority });

    return NextResponse.json({
      success: true,
      mode: "SYNC_RESOLVED",
      summary,
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    return NextResponse.json(
      { success: false, error: err.message || "Failed to execute invoice batch" },
      { status: 500 }
    );
  }
}
