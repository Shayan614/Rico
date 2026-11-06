import { RateLimitConfig, RateLimitStatus } from "./types";

interface WindowRecord {
  id: number;
  timestamp: number;
  tokens: number;
}

interface QueuedItem {
  resolve: (id: number) => void;
  reject: (err: Error) => void;
  estimatedTokens: number;
}

export class DeepSeekRateLimiter {
  private config: RateLimitConfig;
  private windowHistory: WindowRecord[] = [];
  private activeRequests: number = 0;
  private queue: QueuedItem[] = [];
  private isProcessingQueue: boolean = false;
  private nextRecordId: number = 0;
  private readonly windowMs: number = 60000; // 1 minute sliding window

  constructor(config?: Partial<RateLimitConfig>) {
    this.config = {
      maxRequestsPerMinute: config?.maxRequestsPerMinute ?? 60, // 60 RPM default
      maxTokensPerMinute: config?.maxTokensPerMinute ?? 100000, // 100k TPM default
      maxConcurrentRequests: config?.maxConcurrentRequests ?? 5, // 5 parallel requests
      retryDelayMs: config?.retryDelayMs ?? 1000,
      maxRetries: config?.maxRetries ?? 3,
    };
  }

  /**
   * Remove records older than 1 minute sliding window
   */
  private pruneWindow(): void {
    const cutoff = Date.now() - this.windowMs;
    this.windowHistory = this.windowHistory.filter((r) => r.timestamp > cutoff);
  }

  /**
   * Get current window usage
   */
  public getStatus(): RateLimitStatus {
    this.pruneWindow();
    const requestsInWindow = this.windowHistory.length;
    const tokensInWindow = this.windowHistory.reduce((acc, r) => acc + r.tokens, 0);

    const isThrottled =
      requestsInWindow >= this.config.maxRequestsPerMinute ||
      tokensInWindow >= this.config.maxTokensPerMinute ||
      this.activeRequests >= this.config.maxConcurrentRequests;

    return {
      requestsInWindow,
      tokensInWindow,
      activeRequests: this.activeRequests,
      queuedRequests: this.queue.length,
      isThrottled,
      rpmLimit: this.config.maxRequestsPerMinute,
      tpmLimit: this.config.maxTokensPerMinute,
      concurrencyLimit: this.config.maxConcurrentRequests,
      remainingRPM: Math.max(0, this.config.maxRequestsPerMinute - requestsInWindow),
      remainingTPM: Math.max(0, this.config.maxTokensPerMinute - tokensInWindow),
    };
  }

  /**
   * Wait until rate limit allows the request through. Returns a lease record ID.
   */
  public async acquire(estimatedTokens: number = 500): Promise<number> {
    this.pruneWindow();

    const status = this.getStatus();
    const wouldExceedRPM = status.requestsInWindow + 1 > this.config.maxRequestsPerMinute;
    const wouldExceedTPM = status.tokensInWindow + estimatedTokens > this.config.maxTokensPerMinute;
    const wouldExceedConcurrency = this.activeRequests >= this.config.maxConcurrentRequests;

    if (!wouldExceedRPM && !wouldExceedTPM && !wouldExceedConcurrency) {
      const recordId = ++this.nextRecordId;
      this.activeRequests++;
      this.windowHistory.push({
        id: recordId,
        timestamp: Date.now(),
        tokens: estimatedTokens,
      });
      return recordId;
    }

    // Must queue request
    return new Promise<number>((resolve, reject) => {
      this.queue.push({ resolve, reject, estimatedTokens });
      this.scheduleQueueDrain();
    });
  }

  /**
   * Release request slot and process queued tasks
   */
  public release(recordId?: number, actualTokensUsed?: number): void {
    this.activeRequests = Math.max(0, this.activeRequests - 1);

    if (recordId !== undefined) {
      const record = this.windowHistory.find((r) => r.id === recordId);
      if (record && actualTokensUsed !== undefined) {
        record.tokens = Math.max(0, actualTokensUsed);
      }
    }

    this.scheduleQueueDrain();
  }

  /**
   * Drain queue when capacity frees up
   */
  private scheduleQueueDrain(): void {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;

    setTimeout(() => {
      this.drainQueue();
      this.isProcessingQueue = false;
    }, 50);
  }

  private drainQueue(): void {
    this.pruneWindow();

    while (this.queue.length > 0) {
      const next = this.queue[0];
      const status = this.getStatus();

      const wouldExceedRPM = status.requestsInWindow + 1 > this.config.maxRequestsPerMinute;
      const wouldExceedTPM = status.tokensInWindow + next.estimatedTokens > this.config.maxTokensPerMinute;
      const wouldExceedConcurrency = this.activeRequests >= this.config.maxConcurrentRequests;

      if (wouldExceedRPM || wouldExceedTPM || wouldExceedConcurrency) {
        // Find earliest timestamp in window to determine backoff sleep
        const earliest = this.windowHistory[0]?.timestamp || Date.now();
        const waitMs = Math.max(100, earliest + this.windowMs - Date.now() + 50);

        setTimeout(() => this.scheduleQueueDrain(), waitMs);
        break;
      }

      // Dequeue and admit
      this.queue.shift();
      const recordId = ++this.nextRecordId;
      this.activeRequests++;
      this.windowHistory.push({
        id: recordId,
        timestamp: Date.now(),
        tokens: next.estimatedTokens,
      });

      next.resolve(recordId);
    }
  }

  /**
   * Execute an async function with rate limit admission, automatic release, and exponential backoff on 429
   */
  public async executeWithRateLimit<T>(
    fn: () => Promise<T>,
    estimatedTokens: number = 500
  ): Promise<T> {
    let attempt = 0;

    while (attempt <= this.config.maxRetries) {
      const recordId = await this.acquire(estimatedTokens);

      try {
        const result = await fn();
        this.release(recordId, estimatedTokens);
        return result;
      } catch (err: unknown) {
        this.release(recordId, 0);
        attempt++;

        const isRateLimited =
          err instanceof Error &&
          (err.message.includes("429") ||
            err.message.toLowerCase().includes("rate limit") ||
            err.message.toLowerCase().includes("quota exceeded"));

        if (isRateLimited && attempt <= this.config.maxRetries) {
          // Exponential backoff with random jitter
          const jitter = Math.random() * 200;
          const backoff = this.config.retryDelayMs * Math.pow(2, attempt) + jitter;
          console.warn(`[DeepSeek Rate Limit] 429 hit. Retrying attempt ${attempt}/${this.config.maxRetries} after ${Math.round(backoff)}ms...`);
          await new Promise((r) => setTimeout(r, backoff));
          continue;
        }

        throw err;
      }
    }

    throw new Error(`Exceeded max retries (${this.config.maxRetries}) due to rate limits.`);
  }

  /**
   * Reset rate limiter state (useful in tests)
   */
  public reset(): void {
    this.windowHistory = [];
    this.activeRequests = 0;
    this.queue = [];
  }
}
