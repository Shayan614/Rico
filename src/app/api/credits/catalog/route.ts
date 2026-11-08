import { NextResponse } from "next/server";
import { creditMatcherEngine } from "@/lib/credits";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const catalog = creditMatcherEngine.getCatalog();
    const totalPotentialCatalogValueUsd = catalog.reduce(
      (sum, p) => sum + p.maxCreditValueUsd,
      0
    );

    return NextResponse.json({
      success: true,
      count: catalog.length,
      totalPotentialCatalogValueUsd,
      programs: catalog,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    return NextResponse.json(
      { success: false, error: err.message || "Failed to retrieve credits catalog" },
      { status: 500 }
    );
  }
}
