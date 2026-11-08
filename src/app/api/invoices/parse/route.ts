import { NextRequest, NextResponse } from "next/server";
import { invoiceOCRParser } from "@/lib/ocr";
import { InvoiceParseInput } from "@/lib/ocr/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { content, items, vendorHint, currencyHint, sourceType } = body;

    // 1. Batch array mode
    if (Array.isArray(items)) {
      const summary = await invoiceOCRParser.parseBatch(
        items.map((it: InvoiceParseInput | string) => {
          if (typeof it === "string") {
            return { content: it, sourceType };
          }
          return it;
        })
      );

      return NextResponse.json({
        success: true,
        mode: "BATCH",
        summary,
      });
    }

    // 2. Single invoice mode
    if (!content) {
      return NextResponse.json(
        { success: false, error: "Missing required parameter: 'content' or 'items'" },
        { status: 400 }
      );
    }

    const invoice = await invoiceOCRParser.parseInvoice({
      content,
      vendorHint,
      currencyHint,
      sourceType,
    });

    return NextResponse.json({
      success: true,
      mode: "SINGLE",
      invoice,
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    return NextResponse.json(
      { success: false, error: err.message || "Failed to parse invoice" },
      { status: 500 }
    );
  }
}
