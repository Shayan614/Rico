import {
  priceWorker,
  extractPriceFromText,
  KNOWN_MERCHANT_PROFILES,
} from "./index";

async function runBrowserWorkerTest() {
  console.log("==================================================");
  console.log("🌐 Testing Playwright Headless Browser Worker");
  console.log("==================================================");

  // 1. Test Price Extractor Unit Logic
  console.log("\n[Test 1] Testing Price & Currency Extraction Parser...");
  const samples = [
    { text: "Netflix Standard HD - $15.49 / month", expectedPrice: 15.49, expectedCurrency: "USD" },
    { text: "Spotify Premium Individual is $11.99/mo", expectedPrice: 11.99, expectedCurrency: "USD" },
    { text: "GitHub Copilot Business: 19.00 USD per user/month", expectedPrice: 19.0, expectedCurrency: "USD" },
    { text: "Adobe Creative Cloud All Apps: €59.99/mo", expectedPrice: 59.99, expectedCurrency: "EUR" },
  ];

  for (const sample of samples) {
    const res = extractPriceFromText(sample.text);
    if (!res || res.price !== sample.expectedPrice || res.currency !== sample.expectedCurrency) {
      throw new Error(`Failed to extract price from "${sample.text}". Got: ${JSON.stringify(res)}`);
    }
    console.log(`   ✅ "${sample.text}" ➔ $${res.price} ${res.currency} (${res.billingPeriod})`);
  }

  // 2. Test Synthetic HTML DOM Evaluation via Playwright
  console.log("\n[Test 2] Testing Headless Chromium Navigation & DOM Scraping...");
  const syntheticHtml = `
    <!DOCTYPE html>
    <html>
      <head><title>Netflix Subscription Plans</title></head>
      <body>
        <div class="pricing-card">
          <h2>Netflix Standard HD Plan</h2>
          <div class="plan-price" data-testid="plan-price">$15.49 / month</div>
          <p>Watch on 2 supported devices at a time in Full HD</p>
        </div>
      </body>
    </html>
  `;

  const syntheticResult = await priceWorker.scrapeSyntheticHtml(
    syntheticHtml,
    "Netflix Standard HD"
  );
  console.log("✅ Synthetic DOM price extracted via headless browser:", {
    service: syntheticResult.service,
    price: syntheticResult.price,
    currency: syntheticResult.currency,
    source: syntheticResult.source,
    confidence: syntheticResult.confidence,
  });

  if (syntheticResult.price !== 15.49) {
    throw new Error(`Expected $15.49 but got $${syntheticResult.price}`);
  }

  // 3. Test Merchant Profiles Directory
  console.log("\n[Test 3] Verifying Merchant Profiles Configuration...");
  const profileCount = Object.keys(KNOWN_MERCHANT_PROFILES).length;
  console.log(`✅ Discovered ${profileCount} known merchant profiles:`, Object.keys(KNOWN_MERCHANT_PROFILES).join(", "));

  // 4. Test Scraper Execution for Real Merchant Services
  console.log("\n[Test 4] Testing Scraper Execution on Merchant Services...");
  const servicesToTest = ["Spotify", "GitHub Copilot", "Netflix"];

  for (const service of servicesToTest) {
    const result = await priceWorker.scrapeMerchantPrice(service);
    console.log(`   ✅ Scraped ${result.service}:`, {
      price: `$${result.price.toFixed(2)} ${result.currency}`,
      plan: result.planName,
      source: result.source,
      confidence: result.confidence,
    });
  }

  // 5. Test Parallel Helper Bots Multi-Site Verification
  console.log("\n[Test 5] Testing Parallel Helper Bots Concurrent Execution...");
  const parallelTargets = [
    { service: "Netflix Standard HD" },
    { service: "Spotify Premium" },
    { service: "GitHub Copilot" },
  ];

  const parallelResult = await priceWorker.executeParallelPriceVerification(parallelTargets);
  console.log("   ✅ Parallel Helper Bots completed successfully:", {
    batchId: parallelResult.batchId,
    totalBots: parallelResult.bots.length,
    bestDeal: parallelResult.bestDeal,
  });

  if (!parallelResult.bestDeal || parallelResult.bots.length < 3) {
    throw new Error("Parallel helper verification failed to process all targets");
  }

  // Clean up browser
  await priceWorker.close();

  console.log("\n==================================================");
  console.log("🎉 All 5 Playwright Web Worker Tests PASSED!");
  console.log("==================================================");
  process.exit(0);

}

runBrowserWorkerTest().catch((err) => {
  console.error("Playwright worker test failed:", err);
  process.exit(1);
});
