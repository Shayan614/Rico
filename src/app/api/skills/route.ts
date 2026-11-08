import { NextRequest, NextResponse } from "next/server";
import { skillRegistry } from "@/lib/skills";

export const dynamic = "force-dynamic";

/**
 * GET /api/skills
 * List all available modular skills with filtering
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category") || undefined;
    const persona = searchParams.get("persona") || undefined;
    const enabledOnly = searchParams.get("enabledOnly") === "true";

    const skills = skillRegistry.getAllSkills({
      category,
      persona,
      enabledOnly,
    });

    return NextResponse.json({
      success: true,
      count: skills.length,
      skills: skills.map((s) => ({
        metadata: s.metadata,
        enabled: s.enabled,
        rulesCount: s.rules.length,
        examplesCount: s.fewShotExamples.length,
        hasFilePath: !!s.filePath,
      })),
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : "Failed to fetch skills";
    return NextResponse.json({ success: false, error }, { status: 500 });
  }
}

/**
 * POST /api/skills
 * Import a new custom SKILL.md into the runtime registry
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { content, filePath } = body;

    if (!content || typeof content !== "string") {
      return NextResponse.json(
        { success: false, error: "Raw SKILL.md content is required." },
        { status: 400 }
      );
    }

    const skill = skillRegistry.registerSkillFromMarkdown(content, filePath);

    return NextResponse.json({
      success: true,
      message: `Skill ${skill.metadata.name} (${skill.metadata.id}) registered successfully.`,
      skill: {
        metadata: skill.metadata,
        enabled: skill.enabled,
        rulesCount: skill.rules.length,
        examplesCount: skill.fewShotExamples.length,
      },
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : "Failed to parse and register skill";
    return NextResponse.json({ success: false, error }, { status: 400 });
  }
}
