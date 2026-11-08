import { NextRequest, NextResponse } from "next/server";
import { batchQueueEngine } from "@/lib/batch";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const { jobId } = params;
    const job = batchQueueEngine.getJob(jobId);

    if (!job) {
      return NextResponse.json(
        { success: false, error: `Job '${jobId}' not found` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      job,
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    return NextResponse.json(
      { success: false, error: err.message || "Failed to retrieve job" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const { jobId } = params;
    const cancelled = batchQueueEngine.cancelJob(jobId);

    if (!cancelled) {
      return NextResponse.json(
        { success: false, error: `Job '${jobId}' could not be cancelled or was not found in active/queued state` },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Job '${jobId}' cancelled successfully`,
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    return NextResponse.json(
      { success: false, error: err.message || "Failed to cancel job" },
      { status: 500 }
    );
  }
}
