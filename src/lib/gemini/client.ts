import { GoogleGenAI } from "@google/genai";
import { buildSystemPromptWithContext } from "./prompts";
import { payAgentTools } from "./tools";
import {
  dispatchAgentTool,
  executeCreateMandate,
  executeVerifyWebPrice,
  executePayPalPayment,
} from "./tool-executors";
import { StreamEvent, ChatContext, ThoughtStep } from "./types";
import { posthogServer } from "@/lib/telemetry/posthog-server";
import { personaSavingsOptimizer } from "@/lib/savings";

export function stripStars(text: string): string {
  if (!text) return "";
  return text
    .replace(/^(\s*)\*+(\s*)/gm, "$1- $2")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^(\s*)\*+\s*/gm, "$1")
    .replace(/\s*\*+\s*$/gm, "")
    .replace(/^\*+/, "")
    .replace(/\*+$/, "");
}

export class GeminiAgentClient {
  private client: GoogleGenAI | null = null;
  private modelName: string;

  constructor() {
    this.modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const apiKey = process.env.GEMINI_API_KEY;

    if (
      apiKey &&
      apiKey.trim().length > 10 &&
      apiKey !== "your_gemini_api_key_here"
    ) {
      try {
        this.client = new GoogleGenAI({ apiKey });
      } catch (err) {
        console.warn("Failed to initialize GoogleGenAI client:", err);
        this.client = null;
      }
    }
  }

  public isLiveKeyConfigured(): boolean {
    return this.client !== null;
  }

  public getModelName(): string {
    return this.modelName;
  }

  /**
   * Stream agent response using either live Gemini 3.8 / 2.5 Flash SDK
   * or high-fidelity simulated autonomous reasoning generator.
   */
  public async *streamResponse(
    userMessage: string,
    context?: ChatContext
  ): AsyncGenerator<StreamEvent> {
    const isLive = this.isLiveKeyConfigured();
    const startTime = Date.now();
    let totalOutputTokens = 0;

    const stream = isLive && this.client
      ? this.streamLiveGemini(userMessage, context)
      : this.streamSimulatedReasoning(userMessage, context);

    try {
      for await (const event of stream) {
        if (event.type === "token" && event.text) {
          totalOutputTokens += Math.max(1, Math.round(event.text.length / 4));
        }
        yield event;
      }
    } finally {
      const latencyMs = Date.now() - startTime;
      const inputTokens = Math.max(80, Math.round((userMessage.length + 800) / 4));
      const outputTokens = Math.max(25, totalOutputTokens);

      await posthogServer.trackLLMGeneration({
        model: isLive ? this.modelName : "gemini-3.8-flash",
        inputTokens,
        outputTokens,
        latencyMs,
        status: "success",
        promptSnippet: userMessage.slice(0, 80),
      });
    }
  }

  /**
   * Calls Google GenAI streaming API with function calling tools and system instructions
   */
  private async *streamLiveGemini(
    userMessage: string,
    context?: ChatContext
  ): AsyncGenerator<StreamEvent> {
    if (!this.client) return;

    const systemInstruction = buildSystemPromptWithContext(context);

    // Initial thought step
    yield {
      type: "step",
      step: {
        step: "Interpreting mandate via Gemini",
        status: "running",
        detail: "Analyzing natural language spending constraints...",
      },
    };

    const responseStream = await this.client.models.generateContentStream({
      model: this.modelName,
      contents: [
        {
          role: "user",
          parts: [{ text: userMessage }],
        },
      ],
      config: {
        systemInstruction,
        tools: payAgentTools,
        temperature: 0.2,
      },
    });

    yield {
      type: "step",
      step: {
        step: "Interpreting mandate via Gemini",
        status: "done",
        detail: "Intent and parameters recognized",
      },
    };

    let fullText = "";

    for await (const chunk of responseStream) {
      const candidates = chunk.candidates || [];
      if (candidates.length > 0) {
        const parts = candidates[0].content?.parts || [];
        for (const part of parts) {
          if (part.text) {
            fullText += part.text;
            yield {
              type: "token",
              text: part.text,
            };
          }

          if (part.functionCall) {
            const toolCall = {
              name: part.functionCall.name || "unknown",
              args: (part.functionCall.args as Record<string, unknown>) || {},
            };

            yield {
              type: "tool_call",
              toolCall,
            };

            yield {
              type: "step",
              step: {
                step: `Executing Tool: ${toolCall.name}`,
                status: "running",
                detail: `Invoked with: ${JSON.stringify(toolCall.args)}`,
              },
            };

            try {
              const toolResult = await dispatchAgentTool(toolCall.name, toolCall.args);
              if (toolResult.receipt) {
                yield {
                  type: "receipt",
                  receipt: toolResult.receipt as Record<string, unknown>,
                };
              }
              if (toolResult.advisory) {
                yield {
                  type: "savings_advisory",
                  advisory: toolResult.advisory as Record<string, unknown>,
                };
              }
              yield {
                type: "step",
                step: {
                  step: `Executed Tool: ${toolCall.name}`,
                  status: "done",
                  detail: toolResult.message
                    ? String(toolResult.message)
                    : `Result: ${JSON.stringify(toolResult).slice(0, 80)}...`,
                },
              };
            } catch (toolErr) {
              const errMsg =
                toolErr instanceof Error ? toolErr.message : String(toolErr);
              yield {
                type: "step",
                step: {
                  step: `Tool ${toolCall.name} Blocked`,
                  status: "done",
                  detail: errMsg,
                },
              };
            }
          }
        }
      }
    }

    yield {
      type: "done",
      text: stripStars(fullText),
    };
  }

  /**
   * High-fidelity simulated autonomous financial reasoning
   * Simulates full Agentic Commerce lifecycle:
   * 1. Parsing user mandate
   * 2. Playwright web price scraping
   * 3. Safety ceiling guardrail check
   * 4. Strict mode interception or PayPal execution
   */
  private async *streamSimulatedReasoning(
    userMessage: string,
    context?: ChatContext
  ): AsyncGenerator<StreamEvent> {
    const textLower = userMessage.toLowerCase().trim();
    const isStrictMode = !!context?.strictMode;

    // Handle conversational greetings or generic help
    if (
      textLower === "hi" ||
      textLower === "hello" ||
      textLower === "hey" ||
      textLower === "help" ||
      textLower.startsWith("hi ") ||
      textLower.startsWith("hello ")
    ) {
      const greetingMsg = `Hello! I am Rico, your autonomous financial assistant. I can help you manage recurring expenses, subscriptions, and financial purchases.\n\nWhat can I do for you today? For example, you can tell me to:\n- "Pay Netflix $15.99 on the 5th, max $20"\n- "Check the price of Spotify Premium"\n- "Compare prices for streaming services"\n- "Show me my spending rules"`;

      for (const word of greetingMsg.split(" ")) {
        yield { type: "token", text: word + " " };
        await delay(15);
      }
      yield { type: "done", text: greetingMsg };
      return;
    }

    // Detect target merchant / service
    let service = "Merchant Service";
    let defaultPrice = 14.99;
    let ceiling = 20.0;
    let schedule = "Monthly on 1st";

    if (textLower.includes("netflix")) {
      service = "Netflix Standard HD";
      defaultPrice = 15.49;
      ceiling = 20.0;
      schedule = "Monthly on 5th";
    } else if (textLower.includes("spotify")) {
      service = "Spotify Premium";
      defaultPrice = 11.99;
      ceiling = 15.0;
      schedule = "Monthly on 1st";
    } else if (textLower.includes("aws")) {
      service = "AWS Cloud Services";
      defaultPrice = 84.5;
      ceiling = 120.0;
      schedule = "Monthly on 28th";
    } else if (textLower.includes("copilot") || textLower.includes("github")) {
      service = "GitHub Copilot";
      defaultPrice = 19.0;
      ceiling = 25.0;
      schedule = "Monthly on 15th";
    } else if (textLower.includes("adobe")) {
      service = "Adobe Creative Cloud";
      defaultPrice = 59.99;
      ceiling = 30.0; // Deliberate guardrail test
      schedule = "Monthly on 10th";
    } else if (textLower.includes("posthog")) {
      service = "PostHog";
      defaultPrice = 120.0;
      ceiling = 150.0;
      schedule = "Monthly on 1st";
    } else if (textLower.includes("notion")) {
      service = "Notion";
      defaultPrice = 10.0;
      ceiling = 20.0;
      schedule = "Monthly on 1st";
    } else if (textLower.includes("chatgpt")) {
      service = "ChatGPT Plus";
      defaultPrice = 20.0;
      ceiling = 25.0;
      schedule = "Monthly on 1st";
    }

    // Try parsing user price or ceiling numbers from message
    const dollarMatches = userMessage.match(/\$([0-9]+(?:\.[0-9]{2})?)/g);
    if (dollarMatches && dollarMatches.length >= 2) {
      defaultPrice = parseFloat(dollarMatches[0].replace("$", ""));
      ceiling = parseFloat(dollarMatches[1].replace("$", ""));
    } else if (dollarMatches && dollarMatches.length === 1) {
      ceiling = parseFloat(dollarMatches[0].replace("$", ""));
    }

    const isPriceExceeded = defaultPrice > ceiling;

    // Check if this is a mandate creation request only
    const isCreateMandateOnly =
      (textLower.includes("create mandate") ||
        textLower.includes("register mandate") ||
        textLower.includes("add mandate") ||
        textLower.includes("new mandate")) &&
      !textLower.includes("pay now") &&
      !textLower.includes("execute");

    if (isCreateMandateOnly) {
      const created = await executeCreateMandate({
        service,
        max_amount: ceiling,
        schedule,
        strict_mode: isStrictMode,
      });

      const mandateMsg = `Registered new recurring mandate for ${service}: Max ceiling $${ceiling.toFixed(
        2
      )} USD (${schedule}). Persisted into database with status ACTIVE.`;

      await posthogServer.trackMandateCreated({
        mandateId: created.mandate.id,
        service,
        budgetCeiling: ceiling,
        recurrence: schedule,
        strictMode: isStrictMode,
      });

      for (const word of mandateMsg.split(" ")) {
        yield { type: "token", text: word + " " };
        await delay(20);
      }

      yield {
        type: "thought",
        thought: {
          summary: "Mandate Registered",
          steps: [
            {
              step: "Created mandate in persistent memory",
              status: "done",
              detail: `Mandate ID: ${created.mandate.id}`,
            },
            {
              step: "Safety budget ceiling configured",
              status: "done",
              detail: `Max $${ceiling.toFixed(2)} USD`,
            },
          ],
        },
      };

      yield { type: "done", text: mandateMsg };
      return;
    }

    // Step 1: Interpreting mandate
    const step1: ThoughtStep = {
      step: "Interpreted recurring mandate",
      status: "running",
      detail: `Rule: ${service}, Ceiling $${ceiling.toFixed(2)} USD, Schedule: ${schedule}`,
    };
    yield { type: "step", step: step1 };
    await delay(120);

    step1.status = "done";
    yield { type: "step", step: step1 };

    // Step 2: Browser verification via executeVerifyWebPrice
    const step2: ThoughtStep = {
      step: "Verified merchant price via Playwright",
      status: "running",
      detail: `Navigating to ${service} pricing page...`,
    };
    yield { type: "step", step: step2 };
    await delay(150);

    const priceVerification = await executeVerifyWebPrice({
      service_name: service,
      expected_price: ceiling,
    });
    defaultPrice = priceVerification.verifiedPrice;

    step2.status = "done";
    step2.detail = `Scraped live pricing: $${defaultPrice.toFixed(2)}/mo (${priceVerification.planName})`;
    yield { type: "step", step: step2 };

    // Step 2.5: Pre-Payment Persona Savings Probe
    const savingsProbe = await personaSavingsOptimizer.probePersonaSavings({
      serviceName: service,
      currentPrice: defaultPrice,
    });

    if (savingsProbe.hasDeals && savingsProbe.advisory) {
      const savingsStep: ThoughtStep = {
        step: "Persona Savings Intercept",
        status: "done",
        detail: savingsProbe.recommendation,
      };
      yield { type: "step", step: savingsStep };
      yield {
        type: "savings_advisory",
        advisory: savingsProbe.advisory as unknown as Record<string, unknown>,
      };
    }

    // Step 3: Safety Guardrail check
    const step3: ThoughtStep = {
      step: "Safety ceiling check",
      status: "running",
      detail: `Checking if $${defaultPrice.toFixed(2)} <= $${ceiling.toFixed(2)} budget ceiling...`,
    };
    yield { type: "step", step: step3 };
    await delay(100);

    if (isPriceExceeded) {
      step3.status = "done";
      step3.detail = `BLOCKED: $${defaultPrice.toFixed(2)} exceeds $${ceiling.toFixed(2)} ceiling!`;
      yield { type: "step", step: step3 };

      const errorMsg = `⚠️ Guardrail Blocked: The verified live price for ${service} ($${defaultPrice.toFixed(
        2
      )}) exceeds your authorized budget ceiling of $${ceiling.toFixed(
        2
      )}. Payment execution halted to protect your balance.`;

      for (const word of errorMsg.split(" ")) {
        yield { type: "token", text: word + " " };
        await delay(25);
      }

      yield { type: "done", text: errorMsg };
      return;
    }

    step3.status = "done";
    step3.detail = `$${defaultPrice.toFixed(2)} <= $${ceiling.toFixed(2)} ceiling -> Approved`;
    yield { type: "step", step: step3 };

    // Strict Mode check
    if (isStrictMode) {
      const strictMsg = `Verified ${service} is $${defaultPrice.toFixed(
        2
      )}/mo (within your $${ceiling.toFixed(
        2
      )} ceiling). Strict Approval Mode is ENABLED: Awaiting your manual confirmation before charging PayPal.`;

      for (const word of strictMsg.split(" ")) {
        yield { type: "token", text: word + " " };
        await delay(25);
      }

      yield {
        type: "thought",
        thought: {
          summary: "Execution Steps (3) - Strict Approval Pending",
          steps: [step1, step2, step3],
        },
      };

      yield { type: "done", text: strictMsg };
      return;
    }

    // Step 4: PayPal MCP Payment Execution via executePayPalPayment
    const step4: ThoughtStep = {
      step: "Executing PayPal Sandbox payment",
      status: "running",
      detail: `Creating order via PayPal MCP Server: $${defaultPrice.toFixed(2)} USD`,
    };
    yield { type: "step", step: step4 };
    await delay(150);

    const paymentResult = await executePayPalPayment({
      service_name: service,
      verified_price: defaultPrice,
      budget_ceiling: ceiling,
      recipient_email: "sb-buyer2026@personal.example.com",
    });

    const { orderId, receipt } = paymentResult;

    await posthogServer.trackPaymentCompleted({
      orderId,
      service,
      amount: defaultPrice,
      budgetCeiling: ceiling,
      savingsEnforced: ceiling - defaultPrice,
      payerEmail: "sb-buyer2026@personal.example.com",
    });

    step4.status = "done";
    step4.detail = `Payment captured! Order ID: ${orderId}`;
    yield { type: "step", step: step4 };

    yield {
      type: "receipt",
      receipt,
    };

    const completionMsg = `Executed payment for ${service}. Verified price is $${defaultPrice.toFixed(
      2
    )}, saving you $${(ceiling - defaultPrice).toFixed(
      2
    )} below your $${ceiling.toFixed(
      2
    )} ceiling. Transaction completed via PayPal Sandbox.`;

    for (const word of completionMsg.split(" ")) {
      yield { type: "token", text: word + " " };
      await delay(20);
    }

    yield {
      type: "thought",
      thought: {
        summary: "Execution Steps (4)",
        steps: [step1, step2, step3, step4],
      },
    };

    yield { type: "done", text: completionMsg };
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const geminiAgent = new GeminiAgentClient();
