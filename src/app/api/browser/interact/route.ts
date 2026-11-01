import { NextResponse } from "next/server";
import { screencastManager } from "@/lib/browser";
import { posthogServer } from "@/lib/telemetry/posthog-server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    success: true,
    takeoverState: screencastManager.getTakeoverState(),
    status: screencastManager.getStatus(),
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, x, y, text, isActive, reason, challengeTitle } = body;

    // Action 1: Direct Human Canvas Click
    if (action === "click" && typeof x === "number" && typeof y === "number") {
      await screencastManager.handleHumanClick(x, y);
      return NextResponse.json({
        success: true,
        action: "click",
        coordinates: { x, y },
      });
    }

    // Action 2: Direct Human Keyboard Typing
    if (action === "type" && typeof text === "string") {
      await screencastManager.handleHumanType(text);
      return NextResponse.json({
        success: true,
        action: "type",
        text,
      });
    }

    // Action 3: Engage or Disengage Human Takeover Mode
    if (action === "set_takeover") {
      const state = {
        isActive: !!isActive,
        reason: reason || "MANUAL_TAKEOVER",
        challengeTitle: challengeTitle || "Live Human Takeover",
        startedAt: isActive ? Date.now() : undefined,
      };

      screencastManager.setTakeoverState(state);

      // Track PostHog Telemetry
      posthogServer.capture({
        distinctId: "server-agent",
        event: isActive ? "human_takeover_engaged" : "human_takeover_resolved",
        properties: {
          reason: state.reason,
          challenge_title: state.challengeTitle,
          timestamp: new Date().toISOString(),
        },
      });

      return NextResponse.json({
        success: true,
        takeoverState: state,
      });
    }

    // Action 4: Challenge Solved by Human (CAPTCHA / 2FA)
    if (action === "solve_challenge") {
      screencastManager.setTakeoverState({
        isActive: false,
        isSolved: true,
        reason: reason || "CAPTCHA_CHALLENGE",
      });

      posthogServer.capture({
        distinctId: "server-agent",
        event: "human_takeover_resolved",
        properties: {
          resolution: "CHALLENGE_SOLVED_BY_HUMAN",
          resumed_agent: "Rico Autonomous Agent",
          timestamp: new Date().toISOString(),
        },
      });

      return NextResponse.json({
        success: true,
        message: "Challenge resolved. Control returned to autonomous Rico agent.",
      });
    }

    return NextResponse.json(
      { success: false, error: "Invalid action or parameters" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Takeover interaction error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Interaction failed",
      },
      { status: 500 }
    );
  }
}
