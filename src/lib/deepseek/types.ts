export type DeepSeekModel = "deepseek-chat" | "deepseek-reasoner";

export interface DeepSeekMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface DeepSeekChatOptions {
  model?: DeepSeekModel;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stream?: boolean;
}

export interface DeepSeekUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
}

export interface DeepSeekChatResponse {
  id: string;
  model: DeepSeekModel;
  content: string;
  usage: DeepSeekUsage;
  latencyMs: number;
  mode: "LIVE_API" | "SIMULATED_SANDBOX";
}

export interface DeepSeekStreamChunk {
  id: string;
  delta: string;
  done: boolean;
}

export interface RateLimitConfig {
  /** Maximum requests allowed per minute window */
  maxRequestsPerMinute: number;
  /** Maximum tokens allowed per minute window */
  maxTokensPerMinute: number;
  /** Maximum parallel requests in flight */
  maxConcurrentRequests: number;
  /** Backoff retry delay when rate limited (ms) */
  retryDelayMs: number;
  /** Max retries upon 429 rate limit */
  maxRetries: number;
}

export interface RateLimitStatus {
  requestsInWindow: number;
  tokensInWindow: number;
  activeRequests: number;
  queuedRequests: number;
  isThrottled: boolean;
  rpmLimit: number;
  tpmLimit: number;
  concurrencyLimit: number;
  remainingRPM: number;
  remainingTPM: number;
}

export interface BatchTask<TInput = unknown, TOutput = unknown> {
  id: string;
  input: TInput;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  result?: TOutput;
  error?: string;
  durationMs?: number;
}

export interface BatchProcessingSummary<TOutput = unknown> {
  total: number;
  completed: number;
  failed: number;
  durationMs: number;
  totalTokens: number;
  estimatedCostUsd: number;
  results: Array<BatchTask<unknown, TOutput>>;
}
