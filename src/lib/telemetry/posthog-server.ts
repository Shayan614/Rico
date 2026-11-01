import { PostHog } from "posthog-node";
import {
  LLMGenerationMetrics,
  GuardrailBlockedEvent,
  PriceAnomalyEvent,
  PaymentCompletedEvent,
  MandateCreatedEvent,
  calculateGeminiCost,
} from "./types";

class PostHogServerTelemetry {
  private client: PostHog | null = null;
  private isConfigured: boolean = false;
  private readonly defaultDistinctId: string = "payagent-server-worker";

  constructor() {
    const apiKey =
      process.env.POSTHOG_API_KEY ||
      process.env.NEXT_PUBLIC_POSTHOG_KEY;

    const host =
      process.env.NEXT_PUBLIC_POSTHOG_HOST ||
      "https://us.i.posthog.com";

    if (
      apiKey &&
      apiKey.trim().length > 5 &&
      !apiKey.includes("your_posthog_project_api_key")
    ) {
      try {
        this.client = new PostHog(apiKey, {
          host,
          flushAt: 1,
          flushInterval: 500,
        });
        this.isConfigured = true;
      } catch (err) {
        console.warn("Failed to initialize PostHog server client:", err);
        this.client = null;
      }
    }
  }

  public isLiveTelemetry(): boolean {
    return this.isConfigured && this.client !== null;
  }

  /**
   * Log LLM generation analytics (token consumption, latency, cost per decision)
   */
  public async trackLLMGeneration(metrics: LLMGenerationMetrics): Promise<void> {
    const totalTokens = metrics.totalTokens ?? metrics.inputTokens + metrics.outputTokens;
    const cost =
      metrics.estimatedCostUsd ??
      calculateGeminiCost(metrics.inputTokens, metrics.outputTokens);

    const distinctId = metrics.distinctId || this.defaultDistinctId;

    const properties = {
      $ai_model: metrics.model,
      $ai_input_tokens: metrics.inputTokens,
      $ai_output_tokens: metrics.outputTokens,
      $ai_total_tokens: totalTokens,
      $ai_latency_ms: metrics.latencyMs,
      $ai_cost_usd: cost,
      $ai_status: metrics.status,
      prompt_snippet: metrics.promptSnippet || "",
      timestamp: new Date().toISOString(),
    };

    if (this.client) {
      this.client.capture({
        distinctId,
        event: "$ai_generation",
        properties,
      });
    } else {
      console.log(
        `[PostHog Telemetry] $ai_generation | Model: ${metrics.model} | Tokens: ${totalTokens} | Latency: ${metrics.latencyMs}ms | Cost: $${cost}`
      );
    }
  }

  /**
   * Capture hard budget ceiling or guardrail halt events
   */
  public async trackGuardrailBlocked(event: GuardrailBlockedEvent): Promise<void> {
    const distinctId = event.distinctId || this.defaultDistinctId;
    const properties = {
      service: event.service,
      attempted_price: event.attemptedPrice,
      budget_ceiling: event.budgetCeiling,
      exceeded_by: event.exceededBy,
      reason: event.reason,
      security_tier: "HARD_BUDGET_CEILING",
      timestamp: new Date().toISOString(),
    };

    if (this.client) {
      this.client.capture({
        distinctId,
        event: "guardrail_blocked",
        properties,
      });
    } else {
      console.log(
        `[PostHog Telemetry] guardrail_blocked | Service: ${event.service} | Blocked: $${event.attemptedPrice} > $${event.budgetCeiling} (${event.reason})`
      );
    }
  }

  /**
   * Capture price anomaly spikes detected during web scraping
   */
  public async trackPriceAnomaly(event: PriceAnomalyEvent): Promise<void> {
    const distinctId = event.distinctId || this.defaultDistinctId;
    const properties = {
      service: event.service,
      current_price: event.currentPrice,
      baseline_price: event.baselinePrice,
      percentage_jump: event.percentageJump,
      hold_triggered: event.holdTriggered,
      security_tier: "ANOMALY_DETECTION",
      timestamp: new Date().toISOString(),
    };

    if (this.client) {
      this.client.capture({
        distinctId,
        event: "price_anomaly_detected",
        properties,
      });
    } else {
      console.log(
        `[PostHog Telemetry] price_anomaly_detected | Service: ${event.service} | Spike: ${event.percentageJump} ($${event.baselinePrice} -> $${event.currentPrice})`
      );
    }
  }

  /**
   * Capture successful PayPal Sandbox MCP payment transactions
   */
  public async trackPaymentCompleted(event: PaymentCompletedEvent): Promise<void> {
    const distinctId = event.distinctId || this.defaultDistinctId;
    const properties = {
      order_id: event.orderId,
      service: event.service,
      amount: event.amount,
      budget_ceiling: event.budgetCeiling,
      savings_enforced: event.savingsEnforced,
      payer_email: event.payerEmail || "sb-buyer2026@personal.example.com",
      payment_method: event.paymentMethod || "PayPal Sandbox MCP Wallet",
      timestamp: new Date().toISOString(),
    };

    if (this.client) {
      this.client.capture({
        distinctId,
        event: "payment_completed",
        properties,
      });
    } else {
      console.log(
        `[PostHog Telemetry] payment_completed | Order: ${event.orderId} | Service: ${event.service} | Amount: $${event.amount} | Saved: $${event.savingsEnforced}`
      );
    }
  }

  /**
   * Capture mandate creation in persistent memory
   */
  public async trackMandateCreated(event: MandateCreatedEvent): Promise<void> {
    const distinctId = event.distinctId || this.defaultDistinctId;
    const properties = {
      mandate_id: event.mandateId,
      service: event.service,
      budget_ceiling: event.budgetCeiling,
      recurrence: event.recurrence,
      strict_mode: event.strictMode,
      timestamp: new Date().toISOString(),
    };

    if (this.client) {
      this.client.capture({
        distinctId,
        event: "mandate_created",
        properties,
      });
    } else {
      console.log(
        `[PostHog Telemetry] mandate_created | ID: ${event.mandateId} | Service: ${event.service} | Cap: $${event.budgetCeiling}`
      );
    }
  }

  /**
   * Generic event capture for custom agent events
   */
  public async capture(event: {
    event: string;
    distinctId?: string;
    properties?: Record<string, unknown>;
  }): Promise<void> {
    const distinctId = event.distinctId || this.defaultDistinctId;
    if (this.client) {
      this.client.capture({
        distinctId,
        event: event.event,
        properties: event.properties,
      });
    } else {
      console.log(`[PostHog Telemetry] ${event.event}`, event.properties);
    }
  }

  /**
   * Evaluate feature flags (e.g., 'strict-approval-mode' or 'autonomous-mode')
   */
  public async isFeatureFlagEnabled(
    flagKey: string,
    distinctId: string = this.defaultDistinctId,
    defaultValue: boolean = false
  ): Promise<boolean> {
    if (this.client) {
      try {
        const isEnabled = await this.client.isFeatureEnabled(flagKey, distinctId);
        return typeof isEnabled === "boolean" ? isEnabled : defaultValue;
      } catch (err) {
        console.warn(`Error evaluating feature flag ${flagKey}:`, err);
        return defaultValue;
      }
    }
    return defaultValue;
  }

  public async shutdown(): Promise<void> {
    if (this.client) {
      await this.client.shutdown();
    }
  }
}

export const posthogServer = new PostHogServerTelemetry();
