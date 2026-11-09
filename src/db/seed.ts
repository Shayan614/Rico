import { db, dbProvider, mandates, transactions, auditLogs, users } from "./index";

// The shared 1-click demo account, which is mock-only.
const DEMO_OWNER_ID = "usr_judge_paypal_hackathon";

export async function seedDatabase() {
  if (dbProvider !== "sqlite") {
    throw new Error("db:seed deletes all rows and only runs on SQLite");
  }
  console.log("🌱 Starting SQLite database seed...");

  // Clear existing records to ensure clean state
  db.delete(auditLogs).run();
  db.delete(transactions).run();
  db.delete(mandates).run();

  db.insert(users)
    .values({ id: DEMO_OWNER_ID, email: "judge@paypal-hackathon.ai", fullName: "Judge Evaluator", role: "judge" })
    .onConflictDoNothing()
    .run();

  // 1. Seed Mandates
  const mockMandates = [
    {
      id: "mandate-1",
      service: "Netflix Standard HD",
      budgetCeiling: 20.0,
      lastScrapedPrice: 15.49,
      recurrence: "Monthly on 5th",
      nextRun: "Nov 5, 2026",
      status: "ACTIVE" as const,
      category: "Media",
      currency: "USD",
      strictMode: false,
      merchantUrl: "https://www.netflix.com/signup/planform",
    },
    {
      id: "mandate-2",
      service: "Spotify Premium",
      budgetCeiling: 15.0,
      lastScrapedPrice: 11.99,
      recurrence: "Monthly on 1st",
      nextRun: "Nov 1, 2026",
      status: "ACTIVE" as const,
      category: "Music",
      currency: "USD",
      strictMode: false,
      merchantUrl: "https://www.spotify.com/premium",
    },
    {
      id: "mandate-3",
      service: "GitHub Copilot",
      budgetCeiling: 25.0,
      lastScrapedPrice: 19.0,
      recurrence: "Monthly on 15th",
      nextRun: "Nov 15, 2026",
      status: "ACTIVE" as const,
      category: "Tools",
      currency: "USD",
      strictMode: false,
      merchantUrl: "https://github.com/features/copilot",
    },
  ];

  for (const mandate of mockMandates) {
    db.insert(mandates).values({ ...mandate, ownerId: DEMO_OWNER_ID }).run();
  }
  console.log(`✅ Seeded ${mockMandates.length} mandates.`);

  // 2. Seed Transactions
  const mockTransactions = [
    {
      id: "tx-1",
      mandateId: "mandate-1",
      orderId: "ORD-84920491",
      service: "Netflix Standard HD",
      amount: 15.49,
      currency: "USD",
      status: "COMPLETED" as const,
      timestamp: "Oct 31, 2026, 02:45 PM",
      receiptData: {
        orderId: "ORD-84920491",
        service: "Netflix Standard HD",
        planName: "Standard 2-Screen HD Streaming",
        verifiedPrice: 15.49,
        budgetCeiling: 20.0,
        currency: "USD",
        paymentMethod: "PayPal Connected Account",
        status: "COMPLETED",
        timestamp: "Oct 31, 2026, 02:45 PM",
        payerEmail: "buyer-sandbox@payagent.internal",
        sandboxAuthCode: "AUTH-8921",
      },
    },
    {
      id: "tx-2",
      mandateId: "mandate-2",
      orderId: "ORD-71049281",
      service: "Spotify Premium Individual",
      amount: 11.99,
      currency: "USD",
      status: "COMPLETED" as const,
      timestamp: "Oct 28, 2026, 11:15 AM",
      receiptData: {
        orderId: "ORD-71049281",
        service: "Spotify Premium Individual",
        planName: "Individual Plan",
        verifiedPrice: 11.99,
        budgetCeiling: 15.0,
        currency: "USD",
        paymentMethod: "PayPal Connected Account",
        status: "COMPLETED",
        timestamp: "Oct 28, 2026, 11:15 AM",
        payerEmail: "buyer-sandbox@payagent.internal",
        sandboxAuthCode: "AUTH-3401",
      },
    },
  ];

  for (const tx of mockTransactions) {
    db.insert(transactions).values(tx).run();
  }
  console.log(`✅ Seeded ${mockTransactions.length} transactions.`);

  // 3. Seed Audit Logs
  const mockAuditLogs = [
    {
      id: "log-1",
      mandateId: "mandate-1",
      timestamp: "Oct 31, 2026, 02:45 PM",
      eventType: "PAYMENT_CAPTURED" as const,
      service: "Netflix",
      details:
        "Order ORD-84920491 captured. Scraped live price ($15.49) verified below $20.00 ceiling.",
      severity: "success" as const,
      metadata: {
        orderId: "ORD-84920491",
        price: 15.49,
        budgetCeiling: 20.0,
      },
    },
    {
      id: "log-2",
      mandateId: "mandate-1",
      timestamp: "Oct 31, 2026, 02:44 PM",
      eventType: "PRICE_VERIFIED" as const,
      service: "Netflix",
      details: "Verified Netflix standard subscription price: $15.49/mo.",
      severity: "info" as const,
      metadata: {
        scrapedPrice: 15.49,
        source: "Playwright CDP Browser",
      },
    },
    {
      id: "log-3",
      mandateId: null,
      timestamp: "Oct 29, 2026, 09:12 AM",
      eventType: "GUARDRAIL_BLOCKED" as const,
      service: "Adobe Creative Cloud",
      details:
        "Execution paused: Plan price ($59.99) exceeds authorized budget ceiling ($30.00).",
      severity: "danger" as const,
      metadata: {
        price: 59.99,
        ceiling: 30.0,
        anomalyJumpPercent: 99.9,
      },
    },
  ];

  for (const log of mockAuditLogs) {
    db.insert(auditLogs).values(log).run();
  }
  console.log(`✅ Seeded ${mockAuditLogs.length} audit logs.`);
  console.log("🚀 Database initialization & seeding completed successfully.");
}

// Run immediately when executed directly
if (require.main === module || process.argv[1]?.includes("seed")) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("❌ Seed failed:", err);
      process.exit(1);
    });
}
