import { NextRequest, NextResponse } from "next/server";
import { gitHubMCPAdapter } from "@/lib/mcp/adapters/github";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, body: issueBody, labels, owner, repo } = body;

    if (!title || !issueBody) {
      return NextResponse.json(
        { success: false, error: "Missing required parameters: 'title' and 'body'" },
        { status: 400 }
      );
    }

    const result = await gitHubMCPAdapter.createIssue({
      title,
      body: issueBody,
      labels,
      owner,
      repo,
    });

    return NextResponse.json({
      success: result.success,
      result,
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    return NextResponse.json(
      { success: false, error: err.message || "Failed to create GitHub issue" },
      { status: 500 }
    );
  }
}
