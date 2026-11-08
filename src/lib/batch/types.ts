export type JobPriority = "CRITICAL" | "HIGH" | "NORMAL" | "LOW";

export const PRIORITY_WEIGHTS: Record<JobPriority, number> = {
  CRITICAL: 1,
  HIGH: 2,
  NORMAL: 3,
  LOW: 4,
};

export type JobStatus =
  | "QUEUED"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "RETRYING"
  | "CANCELLED";

export type JobType =
  | "PRICE_SCRAPE"
  | "INVOICE_OCR"
  | "CONTRACT_WATCHDOG"
  | "CREDIT_GRANT_MATCH"
  | "PAYMENT_AUDIT"
  | "CUSTOM";

export interface JobProgressUpdate {
  percent: number;
  message?: string;
  metadata?: Record<string, unknown>;
}

export type JobProgressCallback = (update: JobProgressUpdate) => void;

export interface JobExecutionContext {
  jobId: string;
  type: JobType;
  attempt: number;
  signal: AbortSignal;
  updateProgress: JobProgressCallback;
}

export type JobHandler<TData = unknown, TResult = unknown> = (
  data: TData,
  context: JobExecutionContext
) => Promise<TResult>;

export interface JobOptions {
  priority?: JobPriority;
  maxRetries?: number;
  backoffMs?: number;
  timeoutMs?: number;
  idempotencyKey?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface BatchJob<TData = unknown, TResult = unknown> {
  id: string;
  type: JobType;
  data: TData;
  priority: JobPriority;
  status: JobStatus;
  progress: number;
  progressMessage?: string;
  result?: TResult;
  error?: string;
  attempt: number;
  maxRetries: number;
  backoffMs: number;
  timeoutMs: number;
  idempotencyKey?: string;
  tags: string[];
  metadata?: Record<string, unknown>;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  durationMs?: number;
  assignedWorkerId?: string;
}

export type WorkerStatus = "IDLE" | "RESERVED" | "BUSY" | "PAUSED" | "TERMINATED";

export interface WorkerInfo {
  id: string;
  name: string;
  status: WorkerStatus;
  currentJobId?: string;
  jobsProcessed: number;
  jobsFailed: number;
  activeSince: number;
}

export interface WorkerPoolOptions {
  minWorkers?: number;
  maxWorkers?: number;
  idleTimeoutMs?: number;
  defaultJobTimeoutMs?: number;
  defaultMaxRetries?: number;
  defaultBackoffMs?: number;
}

export interface QueueStats {
  queued: number;
  processing: number;
  completed: number;
  failed: number;
  retrying: number;
  cancelled: number;
  total: number;
  activeWorkers: number;
  idleWorkers: number;
  totalWorkers: number;
  isPaused: boolean;
  averageLatencyMs: number;
  throughputPerMinute: number;
}

export interface BatchQueueEvents {
  "job:queued": (job: BatchJob) => void;
  "job:started": (job: BatchJob, workerId: string) => void;
  "job:progress": (job: BatchJob, progress: JobProgressUpdate) => void;
  "job:completed": (job: BatchJob) => void;
  "job:failed": (job: BatchJob, error: Error) => void;
  "job:retrying": (job: BatchJob, nextAttemptInMs: number) => void;
  "job:cancelled": (job: BatchJob) => void;
  "pool:drained": () => void;
}
