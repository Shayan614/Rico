import {
  DeepSeekRateLimiter,
  deepSeekClient,
} from "./index";

async function runDeepSeekTests() {
  console.log("==================================================");
  console.log("⚡ Testing DeepSeek Client & Rate-Limit Engine");
  console.log("==================================================");

  // [Test 1] Client Initialization & Mode Verification
  console.log("\n[Test 1] Testing DeepSeek Client Initialization...");
  const isLive = deepSeekClient.isLiveKeyConfigured();
  console.log(`   Configured Mode: ${isLive ? "LIVE_API" : "SIMULATED_SANDBOX"}`);
  console.log(`   Rate Limiter Status:`, deepSeekClient.getRateLimiter().getStatus());

  if (typeof deepSeekClient.chat !== "function") {
    throw new Error("Test 1 Failed: deepSeekClient.chat is not a function!");
  }
  console.log("✅ Test 1 Passed: DeepSeek Client initialized successfully.");

  // [Test 2] DeepSeek-V3 Chat Completion & Token Usage
  console.log("\n[Test 2] Testing DeepSeek-V3 Chat Completion...");
  const chatResponse = await deepSeekClient.chat([
    {
      role: "system",
      content: "You are Rico's DeepSeek batch financial engine.",
    },
    {
      role: "user",
      content: "Audit active subscriptions: Netflix $15.49, Spotify $11.99.",
    },
  ]);

  console.log("   Model:", chatResponse.model);
  console.log("   Tokens:", chatResponse.usage);
  console.log("   Latency:", `${chatResponse.latencyMs}ms`);
  console.log("   Snippet:", chatResponse.content.slice(0, 100).replace(/\n/g, " "));

  if (!chatResponse.content || chatResponse.usage.totalTokens <= 0) {
    throw new Error("Test 2 Failed: Expected non-empty chat response and token usage!");
  }
  console.log("✅ Test 2 Passed: Chat completion returned valid response & token economics.");

  // [Test 3] DeepSeek-R1 (Reasoning Mode)
  console.log("\n[Test 3] Testing DeepSeek-R1 Reasoning Model...");
  const reasonerResponse = await deepSeekClient.chat(
    [
      {
        role: "user",
        content: "Evaluate reasoning for buying SaaS at $15.49 vs budget $30.00.",
      },
    ],
    { model: "deepseek-reasoner" }
  );

  console.log("   Model:", reasonerResponse.model);
  console.log("   Reasoning Content:", reasonerResponse.content.slice(0, 120).replace(/\n/g, " "));

  if (reasonerResponse.model !== "deepseek-reasoner" || !reasonerResponse.content) {
    throw new Error("Test 3 Failed: DeepSeek-R1 reasoning test failed!");
  }
  console.log("✅ Test 3 Passed: DeepSeek-R1 reasoning response generated.");

  // [Test 4] Streaming Chat Generator
  console.log("\n[Test 4] Testing DeepSeek Streaming Generator...");
  const stream = deepSeekClient.streamChat([
    { role: "user", content: "Quick check on rate limits." },
  ]);

  let chunkCount = 0;
  let gatheredText = "";
  for await (const chunk of stream) {
    chunkCount++;
    gatheredText += chunk.delta;
  }

  console.log(`   Streamed ${chunkCount} chunks. Total length: ${gatheredText.length} chars.`);
  if (chunkCount === 0 || !gatheredText) {
    throw new Error("Test 4 Failed: Streaming did not produce chunks!");
  }
  console.log("✅ Test 4 Passed: Streaming response generator verified.");

  // [Test 5] Sliding-Window Token Bucket & Concurrency Throttling
  console.log("\n[Test 5] Testing Rate Limiter (RPM & Concurrency Limits)...");
  // Configure a restrictive rate limiter for testing: 3 RPM, 2 concurrent
  const testLimiter = new DeepSeekRateLimiter({
    maxRequestsPerMinute: 3,
    maxConcurrentRequests: 2,
    maxTokensPerMinute: 5000,
  });

  const initialStatus = testLimiter.getStatus();
  console.log("   Initial Limiter Status:", {
    remainingRPM: initialStatus.remainingRPM,
    activeRequests: initialStatus.activeRequests,
    queuedRequests: initialStatus.queuedRequests,
  });

  // Acquire 2 slots (up to maxConcurrentRequests)
  await testLimiter.acquire(100);
  await testLimiter.acquire(100);

  const busyStatus = testLimiter.getStatus();
  console.log("   Status with 2 active requests:", {
    activeRequests: busyStatus.activeRequests,
    remainingRPM: busyStatus.remainingRPM,
    isThrottled: busyStatus.isThrottled,
  });

  if (busyStatus.activeRequests !== 2 || !busyStatus.isThrottled) {
    throw new Error("Test 5 Failed: Rate limiter should be throttled at max concurrency!");
  }

  // Release slots
  testLimiter.release();
  testLimiter.release();

  const releasedStatus = testLimiter.getStatus();
  if (releasedStatus.activeRequests !== 0) {
    throw new Error("Test 5 Failed: Active requests should be 0 after release!");
  }
  console.log("✅ Test 5 Passed: Rate limiter correctly tracks active slots and throttling.");

  // [Test 6] High-Speed Batch Processing Engine
  console.log("\n[Test 6] Testing High-Speed Batch Processing Engine...");
  const batchItems = [
    { service: "Netflix", price: 15.49 },
    { service: "Spotify", price: 11.99 },
    { service: "AWS", price: 42.10 },
    { service: "GitHub Copilot", price: 19.00 },
    { service: "Figma", price: 12.00 },
  ];

  const batchSummary = await deepSeekClient.batchProcess(
    batchItems,
    async (item) => {
      // Simulate fast audit processing
      return {
        service: item.service,
        price: item.price,
        withinCeiling: item.price < 50.0,
      };
    },
    { concurrency: 3 }
  );

  console.log("   Batch Total:", batchSummary.total);
  console.log("   Completed:", batchSummary.completed);
  console.log("   Failed:", batchSummary.failed);
  console.log("   Total Duration:", `${batchSummary.durationMs}ms`);
  console.log("   Estimated Cost:", `$${batchSummary.estimatedCostUsd} USD`);

  if (batchSummary.completed !== 5 || batchSummary.failed !== 0) {
    throw new Error("Test 6 Failed: Batch processing did not complete all items!");
  }
  console.log("✅ Test 6 Passed: High-speed batch processing engine processed all tasks cleanly.");

  console.log("\n==================================================");
  console.log("🎉 ALL 6 DeepSeek Client & Rate-Limit Tests PASSED!");
  console.log("==================================================");
}

runDeepSeekTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("DeepSeek test failed:", err);
    process.exit(1);
  });
