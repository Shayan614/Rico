import { NextRequest, NextResponse } from "next/server";
import { creditMatcherEngine } from "@/lib/credits";
import { FounderProfile } from "@/lib/credits/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { profile, profiles, priority } = body;

    // 1. Batch profiles mode
    if (Array.isArray(profiles)) {
      const reports = await creditMatcherEngine.batchMatch(profiles, { priority });
      return NextResponse.json({
        success: true,
        mode: "BATCH",
        count: reports.length,
        reports,
      });
    }

    // 2. Single profile mode
    const target: FounderProfile = profile || body;

    if (!target.companyName) {
      return NextResponse.json(
        { success: false, error: "Missing required parameter: 'companyName'" },
        { status: 400 }
      );
    }

    const defaultProfile: FounderProfile = {
      name: target.name || "Founder",
      companyName: target.companyName,
      websiteUrl: target.websiteUrl || "https://rico.ai",
      foundedYear: target.foundedYear || 2025,
      fundingStage: target.fundingStage || "BOOTSTRAPPED",
      totalFundingRaisedUsd: target.totalFundingRaisedUsd ?? 0,
      monthlyBurnRateUsd: target.monthlyBurnRateUsd || 5000,
      techStack: target.techStack || ["Next.js", "TypeScript", "PostgreSQL", "LLM"],
      productCategory: target.productCategory || "AI Agentic Commerce",
      tagline: target.tagline || "Autonomous financial agent for businesses",
      description: target.description || "AI agent with budget ceilings and verified payment receipts.",
      isStudentFounder: target.isStudentFounder,
      universityName: target.universityName,
      studentEmail: target.studentEmail,
    };

    const report = await creditMatcherEngine.matchProfile(defaultProfile);

    return NextResponse.json({
      success: true,
      mode: "SINGLE",
      report,
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    return NextResponse.json(
      { success: false, error: err.message || "Failed to match credits" },
      { status: 500 }
    );
  }
}
