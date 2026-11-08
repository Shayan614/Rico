import {
  BatchJob,
  JobExecutionContext,
  JobHandler,
  JobProgressCallback,
  WorkerInfo,
  WorkerStatus,
} from "./types";

export class BatchWorker {
  public readonly id: string;
  public readonly name: string;
  public status: WorkerStatus = "IDLE";
  public currentJobId?: string;
  public jobsProcessed: number = 0;
  public jobsFailed: number = 0;
  public readonly activeSince: number = Date.now();

  private activeAbortController?: AbortController;
  private timeoutTimer?: NodeJS.Timeout;

  constructor(id: string, name?: string) {
    this.id = id;
    this.name = name || `worker-${id}`;
  }

  public getInfo(): WorkerInfo {
    return {
      id: this.id,
      name: this.name,
      status: this.status,
      currentJobId: this.currentJobId,
      jobsProcessed: this.jobsProcessed,
      jobsFailed: this.jobsFailed,
      activeSince: this.activeSince,
    };
  }

  public isAvailable(): boolean {
    return this.status === "IDLE";
  }

  public reserve(): void {
    if (this.status !== "IDLE") {
      throw new Error(`Cannot reserve worker ${this.id} (status: ${this.status})`);
    }
    this.status = "RESERVED";
  }

  public release(): void {
    if (this.status === "RESERVED") {
      this.status = "IDLE";
    }
  }

  /**
   * Execute a batch job through its registered handler
   */
  public async executeJob<TData, TResult>(
    job: BatchJob<TData, TResult>,
    handler: JobHandler<TData, TResult>,
    onProgress: JobProgressCallback
  ): Promise<TResult> {
    if (this.status !== "IDLE" && this.status !== "RESERVED") {
      throw new Error(`Worker ${this.id} is not available (status: ${this.status})`);
    }

    this.status = "BUSY";
    this.currentJobId = job.id;
    this.activeAbortController = new AbortController();

    const { signal } = this.activeAbortController;

    // Setup Timeout Guard
    const timeoutPromise = new Promise<never>((_, reject) => {
      if (job.timeoutMs && job.timeoutMs > 0) {
        this.timeoutTimer = setTimeout(() => {
          this.activeAbortController?.abort();
          reject(
            new Error(
              `Job ${job.id} timed out after ${job.timeoutMs}ms on worker ${this.id}`
            )
          );
        }, job.timeoutMs);
      }
    });

    const context: JobExecutionContext = {
      jobId: job.id,
      type: job.type,
      attempt: job.attempt,
      signal,
      updateProgress: (update) => {
        if (this.status === "BUSY" && this.currentJobId === job.id) {
          onProgress(update);
        }
      },
    };

    try {
      // Race handler against timeout and abort
      const result = await Promise.race([
        handler(job.data, context),
        timeoutPromise,
      ]);

      this.jobsProcessed++;
      return result;
    } catch (err: unknown) {
      this.jobsFailed++;
      throw err;
    } finally {
      if (this.timeoutTimer) {
        clearTimeout(this.timeoutTimer);
        this.timeoutTimer = undefined;
      }
      this.activeAbortController = undefined;
      this.currentJobId = undefined;
      if (this.status === "BUSY") {
        this.status = "IDLE";
      }
    }
  }

  /**
   * Abort currently running job on this worker
   */
  public abortCurrentJob(reason?: string): void {
    if (this.activeAbortController) {
      this.activeAbortController.abort(reason || "Job aborted by worker manager");
    }
  }

  public terminate(): void {
    this.abortCurrentJob("Worker terminated");
    this.status = "TERMINATED";
  }
}
