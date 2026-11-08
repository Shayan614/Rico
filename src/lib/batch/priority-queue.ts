import { BatchJob, PRIORITY_WEIGHTS } from "./types";

export class PriorityJobQueue {
  private heap: BatchJob[] = [];
  private idempotencyMap: Map<string, string> = new Map(); // idempotencyKey -> jobId
  private idMap: Map<string, BatchJob> = new Map(); // jobId -> BatchJob

  /**
   * Check if a job with this idempotency key already exists in active/queued state
   */
  public hasIdempotencyKey(key: string): boolean {
    return this.idempotencyMap.has(key);
  }

  public getJobByIdempotencyKey(key: string): BatchJob | undefined {
    const id = this.idempotencyMap.get(key);
    return id ? this.idMap.get(id) : undefined;
  }

  /**
   * Enqueue a job into the priority heap
   */
  public enqueue(job: BatchJob): void {
    if (job.idempotencyKey) {
      this.idempotencyMap.set(job.idempotencyKey, job.id);
    }
    this.idMap.set(job.id, job);

    this.heap.push(job);
    this.bubbleUp(this.heap.length - 1);
  }

  /**
   * Dequeue the highest-priority job (min-heap root)
   */
  public dequeue(): BatchJob | undefined {
    if (this.heap.length === 0) return undefined;

    const root = this.heap[0];
    const tail = this.heap.pop()!;

    if (this.heap.length > 0) {
      this.heap[0] = tail;
      this.sinkDown(0);
    }

    return root;
  }

  /**
   * Peek at the highest-priority job without removing it
   */
  public peek(): BatchJob | undefined {
    return this.heap[0];
  }

  public size(): number {
    return this.heap.length;
  }

  public isEmpty(): boolean {
    return this.heap.length === 0;
  }

  public get(id: string): BatchJob | undefined {
    return this.idMap.get(id);
  }

  /**
   * Remove a job from the queue by ID
   */
  public remove(id: string): BatchJob | undefined {
    const index = this.heap.findIndex((j) => j.id === id);
    if (index === -1) return undefined;

    const job = this.heap[index];
    const tail = this.heap.pop()!;

    if (index < this.heap.length) {
      this.heap[index] = tail;
      this.bubbleUp(index);
      this.sinkDown(index);
    }

    if (job.idempotencyKey) {
      this.idempotencyMap.delete(job.idempotencyKey);
    }
    this.idMap.delete(id);

    return job;
  }

  /**
   * Release idempotency key when job is finished/cancelled
   */
  public releaseIdempotencyKey(key?: string): void {
    if (key) {
      this.idempotencyMap.delete(key);
    }
  }

  public clear(): void {
    this.heap = [];
    this.idempotencyMap.clear();
    this.idMap.clear();
  }

  public getAll(): BatchJob[] {
    return [...this.heap];
  }

  private compare(a: BatchJob, b: BatchJob): number {
    const weightA = PRIORITY_WEIGHTS[a.priority] ?? 3;
    const weightB = PRIORITY_WEIGHTS[b.priority] ?? 3;

    if (weightA !== weightB) {
      return weightA - weightB; // Lower weight = higher priority
    }

    // Tie-break: FIFO order by createdAt
    return a.createdAt - b.createdAt;
  }

  private bubbleUp(index: number): void {
    const element = this.heap[index];

    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      const parent = this.heap[parentIndex];

      if (this.compare(element, parent) >= 0) break;

      this.heap[index] = parent;
      this.heap[parentIndex] = element;
      index = parentIndex;
    }
  }

  private sinkDown(index: number): void {
    const length = this.heap.length;
    const element = this.heap[index];

    while (true) {
      const leftChildIndex = 2 * index + 1;
      const rightChildIndex = 2 * index + 2;
      let swapIndex: number | null = null;

      if (leftChildIndex < length) {
        if (this.compare(this.heap[leftChildIndex], element) < 0) {
          swapIndex = leftChildIndex;
        }
      }

      if (rightChildIndex < length) {
        const compareTarget = swapIndex === null ? element : this.heap[leftChildIndex];
        if (this.compare(this.heap[rightChildIndex], compareTarget) < 0) {
          swapIndex = rightChildIndex;
        }
      }

      if (swapIndex === null) break;

      this.heap[index] = this.heap[swapIndex];
      this.heap[swapIndex] = element;
      index = swapIndex;
    }
  }
}
