import { BatchWorker } from "./worker";
import {
  JobHandler,
  JobType,
  WorkerInfo,
  WorkerPoolOptions,
} from "./types";

export class WorkerPool {
  private workers: Map<string, BatchWorker> = new Map();
  private handlers: Map<JobType, JobHandler> = new Map();
  private workerCounter: number = 0;

  public readonly minWorkers: number;
  public readonly maxWorkers: number;
  public readonly idleTimeoutMs: number;
  public readonly defaultJobTimeoutMs: number;
  public readonly defaultMaxRetries: number;
  public readonly defaultBackoffMs: number;

  constructor(options?: WorkerPoolOptions) {
    this.minWorkers = Math.max(1, options?.minWorkers ?? 2);
    this.maxWorkers = Math.max(this.minWorkers, options?.maxWorkers ?? 6);
    this.idleTimeoutMs = options?.idleTimeoutMs ?? 60000;
    this.defaultJobTimeoutMs = options?.defaultJobTimeoutMs ?? 30000;
    this.defaultMaxRetries = options?.defaultMaxRetries ?? 3;
    this.defaultBackoffMs = options?.defaultBackoffMs ?? 1000;

    // Bootstrap minimum workers
    for (let i = 0; i < this.minWorkers; i++) {
      this.spawnWorker();
    }
  }

  public registerHandler<TData = unknown, TResult = unknown>(
    type: JobType,
    handler: JobHandler<TData, TResult>
  ): void {
    this.handlers.set(type, handler as JobHandler<unknown, unknown>);
  }

  public getHandler<TData = unknown, TResult = unknown>(
    type: JobType
  ): JobHandler<TData, TResult> | undefined {
    return this.handlers.get(type) as JobHandler<TData, TResult> | undefined;
  }

  public hasHandler(type: JobType): boolean {
    return this.handlers.has(type);
  }

  /**
   * Acquire an idle worker, dynamically scaling up to maxWorkers if needed
   */
  public acquireWorker(): BatchWorker | undefined {
    // 1. Look for an idle worker
    for (const worker of Array.from(this.workers.values())) {
      if (worker.isAvailable()) {
        worker.reserve();
        return worker;
      }
    }

    // 2. Scale up if headroom exists
    if (this.workers.size < this.maxWorkers) {
      const newWorker = this.spawnWorker();
      newWorker.reserve();
      return newWorker;
    }

    // All workers busy and max capacity reached
    return undefined;
  }

  public releaseWorker(worker: BatchWorker): void {
    worker.release();
  }

  public getWorker(id: string): BatchWorker | undefined {
    return this.workers.get(id);
  }

  public getWorkerByJobId(jobId: string): BatchWorker | undefined {
    for (const worker of Array.from(this.workers.values())) {
      if (worker.currentJobId === jobId) {
        return worker;
      }
    }
    return undefined;
  }

  public getActiveWorkersCount(): number {
    let count = 0;
    for (const worker of Array.from(this.workers.values())) {
      if (worker.status === "BUSY" || worker.status === "RESERVED") count++;
    }
    return count;
  }

  public getIdleWorkersCount(): number {
    let count = 0;
    for (const worker of Array.from(this.workers.values())) {
      if (worker.status === "IDLE") count++;
    }
    return count;
  }

  public getTotalWorkersCount(): number {
    return this.workers.size;
  }

  public getWorkersInfo(): WorkerInfo[] {
    return Array.from(this.workers.values()).map((w) => w.getInfo());
  }

  private spawnWorker(): BatchWorker {
    this.workerCounter++;
    const id = `w-${this.workerCounter.toString().padStart(3, "0")}`;
    const name = `BatchWorker-${this.workerCounter}`;
    const worker = new BatchWorker(id, name);
    this.workers.set(id, worker);
    return worker;
  }

  /**
   * Scale worker pool to target size within [minWorkers, maxWorkers] bounds
   */
  public scale(targetWorkers: number): void {
    const target = Math.max(this.minWorkers, Math.min(this.maxWorkers, targetWorkers));

    while (this.workers.size < target) {
      this.spawnWorker();
    }

    if (this.workers.size > target) {
      for (const [id, worker] of Array.from(this.workers.entries())) {
        if (this.workers.size <= target) break;
        if (worker.isAvailable()) {
          worker.terminate();
          this.workers.delete(id);
        }
      }
    }
  }

  public terminate(): void {
    for (const worker of Array.from(this.workers.values())) {
      worker.terminate();
    }
    this.workers.clear();
  }
}
