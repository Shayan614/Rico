import { NextRequest, NextResponse } from "next/server";
import { skillInjector } from "@/lib/skills";

export const dynamic = "force-dynamic";

/**
 * POST /api/skills/match
 * Test match user prompt against skills library and preview runtime injection
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, persona, minConfidence, maxSkills } = body;

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { success: false, error: "Prompt string is required." },
        { status: 400 }
      );
    }

    const matched = skillInjector.matchSkills(prompt, {
      persona,
      minConfidence,
      maxSkills,
    });

    const injection = skillInjector.injectSkills(prompt, {
      persona,
      minConfidence,
      maxSkills,
    });

    return NextResponse.json({
      success: true,
      prompt,
      persona: persona || "all",
      matchedCount: matched.length,
      matches: matched.map((m) => ({
        id: m.skill.metadata.id,
        name: m.skill.metadata.name,
        category: m.skill.metadata.category,
        score: m.score,
        matchedTriggers: m.matchedTriggers,
        reason: m.reason,
      })),
      injectedPromptPreview: injection.injectedPrompt,
      suggestedTools: injection.suggestedTools,
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : "Failed to match skills";
    return NextResponse.json({ success: false, error }, { status: 500 });
  }
}
