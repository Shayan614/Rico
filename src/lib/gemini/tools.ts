import { Type, FunctionDeclaration } from "@google/genai";

export const createMandateTool: FunctionDeclaration = {
  name: "create_mandate",
  description:
    "Registers a new autonomous recurring financial mandate with a hard budget ceiling in the persistent database.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      service: {
        type: Type.STRING,
        description: "The name of the subscription, merchant, or service (e.g. 'Netflix Standard HD', 'Spotify Premium').",
      },
      max_amount: {
        type: Type.NUMBER,
        description: "Maximum allowable budget ceiling in USD (e.g. 20.00). Payments above this will be blocked.",
      },
      schedule: {
        type: Type.STRING,
        description: "Recurrence schedule rule (e.g. 'Monthly on 5th', 'Weekly on Monday', 'Annual').",
      },
      currency: {
        type: Type.STRING,
        description: "Three-letter ISO currency code (default: 'USD').",
      },
      category: {
        type: Type.STRING,
        description: "Category of the expense (e.g. 'Entertainment', 'Cloud', 'Productivity', 'Music').",
      },
      strict_mode: {
        type: Type.BOOLEAN,
        description: "Whether this mandate requires human approval before payment execution.",
      },
    },
    required: ["service", "max_amount", "schedule"],
  },
};

export const verifyWebPriceTool: FunctionDeclaration = {
  name: "verify_web_price",
  description:
    "Launches the Playwright headless web automation engine to inspect the merchant's live pricing page and verify current subscription rates.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      service_name: {
        type: Type.STRING,
        description: "The name of the service to verify (e.g. 'Netflix', 'Spotify', 'GitHub Copilot').",
      },
      service_url: {
        type: Type.STRING,
        description: "Optional URL of the merchant pricing page. If omitted, the browser agent navigates automatically.",
      },
      expected_price: {
        type: Type.NUMBER,
        description: "Expected or baseline price to check for price spike anomalies (>20% jump).",
      },
    },
    required: ["service_name"],
  },
};

export const executePayPalPaymentTool: FunctionDeclaration = {
  name: "execute_paypal_payment",
  description:
    "Authorizes and captures a live payment transaction through the official PayPal Sandbox MCP Server / Orders API, returning a digital receipt.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      service_name: {
        type: Type.STRING,
        description: "Target merchant or subscription service receiving payment.",
      },
      verified_price: {
        type: Type.NUMBER,
        description: "The verified real-time price in USD to be charged.",
      },
      budget_ceiling: {
        type: Type.NUMBER,
        description: "The user-authorized budget ceiling. The payment engine enforces that verified_price <= budget_ceiling.",
      },
      mandate_id: {
        type: Type.STRING,
        description: "Optional ID of the registered mandate associated with this payment.",
      },
      funding_rail: {
        type: Type.STRING,
        description: "Dual-rail payment funding route: 'PAYPAL' (Primary PayPal digital wallet), 'VISA' (Backup Vaulted Visa Signature), 'MASTERCARD' (Backup Vaulted Mastercard World Elite), or 'AUTO' (Smart cascading from PayPal with automatic card fallback). Defaults to 'AUTO'.",
      },
      recipient_email: {
        type: Type.STRING,
        description: "Optional recipient email address or merchant identifier.",
      },
      description: {
        type: Type.STRING,
        description: "Optional payment description (e.g. 'Automated subscription mandate execution').",
      },
    },
    required: ["service_name", "verified_price", "budget_ceiling"],
  },
};

export const compareMultiServicePricesTool: FunctionDeclaration = {
  name: "compare_multi_service_prices",
  description:
    "Spawns parallel Playwright helper bots to concurrently verify and compare live pricing across multiple merchant websites simultaneously (e.g. comparing Netflix vs Spotify, or GitHub Copilot vs ChatGPT Plus). Returns side-by-side rates and best deal recommendations.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      services: {
        type: Type.ARRAY,
        items: {
          type: Type.STRING,
        },
        description: "List of merchant or subscription services to compare simultaneously.",
      },
      category: {
        type: Type.STRING,
        description: "Optional category preset: 'streaming', 'devtools', or 'cloud'.",
      },
    },
    required: ["services"],
  },
};

export const checkPersonaSavingsTool: FunctionDeclaration = {
  name: "check_persona_savings",
  description:
    "Intercepts a planned payment or mandate to probe for eligible persona-based subsidies, including $50k PostHog and Notion startup credits, 50% Student Discounts (Spotify, Adobe, GitHub), active promo coupons, and annual billing arbitrage.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      service_name: {
        type: Type.STRING,
        description: "Merchant or subscription name (e.g. 'PostHog', 'Spotify', 'Notion', 'Adobe Creative Cloud', 'AWS').",
      },
      current_price: {
        type: Type.NUMBER,
        description: "The current or scraped subscription price to check for discounts.",
      },
      persona: {
        type: Type.STRING,
        description: "User profession or profile: 'STARTUP_FOUNDER' (claims SaaS startup credits), 'STUDENT' (claims 50% education discounts), or 'DEVELOPER_SMB' (claims coupons and annual arbitrage). Defaults to 'STARTUP_FOUNDER'.",
      },
    },
    required: ["service_name", "current_price"],
  },
};

export const payAgentTools = [
  {
    functionDeclarations: [
      createMandateTool,
      verifyWebPriceTool,
      checkPersonaSavingsTool,
      compareMultiServicePricesTool,
      executePayPalPaymentTool,
    ],
  },
];

