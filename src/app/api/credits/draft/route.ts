import { NextRequest, NextResponse } from "next/server";
import { creditMatcherEngine } from "@/lib/credits";
import { FounderProfile } from "@/lib/credits/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { profile, programId } = body;

    if (!programId) {
      return NextResponse.json(
        { success: false, error: "Missing required parameter: 'programId'" },
        { status: 400 }
      );
    }

    const targetProfile: FounderProfile = profile || {
      name: body.name || "Founder",
      companyName: body.companyName || "Rico",
      websiteUrl: body.websiteUrl || "https://rico.ai",
      foundedYear: body.foundedYear || 2025,
      fundingStage: body.fundingStage || "SEED",
      totalFundingRaisedUsd: body.totalFundingRaisedUsd || 150000,
      monthlyBurnRateUsd: body.monthlyBurnRateUsd || 8000,
      techStack: body.techStack || ["Next.js", "TypeScript", "PostgreSQL", "DeepSeek", "Gemini"],
      productCategory: body.productCategory || "Agentic Finance",
      tagline: body.tagline || "Autonomous spending rules and digital proof engine",
      description: body.description || "Multi-agent autonomous financial platform for SMBs and startups.",
      isStudentFounder: body.isStudentFounder,
      universityName: body.universityName,
      studentEmail: body.studentEmail,
    };

    const draft = await creditMatcherEngine.draftPitch(targetProfile, programId);

    return NextResponse.json({
      success: true,
      draft,
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    return NextResponse.json(
      { success: false, error: err.message || "Failed to draft application pitch" },
      { status: 500 }
    );
  }
}
