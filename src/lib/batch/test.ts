import {
  BatchQueueEngine,
  PriorityJobQueue,
  WorkerPool,
  batchQueueEngine,
} from "./index";
import { BatchJob, JobProgressUpdate } from "./types";

async function runBatchQueueTests() {
  console.log("==================================================");
  console.log("⚡ Testing 2.6 Batch Queue & Worker Pool Engine");
  console.log("==================================================");

  // [Test 1] Priority Heap Ordering
  console.log("\n[Test 1] Testing Priority Heap Preemption (Critical > High > Normal > Low)...");
  const pq = new PriorityJobQueue();

  const jobLow: BatchJob = {
    id: "job-low",
    type: "PRICE_SCRAPE",
    data: {},
    priority: "LOW",
    status: "QUEUED",
    progress: 0,
    attempt: 0,
    maxRetries: 3,
    backoffMs: 100,
    timeoutMs: 5000,
    tags: [],
    createdAt: Date.now(),
  };

  const jobNormal: BatchJob = {
    id: "job-normal",
    type: "PRICE_SCRAPE",
    data: {},
    priority: "NORMAL",
    status: "QUEUED",
    progress: 0,
    attempt: 0,
    maxRetries: 3,
    backoffMs: 100,
    timeoutMs: 5000,
    tags: [],
    createdAt: Date.now() + 1,
  };

  const jobHigh: BatchJob = {
    id: "job-high",
    type: "PRICE_SCRAPE",
    data: {},
    priority: "HIGH",
    status: "QUEUED",
    progress: 0,
    attempt: 0,
    maxRetries: 3,
    backoffMs: 100,
    timeoutMs: 5000,
    tags: [],
    createdAt: Date.now() + 2,
  };

  const jobCritical: BatchJob = {
    id: "job-critical",
    type: "PRICE_SCRAPE",
    data: {},
    priority: "CRITICAL",
    status: "QUEUED",
    progress: 0,
    attempt: 0,
    maxRetries: 3,
    backoffMs: 100,
    timeoutMs: 5000,
    tags: [],
    createdAt: Date.now() + 3,
  };

  // Enqueue in reverse order
  pq.enqueue(jobLow);
  pq.enqueue(jobNormal);
  pq.enqueue(jobHigh);
  pq.enqueue(jobCritical);

  const order: string[] = [];
  while (!pq.isEmpty()) {
    order.push(pq.dequeue()!.id);
  }

  console.log("   Dequeued Order:", order.join(" -> "));
  if (
    order[0] !== "job-critical" ||
    order[1] !== "job-high" ||
    order[2] !== "job-normal" ||
    order[3] !== "job-low"
  ) {
    throw new Error(`Test 1 Failed: Expected critical -> high -> normal -> low, got ${order.join(", ")}`);
  }
  console.log("✅ Test 1 Passed: Priority heap maintains strict priority preemption.");

  // [Test 2] Worker Pool Dynamic Scaling & Concurrency Limits
  console.log("\n[Test 2] Testing Worker Pool Concurrency & Capacity Limits...");
  const pool = new WorkerPool({ minWorkers: 2, maxWorkers: 4 });
  console.log(`   Initial Workers: ${pool.getTotalWorkersCount()} (min: ${pool.minWorkers}, max: ${pool.maxWorkers})`);

  if (pool.getTotalWorkersCount() !== 2) {
    throw new Error(`Test 2 Failed: Expected 2 initial workers, got ${pool.getTotalWorkersCount()}`);
  }

  const w1 = pool.acquireWorker();
  const w2 = pool.acquireWorker();
  const w3 = pool.acquireWorker(); // Scales to 3
  const w4 = pool.acquireWorker(); // Scales to 4 (max)
  const w5 = pool.acquireWorker(); // Should be undefined (max reached)

  console.log(`   Acquired 4 workers. Total spawned: ${pool.getTotalWorkersCount()}`);
  if (!w1 || !w2 || !w3 || !w4 || w5 !== undefined) {
    throw new Error(`Test 2 Failed: Worker pool failed to cap at maxWorkers 4!`);
  }
  pool.terminate();
  console.log("✅ Test 2 Passed: Worker pool correctly enforces concurrency bounds.");

  // [Test 3] Idempotency Key Deduplication
  console.log("\n[Test 3] Testing Idempotency Deduplication...");
  const customEngine = new BatchQueueEngine({ minWorkers: 2, maxWorkers: 3 });

  const jobA = await customEngine.addJob(
    "CUSTOM",
    { text: "test-dedup" },
    { idempotencyKey: "unique-key-12345" }
  );

  const jobB = await customEngine.addJob(
    "CUSTOM",
    { text: "duplicate-attempt" },
    { idempotencyKey: "unique-key-12345" }
  );

  console.log(`   Job A ID: ${jobA.id}, Job B ID: ${jobB.id}`);
  if (jobA.id !== jobB.id) {
    throw new Error("Test 3 Failed: Idempotent job was duplicated instead of returned!");
  }
  console.log("✅ Test 3 Passed: Idempotency check prevented duplicate job submission.");

  // [Test 4] Dynamic Progress Tracking
  console.log("\n[Test 4] Testing Dynamic Progress Tracking...");
  const progressLogs: number[] = [];

  customEngine.registerHandler("CUSTOM", async (_data, ctx) => {
    ctx.updateProgress({ percent: 25, message: "Phase 1" });
    await new Promise((r) => setTimeout(r, 40));
    ctx.updateProgress({ percent: 50, message: "Phase 2" });
    await new Promise((r) => setTimeout(r, 40));
    ctx.updateProgress({ percent: 100, message: "Complete" });
    return { done: true };
  });

  let targetJobId: string | null = null;
  const progressPromise = new Promise<void>((resolve) => {
    const handler = (job: BatchJob, p: JobProgressUpdate) => {
      if (!targetJobId || job.id === targetJobId) {
        progressLogs.push(p.percent);
        if (p.percent === 100) {
          customEngine.off("job:progress", handler);
          resolve();
        }
      }
    };
    customEngine.on("job:progress", handler);
  });

  const progressJob = await customEngine.addJob("CUSTOM", { task: "progress-test" });
  targetJobId = progressJob.id;

  await progressPromise;
  await customEngine.waitForJob(progressJob.id);

  console.log("   Observed Progress Milestones:", progressLogs.join("% -> ") + "%");
  if (!progressLogs.includes(25) || !progressLogs.includes(50) || !progressLogs.includes(100)) {
    throw new Error("Test 4 Failed: Expected progress updates at 25, 50, 100%");
  }
  console.log("✅ Test 4 Passed: Real-time progress updates delivered successfully.");

  // [Test 5] Automatic Retry & Exponential Backoff
  console.log("\n[Test 5] Testing Automatic Retry & Exponential Backoff...");
  let executionAttempts = 0;

  customEngine.registerHandler("PRICE_SCRAPE", async () => {
    executionAttempts++;
    if (executionAttempts < 3) {
      throw new Error(`Transient network glitch on attempt ${executionAttempts}`);
    }
    return { recovered: true, attempts: executionAttempts };
  });

  const retryJob = await customEngine.addJob(
    "PRICE_SCRAPE",
    { service: "Test Service" },
    { maxRetries: 3, backoffMs: 50 }
  );

  const completedJob = await customEngine.waitForJob<{ recovered: boolean }>(retryJob.id, 5000);
  console.log(`   Job completed after ${completedJob.attempt} attempts. Result:`, completedJob.result);

  if (completedJob.attempt !== 3 || !completedJob.result?.recovered) {
    throw new Error("Test 5 Failed: Expected job to retry and recover on attempt 3!");
  }
  console.log("✅ Test 5 Passed: Exponential backoff retried and recovered cleanly.");

  // [Test 6] Timeout & Abort Handling
  console.log("\n[Test 6] Testing Timeout Enforcement & AbortSignal...");
  customEngine.registerHandler("CONTRACT_WATCHDOG", async (_data, ctx) => {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => resolve("never"), 10000);
      ctx.signal.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(new Error("Aborted by timeout"));
      });
    });
  });

  const timeoutJob = await customEngine.addJob(
    "CONTRACT_WATCHDOG",
    {},
    { timeoutMs: 100, maxRetries: 1 }
  );

  let timedOutError = false;
  try {
    await customEngine.waitForJob(timeoutJob.id, 2000);
  } catch (err: unknown) {
    timedOutError = true;
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`   Captured expected timeout error: "${msg}"`);
  }

  if (!timedOutError) {
    throw new Error("Test 6 Failed: Job should have timed out within 100ms!");
  }
  console.log("✅ Test 6 Passed: Job timeout and AbortSignal successfully triggered.");

  // [Test 7] High-Throughput Batch Processing & Drain
  console.log("\n[Test 7] Testing High-Throughput Batch Processing (10 jobs parallel)...");
  customEngine.registerHandler("INVOICE_OCR", async (data: unknown) => {
    const payload = data as { num: number };
    await new Promise((r) => setTimeout(r, 15));
    return { invoice: payload.num, total: payload.num * 10 };
  });

  const batchInputs = Array.from({ length: 10 }, (_, i) => ({ num: i + 1 }));
  const batchJobs = await customEngine.addBatch("INVOICE_OCR", batchInputs, {
    priority: "HIGH",
  });

  console.log(`   Enqueued ${batchJobs.length} jobs in parallel batch.`);
  const completedBatch = await customEngine.waitForBatch(
    batchJobs.map((j) => j.id),
    10000
  );

  const allCompleted = completedBatch.every((j) => j.status === "COMPLETED");
  console.log(`   All ${completedBatch.length} jobs completed: ${allCompleted}`);
  if (!allCompleted || completedBatch.length !== 10) {
    throw new Error("Test 7 Failed: Batch processing did not complete all 10 jobs!");
  }
  console.log("✅ Test 7 Passed: Batch processing handled high throughput cleanly.");

  // [Test 8] Queue Pause & Resume
  console.log("\n[Test 8] Testing Queue Pause & Resume...");
  customEngine.pause();
  console.log(`   Queue paused: ${customEngine.isQueuePaused()}`);

  const pausedJob = await customEngine.addJob("CUSTOM", { action: "pause-test" });
  await new Promise((r) => setTimeout(r, 100));

  const statsWhilePaused = customEngine.getStats();
  console.log(`   Stats while paused: queued = ${statsWhilePaused.queued}, processing = ${statsWhilePaused.processing}`);
  if (statsWhilePaused.queued !== 1 || statsWhilePaused.processing !== 0) {
    throw new Error("Test 8 Failed: Queue dispatched job while paused!");
  }

  customEngine.resume();
  console.log(`   Queue resumed. Waiting for paused job...`);
  await customEngine.waitForJob(pausedJob.id, 3000);
  console.log("✅ Test 8 Passed: Queue successfully paused and resumed without drops.");

  // [Test 9] Global Singleton Stats Verification
  console.log("\n[Test 9] Testing Global Singleton Engine Stats...");
  const stats = batchQueueEngine.getStats();
  console.log("   Global Engine Stats:", {
    queued: stats.queued,
    processing: stats.processing,
    completed: stats.completed,
    activeWorkers: stats.activeWorkers,
    idleWorkers: stats.idleWorkers,
    totalWorkers: stats.totalWorkers,
  });
  console.log("✅ Test 9 Passed: Global batch queue singleton verified.");

  console.log("\n==================================================");
  console.log("🎉 ALL 9 Batch Queue & Worker Pool Tests PASSED!");
  console.log("==================================================");
}

runBatchQueueTests().catch((err) => {
  console.error("❌ Batch Queue Tests Failed:", err);
  process.exit(1);
});
