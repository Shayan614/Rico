# ⚡ Rico — Autonomous Financial & Agentic Commerce Agent

> **PayPal AI Hackathon 2026**  
> 🔗 **Official Miro Architecture Board:** [https://miro.com/app/board/uXjVETEzN_g=/](https://miro.com/app/board/uXjVETEzN_g=/)  
> 🐙 **GitHub Repository:** [https://github.com/abrarnasirjaffari/Rico](https://github.com/abrarnasirjaffari/Rico)

---

## 💡 What is Rico?

**Rico** is an autonomous, open-source financial and agentic commerce assistant that unifies **AI Reasoning (Brain)**, **Live Headless Browser Automation (Hands)**, and the **Official PayPal AI Toolkit & MCP Server (Wallet)**.

Instead of a passive checkout button or retrospective spending charts, Rico allows users to issue natural language financial mandates:

> *"Pay Netflix $15.99 on the 5th, max $20"*  
> *"Track Adobe Creative Cloud, cap at $35/mo — alert my Telegram if prices spike"*  
> *"Pay Spotify $11.99, but check for student discounts first"*

Rico autonomously visits merchant sites in a real Chromium browser, extracts live pricing, hunts for student discounts and startup credits ($50,000 in PostHog credits, Notion credits), enforces strict budget guardrails, and executes authorized payments through PayPal's sandbox MCP server.

---

## 🏆 Target Prize Qualification Matrix ($27,000+ Potential)

| Award | Prize | How Rico Qualifies |
| :--- | :---: | :--- |
| **🥇 1st Place Overall** | **$12,000** | End-to-end autonomous agent with full UX, live browser vision, omnichannel alerts, and multi-rail payments. |
| **🤖 Best Agentic Commerce** | **$5,000** | Autonomous AI agent visiting live websites, clicking plans, checking coupons, and executing transactions. |
| **💳 Best Use of PayPal + AI** | **$5,000** | Native integration with official PayPal AI Toolkit MCP server (`mcp.sandbox.paypal.com/sse`), Orders v2, and Vault v3. |
| **📊 Best Use of AG Grid UI** | **$5,000** | High-performance interactive financial command center displaying real-time mandates, transactions, and audit trails. |
| **☁️ Render Cloud Credits** | **$1,000** | Instant production deployment with automated `render.yaml` configuration and 100% uptime. |

---

## 🎨 System Architecture (Miro Canvas: 7 Master Frames)

Inspect the live canonical system design on our [Miro Architecture Board](https://miro.com/app/board/uXjVETEzN_g=/):

```text
[ User Prompt / Mandate (Web, Telegram, WhatsApp) ]
                       │
                       ▼
       [ 1. Gemini 3.8 Flash Agent Core ]
      Natural Language Intent & Credit Probe
                       │
         ┌─────────────┴─────────────┐
         ▼                           ▼
[ 2. Stagehand + Playwright ]  [ 3. Persona Savings Engine ]
  Live 30FPS CDP Screencast      $50k PostHog / Notion Credits
  Real button clicks in DOM      50% Student Discount Enforcer
         │                           │
         └─────────────┬─────────────┘
                       ▼
        [ 4. Safety Guardrail Engine ]
       Budget Cap Check: Price <= Ceiling
       Price Spike Anomaly Halt (>20% jump)
       PostHog Decision & Token Telemetry
                       │
                       ▼
     [ 5. Official PayPal MCP & Vault Rails ]
     Primary: PayPal Wallet (Sandbox Account)
     Backup: Tokenized Visa/Mastercard (Zero-Knowledge)
                       │
         ┌─────────────┴─────────────┐
         ▼                           ▼
[ 6. Generative UI Receipts ]  [ 7. AG Grid Audit Center ]
  In-chat verified receipt       Live recurring schedules
  Inspectable browser proof      24/7 background sentinel
```

---

## 🌟 Key Features & Innovations

### 1. 🎮 Real-Time Live Browser Engine (Stagehand + Playwright CDP)
- **Zero Fakes / 100% Real:** Launches a genuine headless Chromium browser.
- **30FPS Live Screencast:** Streams raw JPEG frames directly into a React viewport window in real time.
- **Natural Language Actions:** Uses `stagehand.act("select Standard plan")` to click real buttons in the DOM.
- **Cryptographic Visual Proof:** Saves timestamped screenshot receipts with OCR bounding boxes.

### 2. 💳 Dual-Rail Smart Wallet & Zero-Knowledge Vault
- **Primary Rail:** PayPal Wallet & Balance (`buyer-sandbox@payagent.internal`).
- **Secondary Backup Rail:** Tokenized Visa (`•••• 4242`) & Mastercard (`•••• 5555`).
- **Zero-Knowledge AI Security:** Card numbers are entered in an isolated PayPal Hosted Iframe (`@paypal/paypal-js`). The AI model **NEVER SEES** raw card numbers or CVVs, eliminating PCI liability and model training leaks!
- **Persistent Sessions:** Tokens are stored in SQLite; users never re-enter card information across sessions.

### 3. 📱 24/7 Price Sentinel & Omnichannel Bot Team
- **Scheduled Audits:** `POST /api/cron/sentinel` audits all active mandates when an external daily scheduler calls it (see *Scheduled Monitoring* below). Audits never make payments.
- **Interactive Messaging:** Telegram alerts when a bot is configured. WhatsApp and Slack message formats exist, but nothing is sent yet.
- **1-Tap Action Callbacks:** Remote `[Approve One-Time]`, `[Pay with Backup Card]`, or `[1-Click Cancel Subscription]` buttons executed right from the chat notification.

### 4. 🚀 Persona-Based Savings & Credit Optimizer ("AI That Pays for Itself")
- **Startup / Founder Profile:** Automatically checks and claims **$50,000 PostHog credits** and **$1,000 Notion startup credits** before recurring payments execute.
- **Student Profile:** Enforces 50% education discounts (Spotify Student $5.99/mo, GitHub Student Developer Pack).
- **Active Coupon Hunter:** Scrapes and tests working promo codes in merchant checkout fields before generating PayPal invoices.

### 5. 📊 AG Grid Financial Command Center
- Real-time mandate schedules, budget ceiling utilizations, and transaction audit trails.
- One-click CSV audit export and live filtering.

---

## 🚀 Quickstart & Local Setup

### Prerequisites
- Node.js 18+ or 20+
- Google Gemini API Key ([Get free API key](https://aistudio.google.com/app/apikey))
- PayPal Developer Sandbox Account ([developer.paypal.com](https://developer.paypal.com/dashboard))

### 1. Clone & Install
```bash
git clone https://github.com/abrarnasirjaffari/Rico.git
cd Rico
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Fill in your credentials:
```env
PAYPAL_CLIENT_ID=your_paypal_sandbox_client_id
PAYPAL_CLIENT_SECRET=your_paypal_sandbox_client_secret
PAYPAL_ENVIRONMENT=sandbox
PAYPAL_MCP_SERVER_URL=https://mcp.sandbox.paypal.com/sse
GEMINI_API_KEY=your_gemini_api_key
DATABASE_URL=./sqlite.db
NEXT_PUBLIC_POSTHOG_KEY=your_posthog_api_key
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Scheduled Monitoring (Optional)
Rico does not start a scheduler by itself. To run daily audits, set `CRON_SECRET` on the server to a random value of at least 32 characters (for example `openssl rand -hex 32`), then have an external scheduler send one request a day:
```bash
curl -X POST "https://YOUR-RICO-HOST/api/cron/sentinel" \
  -H "Authorization: Bearer $CRON_SECRET" --max-time 300
```
Any scheduler that can send this request works, such as a Render Cron Job or a GitHub Actions `schedule` workflow with the secret stored in its secrets. The server needs Playwright's Chromium, because only live prices are trusted.

| Response | Meaning |
| --- | --- |
| `200` | Audit finished; the body has counts only |
| `401` | Missing or wrong secret |
| `409` | Another audit is already running; do not retry straight away |
| `503` | `CRON_SECRET` is missing or shorter than 32 characters |

The Sentinel panel shows *Scheduled* only after a successful run in the last 26 hours.

---

## 🧪 Test Suites

Run automated test suites verifying all core sub-systems:
```bash
# Test Gemini 3.8 Flash & tool calling dispatcher
npm run test:gemini

# Test PayPal Orders v2 & MCP server connection
npm run test:paypal

# Test Headless Playwright price extraction
npm run test:browser

# Test Safety guardrails & anomaly thresholds
npm run test:safety

# Test PostHog telemetry streaming
npm run test:telemetry
```

---

## ☁️ Deploy to Render

Rico includes a turnkey `render.yaml` specification for 1-click cloud deployment:

1. Fork or push this repository to GitHub.
2. In the [Render Dashboard](https://dashboard.render.com), click **New +** ➔ **Blueprint**.
3. Select this repository. Render automatically reads `render.yaml`.
4. Add your secrets (`PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `GEMINI_API_KEY`, `NEXT_PUBLIC_POSTHOG_KEY`).
5. Click **Apply** — your production instance is live!

---

## 📄 License

Distributed under the MIT License. See [LICENSE](LICENSE) for details.

Developed with ❤️ by **Abrar Nasir Jaffari** for the **PayPal AI Hackathon 2026**.
