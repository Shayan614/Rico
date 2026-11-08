import { NextRequest, NextResponse } from "next/server";
import { batchQueueEngine } from "@/lib/batch";
import { JobType, JobPriority, BatchJob } from "@/lib/batch/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 20;
    const status = searchParams.get("status") as BatchJob["status"] | undefined;
    const type = searchParams.get("type") as JobType | undefined;

    const stats = batchQueueEngine.getStats();
    const workers = batchQueueEngine.getWorkerPool().getWorkersInfo();
    const jobs = batchQueueEngine.listJobs({ limit, status, type });

    return NextResponse.json({
      success: true,
      stats,
      workers,
      jobs,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch batch queue stats" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, data, items, options } = body;

    if (!type) {
      return NextResponse.json(
        { success: false, error: "Missing required parameter: 'type'" },
        { status: 400 }
      );
    }

    // 1. Batch mode
    if (Array.isArray(items)) {
      const jobs = await batchQueueEngine.addBatch(type as JobType, items, {
        priority: options?.priority as JobPriority,
        maxRetries: options?.maxRetries,
        backoffMs: options?.backoffMs,
        timeoutMs: options?.timeoutMs,
        idempotencyKey: options?.idempotencyKey,
        tags: options?.tags,
        metadata: options?.metadata,
      });

      return NextResponse.json({
        success: true,
        mode: "BATCH",
        count: jobs.length,
        jobIds: jobs.map((j) => j.id),
        jobs,
      });
    }

    // 2. Single Job mode
    const job = await batchQueueEngine.addJob(type as JobType, data ?? {}, {
      priority: options?.priority as JobPriority,
      maxRetries: options?.maxRetries,
      backoffMs: options?.backoffMs,
      timeoutMs: options?.timeoutMs,
      idempotencyKey: options?.idempotencyKey,
      tags: options?.tags,
      metadata: options?.metadata,
    });

    return NextResponse.json({
      success: true,
      mode: "SINGLE",
      job,
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    return NextResponse.json(
      { success: false, error: err.message || "Failed to submit batch job" },
      { status: 500 }
    );
  }
}
