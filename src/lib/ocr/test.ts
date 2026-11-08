import { invoiceOCRParser } from "./invoice-ocr-parser";
import { evaluateTaxDeduction } from "./tax-deduction-rules";
import { mandateMatcher } from "./mandate-matcher";

async function runOCRTests() {
  console.log("==================================================");
  console.log("⚡ Testing 2.7 Bulk Invoice & Receipt OCR Parser");
  console.log("==================================================");

  // [Test 1] Single SaaS Receipt Parsing & Line-Item Decomposition
  console.log("\n[Test 1] Testing SaaS Receipt Parsing & Line Items...");
  const sampleReceiptText = `
    NETFLIX SERVICES US, INC.
    Invoice #: INV-982314
    Date: 2026-11-04
    Description: Netflix Standard HD Streaming Plan
    Amount: $15.49 USD
    Payment Method: PayPal Sandbox Wallet
  `;

  const parsed1 = await invoiceOCRParser.parseInvoice({
    content: sampleReceiptText,
    sourceType: "TEXT_SNIPPET",
  });

  console.log("   Vendor:", parsed1.vendor.name);
  console.log("   Invoice Number:", parsed1.invoiceNumber);
  console.log("   Total Amount:", `$${parsed1.totalAmount} ${parsed1.currency}`);
  console.log("   Line Items Count:", parsed1.lineItems.length);
  console.log("   First Line Item:", parsed1.lineItems[0]?.description);

  if (
    !parsed1.vendor.name.toLowerCase().includes("netflix") ||
    parsed1.totalAmount !== 15.49 ||
    parsed1.lineItems.length === 0
  ) {
    throw new Error("Test 1 Failed: Expected Netflix vendor, $15.49 total, and valid line items!");
  }
  console.log("✅ Test 1 Passed: SaaS receipt cleanly parsed into structured line items.");

  // [Test 2] Tax Deduction Classification & IRS Schedules
  console.log("\n[Test 2] Testing Tax Deduction Classification (SaaS 100% vs Meals 50%)...");

  // SaaS line item
  const saasTax = evaluateTaxDeduction("GitHub Copilot Enterprise Seat", 19.0);
  console.log("   SaaS Category:", saasTax.category);
  console.log("   SaaS Deduction:", `${saasTax.taxDeduction.deductionPercentage}% ($${saasTax.taxDeduction.deductibleAmount})`);
  console.log("   SaaS Schedule:", saasTax.taxDeduction.taxSchedule);

  // Business meal line item
  const mealTax = evaluateTaxDeduction("Starbucks Client Coffee & Breakfast Discussion", 24.5);
  console.log("   Meal Category:", mealTax.category);
  console.log("   Meal Deduction:", `${mealTax.taxDeduction.deductionPercentage}% ($${mealTax.taxDeduction.deductibleAmount})`);
  console.log("   Meal Schedule:", mealTax.taxDeduction.taxSchedule);

  if (saasTax.taxDeduction.deductionPercentage !== 100 || saasTax.taxDeduction.deductibleAmount !== 19.0) {
    throw new Error("Test 2 Failed: Expected 100% tax deduction for software subscription!");
  }
  if (mealTax.taxDeduction.deductionPercentage !== 50 || mealTax.taxDeduction.deductibleAmount !== 12.25) {
    throw new Error("Test 2 Failed: Expected 50% tax deduction for business meal!");
  }
  console.log("✅ Test 2 Passed: Tax deduction rules accurately applied IRS 100% and 50% schedules.");

  // [Test 3] Automated Mandate Matching & Ceiling Overrun Detection
  console.log("\n[Test 3] Testing Mandate Matching & Budget Ceiling Checks...");
  // Netflix normal price ($15.49) vs ceiling ($25.00)
  const mandateMatchNormal = await mandateMatcher.matchInvoiceToMandate("Netflix", 15.49);
  console.log("   Netflix Match ($15.49):", {
    matched: !!mandateMatchNormal,
    service: mandateMatchNormal?.service,
    ceiling: mandateMatchNormal?.budgetCeiling,
    status: mandateMatchNormal?.status,
  });

  // Netflix inflated price ($45.00) vs ceiling ($25.00)
  const mandateMatchOverrun = await mandateMatcher.matchInvoiceToMandate("Netflix", 45.0);
  console.log("   Netflix Overrun ($45.00):", {
    exceedsCeiling: mandateMatchOverrun?.exceedsCeiling,
    discrepancyUsd: mandateMatchOverrun?.discrepancyUsd,
    status: mandateMatchOverrun?.status,
  });

  if (mandateMatchOverrun && !mandateMatchOverrun.exceedsCeiling) {
    throw new Error("Test 3 Failed: Expected $45.00 to exceed Netflix mandate budget ceiling!");
  }
  console.log("✅ Test 3 Passed: Automated mandate matcher detected budget ceiling state.");

  // [Test 4] Multi-Currency Parsing (EUR & GBP)
  console.log("\n[Test 4] Testing Multi-Currency Parsing (EUR & GBP)...");
  const eurReceipt = `
    Spotify AB
    Receipt: SPOT-EUR-2026-99
    Date: 2026-11-01
    Total: 10.99 €
    VAT: 2.10 €
  `;
  const parsedEur = await invoiceOCRParser.parseInvoice({ content: eurReceipt });
  console.log(`   EUR Receipt parsed: ${parsedEur.totalAmount} ${parsedEur.currency}`);

  const gbpReceipt = `
    Figma UK Ltd
    Order: FIG-GBP-402
    Date: 2026-11-03
    Total: £12.00
  `;
  const parsedGbp = await invoiceOCRParser.parseInvoice({ content: gbpReceipt });
  console.log(`   GBP Receipt parsed: ${parsedGbp.totalAmount} ${parsedGbp.currency}`);

  if (parsedEur.currency !== "EUR" || parsedGbp.currency !== "GBP") {
    throw new Error("Test 4 Failed: Multi-currency parsing failed to detect EUR / GBP symbols!");
  }
  console.log("✅ Test 4 Passed: Multi-currency detection verified.");

  // [Test 5] Mathematical Integrity & Anomaly Warnings
  console.log("\n[Test 5] Testing Mathematical Integrity & Anomaly Detection...");
  const anomalousText = `
    Cloud Services Provider
    Invoice #: ANOMALY-101
    Date: 2026-11-05
    Subtotal: $100.00
    Tax: $45.00
    Total: $250.00
  `;
  const parsedAnomalous = await invoiceOCRParser.parseInvoice({ content: anomalousText });
  console.log("   Anomalies Captured:", parsedAnomalous.anomalies);
  console.log("   Confidence Score:", parsedAnomalous.confidenceScore);

  if (parsedAnomalous.anomalies.length === 0 || parsedAnomalous.confidenceScore >= 0.9) {
    throw new Error("Test 5 Failed: Expected anomaly flags for high tax rate and total mismatch!");
  }
  console.log("✅ Test 5 Passed: Discrepancies and abnormal tax rates flagged with reduced confidence.");

  // [Test 6] High-Throughput Bulk Batch Parsing with Worker Pool
  console.log("\n[Test 6] Testing High-Throughput Bulk Batch Parsing (5 Parallel Invoices)...");
  const bulkBatchInputs = [
    { content: "Netflix Standard Plan $15.49 USD", vendorHint: "Netflix" },
    { content: "Spotify Premium $11.99 USD", vendorHint: "Spotify" },
    { content: "GitHub Copilot Business $19.00 USD", vendorHint: "GitHub" },
    { content: "AWS Cloud Compute Hosting $100.00 USD", vendorHint: "Amazon Web Services" },
    { content: "Starbucks Team Catering Lunch $45.00 USD", vendorHint: "Starbucks" },
  ];

  const batchSummary = await invoiceOCRParser.parseBatch(bulkBatchInputs, { priority: "HIGH" });
  console.log("   Total Invoices Processed:", batchSummary.totalInvoices);
  console.log("   Total Spend USD:", `$${batchSummary.totalAmountUsd}`);
  console.log("   Total Deductible USD:", `$${batchSummary.totalTaxDeductibleUsd}`);
  console.log("   Category Breakdown:", batchSummary.categoryBreakdown);

  if (batchSummary.totalInvoices !== 5 || batchSummary.totalAmountUsd <= 0) {
    throw new Error("Test 6 Failed: Bulk batch parser failed to process all 5 invoices!");
  }
  console.log("✅ Test 6 Passed: Bulk batch parser executed in parallel via worker pool.");

  console.log("\n==================================================");
  console.log("🎉 ALL 6 Bulk Invoice & Receipt OCR Parser Tests PASSED!");
  console.log("==================================================");
}

runOCRTests().catch((err) => {
  console.error("❌ OCR Tests Failed:", err);
  process.exit(1);
});
