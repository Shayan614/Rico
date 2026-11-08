import { CreditProgram } from "./types";

export const STARTUP_CREDITS_CATALOG: CreditProgram[] = [
  // 1. PostHog for Startups
  {
    id: "posthog-startups",
    name: "PostHog for Startups",
    provider: "PostHog",
    category: "ANALYTICS",
    maxCreditValueUsd: 50000,
    creditTermMonths: 12,
    programUrl: "https://posthog.com/startups",
    badge: "$50k Analytics & Telemetry",
    eligibility: {
      maxCompanyAgeYears: 2,
      maxFundingRaisedUsd: 5000000,
      allowedStages: ["BOOTSTRAPPED", "PRE_SEED", "SEED"],
      requiresWebsite: true,
    },
    overview:
      "Full access to PostHog product analytics, session replay, feature flags, A/B testing, and LLM observability telemetry.",
    sampleQuestions: [
      {
        id: "traction",
        question: "What is your product's current traction and user growth?",
        guideline: "Highlight monthly active users, beta signups, and transaction volume.",
      },
      {
        id: "use_case",
        question: "How will your team leverage PostHog to grow?",
        guideline: "Explain tracking AI latency, agent execution steps, and funnel conversions.",
      },
    ],
  },

  // 2. AWS Activate
  {
    id: "aws-activate",
    name: "AWS Activate Founders & Portfolio",
    provider: "Amazon Web Services",
    category: "CLOUD",
    maxCreditValueUsd: 25000,
    creditTermMonths: 24,
    programUrl: "https://aws.amazon.com/activate/",
    badge: "$25k Cloud Compute",
    eligibility: {
      maxCompanyAgeYears: 5,
      maxFundingRaisedUsd: 10000000,
      allowedStages: ["BOOTSTRAPPED", "PRE_SEED", "SEED", "SERIES_A"],
      requiresWebsite: true,
    },
    overview:
      "Cloud infrastructure credits applicable to EC2, S3, RDS, Amazon Bedrock generative AI, and AWS Business Support.",
    sampleQuestions: [
      {
        id: "architecture",
        question: "Describe your technical architecture and AWS services used.",
        guideline: "Detail containerization, serverless endpoints, and model inference setup.",
      },
      {
        id: "scalability",
        question: "What is your infrastructure roadmap over the next 12 months?",
        guideline: "Focus on multi-region low latency, telemetry ingestion, and data pipelines.",
      },
    ],
  },

  // 3. Microsoft for Startups Founders Hub / OpenAI
  {
    id: "microsoft-founders-hub",
    name: "Microsoft for Startups Founders Hub",
    provider: "Microsoft & OpenAI",
    category: "AI_COMPUTE",
    maxCreditValueUsd: 25000,
    creditTermMonths: 12,
    programUrl: "https://foundershub.startups.microsoft.com/",
    badge: "$25k Azure OpenAI Credits",
    eligibility: {
      maxCompanyAgeYears: 5,
      maxFundingRaisedUsd: 15000000,
      allowedStages: ["BOOTSTRAPPED", "PRE_SEED", "SEED", "SERIES_A"],
      requiresWebsite: true,
    },
    overview:
      "Up to $25k in Azure credits including high-throughput GPT-4o and OpenAI models, GitHub Enterprise, and Microsoft 365.",
    sampleQuestions: [
      {
        id: "ai_model",
        question: "How does your solution integrate large language models?",
        guideline: "Detail prompt workflows, tool execution calling, and safety guardrails.",
      },
      {
        id: "market_opportunity",
        question: "What market problem are you addressing with AI automation?",
        guideline: "Explain workflow friction, cost savings, and verifiable autonomous proof.",
      },
    ],
  },

  // 4. Notion for Startups
  {
    id: "notion-startups",
    name: "Notion for Startups",
    provider: "Notion",
    category: "PRODUCTIVITY",
    maxCreditValueUsd: 1000,
    creditTermMonths: 6,
    programUrl: "https://www.notion.so/startups",
    badge: "$1,000 Team Workspace",
    eligibility: {
      maxCompanyAgeYears: 3,
      allowedStages: ["BOOTSTRAPPED", "PRE_SEED", "SEED"],
      requiresWebsite: true,
    },
    overview:
      "Up to 6 months free of Notion Plus with unlimited Notion AI team members for company wikis, roadmaps, and sprint boards.",
    sampleQuestions: [
      {
        id: "team_size",
        question: "How many core team members and contractors are in your organization?",
        guideline: "List core engineers, product leads, and external advisors.",
      },
      {
        id: "collaboration",
        question: "How will Notion centralize your company knowledge base?",
        guideline: "Explain sprint tracking, architectural documentation, and investor memos.",
      },
    ],
  },

  // 5. Stripe Processing Fee Waiver
  {
    id: "stripe-startups",
    name: "Stripe Startup Processing Waiver",
    provider: "Stripe",
    category: "PAYMENT_PROCESSING",
    maxCreditValueUsd: 20000,
    creditTermMonths: 12,
    programUrl: "https://stripe.com/startups",
    badge: "$20k Fee-Free Processing",
    eligibility: {
      maxCompanyAgeYears: 3,
      maxFundingRaisedUsd: 5000000,
      allowedStages: ["BOOTSTRAPPED", "PRE_SEED", "SEED"],
      requiresWebsite: true,
    },
    overview:
      "Waives payment gateway processing fees on your first $20,000 of volume, plus prioritized onboarding.",
    sampleQuestions: [
      {
        id: "business_model",
        question: "What is your transaction flow and customer monetization model?",
        guideline: "Detail subscription SaaS recurring billing or autonomous agent checkout fees.",
      },
    ],
  },

  // 6. GitHub for Startups
  {
    id: "github-startups",
    name: "GitHub for Startups",
    provider: "GitHub",
    category: "DEVTOOLS",
    maxCreditValueUsd: 5000,
    creditTermMonths: 12,
    programUrl: "https://github.com/enterprise/startups",
    badge: "$5,000 Enterprise Dev",
    eligibility: {
      maxCompanyAgeYears: 3,
      maxFundingRaisedUsd: 10000000,
      allowedStages: ["BOOTSTRAPPED", "PRE_SEED", "SEED"],
      requiresWebsite: true,
    },
    overview:
      "20 free seats of GitHub Enterprise including GitHub Copilot, advanced security scans, and unlimited CI/CD runner minutes.",
    sampleQuestions: [
      {
        id: "open_source",
        question: "Do you maintain or utilize open-source components?",
        guideline: "Mention core Next.js, SQLite, or agent SDK open-source dependencies.",
      },
    ],
  },

  // 7. Google Cloud for Startups
  {
    id: "google-cloud-startups",
    name: "Google Cloud for Startups Program",
    provider: "Google Cloud",
    category: "CLOUD",
    maxCreditValueUsd: 2000,
    creditTermMonths: 12,
    programUrl: "https://cloud.google.com/startup",
    badge: "$2,000 - $100k GCP Credits",
    eligibility: {
      maxCompanyAgeYears: 5,
      allowedStages: ["BOOTSTRAPPED", "PRE_SEED", "SEED"],
      requiresWebsite: true,
    },
    overview:
      "Cloud compute credits applicable to Google Kubernetes Engine, Cloud Run, BigQuery, and Gemini multimodal models.",
    sampleQuestions: [
      {
        id: "cloud_stack",
        question: "How do you plan to use Google Cloud and Gemini AI?",
        guideline: "Highlight high-throughput web automation and price verification pipelines.",
      },
    ],
  },

  // 8. GitHub Student Developer Pack (Education)
  {
    id: "github-student-pack",
    name: "GitHub Student Developer Pack",
    provider: "GitHub Education",
    category: "EDUCATION",
    maxCreditValueUsd: 200000,
    creditTermMonths: 24,
    programUrl: "https://education.github.com/pack",
    badge: "$200k Student Dev Suite",
    eligibility: {
      requiresEduEmail: true,
    },
    overview:
      "100% free access to GitHub Copilot ($228/yr), JetBrains IDEs, Figma Education, Canva, Namecheap domains, and DigitalOcean cloud credits for students.",
    sampleQuestions: [
      {
        id: "academic_status",
        question: "Provide your accredited university and expected graduation date.",
        guideline: "Include student enrollment proof or active .edu email domain.",
      },
    ],
  },

  // 9. PayPal AI Agentic Commerce Track
  {
    id: "paypal-agentic-commerce",
    name: "PayPal AI Agentic Commerce Fee Relief",
    provider: "PayPal",
    category: "PAYMENT_PROCESSING",
    maxCreditValueUsd: 10000,
    creditTermMonths: 12,
    programUrl: "https://developer.paypal.com",
    badge: "0% Agentic Processing Fee",
    eligibility: {
      allowedStages: ["BOOTSTRAPPED", "PRE_SEED", "SEED"],
      requiresWebsite: true,
    },
    overview:
      "Special hackathon and startup tier: zero merchant transaction fees for autonomous AI agent mandates and verified sandbox checkouts.",
    sampleQuestions: [
      {
        id: "agentic_flow",
        question: "How does your AI agent interact with the PayPal payments ecosystem?",
        guideline: "Detail dual-rail payment architecture, budget ceiling guardrails, and digital receipts.",
      },
    ],
  },
];
