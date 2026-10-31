# PayAgent — Autonomous Financial & Agentic Commerce Agent
> **PayPal AI Hackathon 2026**  
> **Official Miro Board:** [https://miro.com/app/board/uXjVETEzN_g=/](https://miro.com/app/board/uXjVETEzN_g=/)  
> **GitHub Repository:** [https://github.com/abrarnasirjaffari/PayAgent](https://github.com/abrarnasirjaffari/PayAgent)

---

## ⚠️ CRITICAL INSTRUCTION 1: ALWAYS CHECK THE MIRO BOARD
> **MANDATORY FOR ALL DEVELOPMENT WORK:**  
> **Always inspect and refer to the live Miro Board before and during every stage:**  
> **🔗 [https://miro.com/app/board/uXjVETEzN_g=/](https://miro.com/app/board/uXjVETEzN_g=/)**  
> 
> The Miro board contains the canonical system architecture diagrams, visual wireframes, data flows, and real-time updates. If any design requirement, data schema, or task detail is unclear, always verify against the Miro board first!

---

## ⚡ CRITICAL INSTRUCTION 2: COMMIT & PUSH POLICY
> **MANDATORY FOR AGENT WORKFLOW:**  
> **After completing each task, subtask, or milestone, the agent MUST ALWAYS explicitly ask the user:**  
> *"Should I commit and push these changes to GitHub now?"*  
> **Only when the user confirms with "yes" (or equivalent) will the agent proceed to create a structured git commit and push to `origin main`.** Do not push unconfirmed changes or skip asking.

---

## 1. Project Overview & Pitch

**PayAgent** is an autonomous, open-source financial and agentic commerce assistant powered by **Gemini 3.8 Flash**, **Playwright** browser automation (following the OpenCode CDP pattern), and the **Official PayPal AI Toolkit & MCP Server**.

Instead of a generic checkout button, PayAgent enables users to issue natural language financial mandates (e.g., *"Pay Netflix $15.99 on the 5th, max $20"*). The agent autonomously verifies live online merchant pricing via headless browser automation, runs strict budget and anomaly safety guardrails with PostHog observability, and executes live transactions through PayPal's sandbox MCP server.

### Why PayAgent Wins with PayPal Judges:
- **Direct Agentic Commerce**: Utilizes PayPal's newly released official AI Agent Toolkit & Sandbox MCP Server (`https://mcp.sandbox.paypal.com/sse`).
- **Real-World Automation**: Combines live browser verification with financial execution.
- **Enterprise Guardrails & Observability**: Powered by PostHog telemetry (token counts, reasoning latency, budget anomalies) and strict safety controls.
- **Production-Grade UI**: Split-screen command center with Claude/ChatGPT-style streaming generative UI receipts and AG Grid financial audit tables.

---

## 2. Target Prize Matrix ($27,000+ Potential)

| Award | Amount | Qualification Criteria |
| :--- | :--- | :--- |
| **1st Place Overall** | **$12,000** | Best overall solution, functionality, user experience, and innovation. |
| **Best Agentic Commerce** | **$5,000** | Autonomous AI agent performing intelligent purchasing and mandate execution. |
| **Best Use of AG Grid UI** | **$5,000** | Interactive, high-performance financial table managing mandates & transactions. |
| **Best Use of PayPal + AI** | **$5,000** | Native integration with official PayPal AI Toolkit / MCP Server. |
| **Render Cloud Credits** | **$1,000** | Seamless cloud deployment and production uptime on Render. |

---

## 3. Technology Stack & Architecture

### A. Frontend & UI
- **Framework**: Next.js 14 (App Router) + TypeScript + Tailwind CSS.
- **Chat Interface**: Vercel AI SDK + `shadcn/ui` (Button, Input, Card, Dialog, Badge, Tabs).
- **Generative UI**: Dynamic payment receipt widgets and browser execution progress pills streamed in-chat.
- **Financial Table**: **AG Grid Community** (`ag-grid-react`) displaying active mandates, recurring schedules, and real-time transaction logs.

### B. Agent & Automation Core
- **LLM Reasoning**: **Gemini 3.8 Flash** via Google GenAI SDK with structured function/tool calling.
- **Browser Agent Engine**: Playwright + Stagehand (headless CDP browser automation to visit merchant websites, interact with UI, and scrape real prices).
- **Safety Engine**: Hard budget ceilings, price anomaly triggers (halts execution if price spikes), and strict approval modals.

### C. Persistent Memory & Backend
- **Database**: SQLite + Drizzle ORM (`better-sqlite3`) for zero-setup local persistent storage.
- **Core Entities**:
  - `mandates`: User rules, spending limits, recurrence frequency, next run date.
  - `transactions`: Captured orders, payment IDs, status, receipt data.
  - `audit_logs`: Detailed decision logs and security events.

### D. Observability & Telemetry (PostHog)
- **SDKs**: `posthog-js` (client) + `posthog-node` (server).
- **LLM Analytics**: Token consumption, response latency, reasoning cost per decision.
- **Guardrail Events**: Tracking `price_anomaly_detected`, `budget_exceeded`, and approval triggers.
- **Feature Flags**: Toggles between *"Autonomous Mode"* and *"Strict Approval Mode"*.
- **Session Replay**: Interaction recordings to highlight in demo videos and pitch deck.

### E. Official PayPal AI Toolkit & MCP Server
- **Server Endpoint**: `https://mcp.sandbox.paypal.com/sse` (Server-Sent Events transport).
- **Authentication**: Bearer `PAYPAL_SANDBOX_ACCESS_TOKEN` acquired via OAuth2:
  ```bash
  curl -X POST https://api-m.sandbox.paypal.com/v1/oauth2/token \
    -u "<CLIENT_ID>:<CLIENT_SECRET>" \
    -d "grant_type=client_credentials"
  ```
- **Official Resources**:
  - GitHub Repository: [github.com/paypal/AI-Toolkit](https://github.com/paypal/AI-Toolkit)
  - Documentation: [docs.paypal.ai](https://docs.paypal.ai)
  - MCP Quickstart: [docs.paypal.ai/developer/tools/ai/mcp-quickstart](https://docs.paypal.ai/developer/tools/ai/mcp-quickstart)
  - Agent Toolkit Quickstart: [docs.paypal.ai/developer/tools/ai/agent-toolkit-quickstart](https://docs.paypal.ai/developer/tools/ai/agent-toolkit-quickstart)
  - Tools Reference: [docs.paypal.ai/developer/tools/ai/agent-tools-ref](https://docs.paypal.ai/developer/tools/ai/agent-tools-ref)
- **Pre-Built Capabilities Provided**:
  1. *Orders & Payments* (create, capture, refund)
  2. *Subscriptions* (billing plans & automation)
  3. *Invoices* (digital invoice generation & tracking)
  4. *Catalog* (product & price management)
  5. *Shipment* (shipping tracking)
  6. *Disputes* (query & auto-resolve disputes)
  7. *Reporting* (balances & transaction logs)

---

## 4. End-to-End Execution Flow

```text
[ User Prompt / Mandate ]
           │
           ▼
[ A. Chat Mandate (Vercel AI SDK + SQLite) ]
   "Pay Netflix $15.99 on 5th, max $20"
           │
           ▼
[ B. Playwright Browser Engine ]
   Navigates to merchant, verifies live pricing ($15.99)
           │
           ▼
[ C. Safety Guardrails & PostHog Telemetry ]
   Checks: Price ($15.99) <= Budget Cap ($20.00)
   Logs latency, tokens, decision telemetry to PostHog
           │
           ▼
[ D. PayPal Sandbox MCP Server (SSE) ]
   Executes Orders / Subscription payment tool
   Returns Transaction ID & Digital Receipt
           │
           ▼
[ E. Generative UI & AG Grid Command Center ]
   Renders live receipt card in chat + updates AG Grid table
```

---

## 5. Step-by-Step Task Checklist (Roadmap)

### Stage 1: Setup & Core APIs (Days 1–2 / Nov 1 – Nov 2)
- [ ] **1.1 Next.js 14 Project Scaffold**
  - [ ] Initialize Next.js 14 project with TypeScript, ESLint, and Tailwind CSS.
  - [ ] Configure `shadcn/ui` components: `Button`, `Input`, `Card`, `Dialog`, `Badge`, `Tabs`, `Table`.
  - [ ] Set up layout structure: Split-screen command center (Left: Chat UI, Right: Financial Dashboard).
- [ ] **1.2 SQLite Persistent Memory Database**
  - [ ] Install Drizzle ORM and `better-sqlite3`.
  - [ ] Define schemas: `mandates`, `transactions`, `audit_logs`.
  - [ ] Run initial migrations and seed mock test data.
- [ ] **1.3 PayPal Developer Sandbox Account & Credentials**
  - [ ] Configure Sandbox Client ID and Client Secret in `.env.local`.
  - [ ] Create Sandbox test Buyer and Merchant accounts in the PayPal Developer Dashboard.
- [ ] **1.4 PayPal SDK & MCP Client Connection**
  - [ ] Implement OAuth2 token generator with automatic token refreshing.
  - [ ] Set up connection to the official PayPal MCP Server (`https://mcp.sandbox.paypal.com/sse`).
  - [ ] Create fallback REST wrapper for Orders v2 (Authorize & Capture) and Payouts v1.

---

### Stage 2: Gemini Reasoning & Playwright Browser Agent (Days 3–5 / Nov 3 – Nov 5)
- [ ] **2.1 Gemini 3.8 Flash Core Setup**
  - [ ] Configure Google GenAI SDK with streaming response handler.
  - [ ] Write system prompt defining PayAgent persona, financial safety constraints, and tool schemas.
- [ ] **2.2 Agent Function Calling Implementation**
  - [ ] Implement Tool: `create_mandate(service, max_amount, schedule, strict_mode)`.
  - [ ] Implement Tool: `verify_web_price(service_url, service_name)`.
  - [ ] Implement Tool: `execute_paypal_payment(mandate_id, verified_price, recipient)`.
- [ ] **2.3 Playwright Web Worker Automation**
  - [ ] Implement headless Chromium worker using Playwright.
  - [ ] Build script to visit merchant pages (e.g., Netflix subscription plan page).
  - [ ] Extract real-time plan pricing and currency; return structured data to agent.
- [ ] **2.4 Guardrail & Safety Anomaly Engine**
  - [ ] Build price verification rule: Block execution if `scraped_price > max_amount`.
  - [ ] Build anomaly detection: Flag sudden price increase (>20% jump).
  - [ ] Trigger manager/user confirmation dialog modal in UI if strict approval is required.

---

### Stage 3: Generative UI, AG Grid & PostHog Telemetry (Days 6–8 / Nov 6 – Nov 8)
- [ ] **3.1 Split-Screen Dashboard & Streaming Chat**
  - [ ] Integrate Vercel AI SDK `useChat` hook with custom message renderer.
  - [ ] Add Dark/Light mode toggle and responsive mobile drawer view.
- [ ] **3.2 Generative UI Receipt & Status Cards**
  - [ ] Build interactive in-chat Receipt Card showing: Merchant, Price, PayPal Transaction ID, Timestamp, and Green Verified Badge.
  - [ ] Build Browser Step Indicator Pill showing live progress (`Browsing site...` ➔ `Price extracted` ➔ `Executing payment`).
- [ ] **3.3 AG Grid Financial Mandates & Transaction Table**
  - [ ] Install and configure `ag-grid-react` and `ag-grid-community`.
  - [ ] Define columns: `Service`, `Ceiling Amount`, `Last Executed`, `Next Run`, `Status`, `Actions`.
  - [ ] Implement real-time table refresh when new mandates are created or payments are captured.
- [ ] **3.4 PostHog Telemetry & Observability Integration**
  - [ ] Set up `posthog-js` and `posthog-node` with project API key.
  - [ ] Log LLM generation metrics: input tokens, output tokens, latency, estimated cost.
  - [ ] Log custom security events: `guardrail_blocked`, `price_anomaly_detected`, `payment_completed`.
  - [ ] Add feature flags for switching between *"Autonomous Mode"* and *"Strict Approval Mode"*.

---

### Stage 4: Deployment, Pitch Video & Devpost Submission (Days 9–12 / Nov 9 – Nov 12)
- [ ] **4.1 Production Deployment on Render**
  - [ ] Create `render.yaml` or configure Render Web Service build/start commands.
  - [ ] Configure environment variables securely on Render.
  - [ ] Test live staging URL for 100% functionality and uptime (targets $1,000 Render award).
- [x] **4.2 Public Open-Source GitHub Repository**
  - [x] Create public GitHub repository: [https://github.com/abrarnasirjaffari/PayAgent](https://github.com/abrarnasirjaffari/PayAgent)
  - [ ] Add MIT License file.
  - [ ] Create comprehensive `README.md` with architecture diagram, local setup instructions, and feature list.
  - [ ] Create `.env.example` documenting all necessary keys (PayPal Sandbox, Gemini API, PostHog).
- [ ] **4.3 3-Minute Walkthrough Video (OBS Recording)**
  - [ ] Record clear, punchy walkthrough under 3 minutes:
    1. Introduction to the PayAgent concept and the PayPal MCP problem-solution.
    2. Live Demo: Natural language chat prompt creates recurring mandate.
    3. Playwright browser visually inspecting live merchant price.
    4. Guardrail safety check + live PayPal Sandbox transaction execution.
    5. In-chat generative receipt card + AG Grid update + PostHog telemetry dashboard.
  - [ ] Upload video to YouTube (Public / Unlisted).
- [ ] **4.4 Devpost Submission Preparation**
  - [ ] Complete Devpost project write-up with screenshots, problem statement, technical architecture, and impact.
  - [ ] Check relevant prize categories (Overall, Agentic Commerce, AG Grid UI, PayPal + AI).
  - [ ] Submit before the November 13, 2026 deadline!

---

## 📌 Important Reference Links
- **GitHub Repository**: [https://github.com/abrarnasirjaffari/PayAgent](https://github.com/abrarnasirjaffari/PayAgent)
- **Live Miro Canvas**: [https://miro.com/app/board/uXjVETEzN_g=/](https://miro.com/app/board/uXjVETEzN_g=/)
- **PayPal AI Toolkit Repository**: [https://github.com/paypal/AI-Toolkit](https://github.com/paypal/AI-Toolkit)
- **PayPal AI Developer Portal**: [https://docs.paypal.ai](https://docs.paypal.ai)
- **PayPal Developer Dashboard**: [https://developer.paypal.com/dashboard](https://developer.paypal.com/dashboard)
