/**
 * What a chat message is allowed to do. Only an explicit request may create a spending rule, and
 * only an explicit request to run one may prepare a payment for confirmation. Nothing in chat
 * ever charges: payments need the user's separate confirmation (POST /api/payments/execute).
 */
export type ChatIntent = "greeting" | "create" | "execute" | "info";

export function classifyChatIntent(message: string): ChatIntent {
  const t = message.toLowerCase().replace(/\s+/g, " ").trim();
  if (/^(hi|hello|hey|help|yo|thanks|thank you)\b[\s!.?]*$/.test(t) || /^(hi|hello|hey) /.test(t)) {
    return "greeting";
  }
  // Questions are informational, whatever words they contain ("can you pay netflix?" included).
  const isQuestion = /\?\s*$/.test(t) || /^(how|what|what's|whats|which|when|why|is|are|does|do|can|could|should|tell me|show me|check|compare|verify)\b/.test(t);

  const create =
    /\b(create|register|add|new|set ?up|make)\b.{0,40}\b(mandate|rule|spending rule|subscription rule)\b/.test(t) ||
    (/\b(max|maximum|cap|capped|ceiling|limit|up to)\b/.test(t) &&
      /\b(monthly|weekly|daily|yearly|annually|quarterly|every|each|on the \d|on \d)/.test(t));
  if (create && !isQuestion) return "create";

  const execute = /\b(execute|run|pay|charge)\b.{0,60}\bnow\b/.test(t) || /^(execute|run) (the )?(mandate|rule|spending rule)\b/.test(t);
  if (execute && !isQuestion) return "execute";

  return "info";
}

export interface KnownService {
  keyword: string;
  service: string;
  defaultCeiling: number;
  schedule: string;
}

const KNOWN_SERVICES: KnownService[] = [
  { keyword: "netflix", service: "Netflix Standard HD", defaultCeiling: 20, schedule: "Monthly on 5th" },
  { keyword: "spotify", service: "Spotify Premium", defaultCeiling: 15, schedule: "Monthly on 1st" },
  { keyword: "aws", service: "AWS Cloud Services", defaultCeiling: 120, schedule: "Monthly on 28th" },
  { keyword: "copilot", service: "GitHub Copilot", defaultCeiling: 25, schedule: "Monthly on 15th" },
  { keyword: "github", service: "GitHub Copilot", defaultCeiling: 25, schedule: "Monthly on 15th" },
  { keyword: "adobe", service: "Adobe Creative Cloud", defaultCeiling: 30, schedule: "Monthly on 10th" },
  { keyword: "posthog", service: "PostHog", defaultCeiling: 150, schedule: "Monthly on 1st" },
  { keyword: "notion", service: "Notion", defaultCeiling: 20, schedule: "Monthly on 1st" },
  { keyword: "chatgpt", service: "ChatGPT Plus", defaultCeiling: 25, schedule: "Monthly on 1st" },
];

/** A supported service named in the message, or null. There is no generic fallback service. */
export function detectKnownService(message: string): KnownService | null {
  const t = message.toLowerCase();
  return KNOWN_SERVICES.find((s) => new RegExp(`\\b${s.keyword}\\b`).test(t)) ?? null;
}
