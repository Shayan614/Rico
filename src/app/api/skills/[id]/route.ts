import { NextRequest, NextResponse } from "next/server";
import { skillRegistry } from "@/lib/skills";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/skills/[id]
 * Get full definition of a skill
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const skill = skillRegistry.getSkill(id);

    if (!skill) {
      return NextResponse.json(
        { success: false, error: `Skill '${id}' not found.` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      skill,
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : "Failed to retrieve skill";
    return NextResponse.json({ success: false, error }, { status: 500 });
  }
}

/**
 * PATCH /api/skills/[id]
 * Toggle enabled state of a skill
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { enabled } = body;

    if (typeof enabled !== "boolean") {
      return NextResponse.json(
        { success: false, error: "Missing or invalid 'enabled' boolean field." },
        { status: 400 }
      );
    }

    const updated = skillRegistry.setSkillEnabled(id, enabled);

    if (!updated) {
      return NextResponse.json(
        { success: false, error: `Skill '${id}' not found.` },
        { status: 404 }
      );
    }

    const skill = skillRegistry.getSkill(id);
    return NextResponse.json({
      success: true,
      message: `Skill '${id}' is now ${enabled ? "enabled" : "disabled"}.`,
      skill: {
        id: skill?.metadata.id,
        name: skill?.metadata.name,
        enabled: skill?.enabled,
      },
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : "Failed to update skill";
    return NextResponse.json({ success: false, error }, { status: 500 });
  }
}

/**
 * DELETE /api/skills/[id]
 * Unregister a skill
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const removed = skillRegistry.unregisterSkill(id);

    if (!removed) {
      return NextResponse.json(
        { success: false, error: `Skill '${id}' not found.` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Skill '${id}' removed successfully.`,
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : "Failed to delete skill";
    return NextResponse.json({ success: false, error }, { status: 500 });
  }
}
