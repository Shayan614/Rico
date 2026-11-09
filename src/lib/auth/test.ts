import { randomUUID } from "crypto";
import {
  getJudgeDemoSession,
  createUserSession,
  serializeSessionToken,
  extractSessionFromCookieValue,
  syncUserToDatabase,
  getSessionCookieOptions,
} from "./session-bridge";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { db, users } from "@/db";
import { eq } from "drizzle-orm";

async function runAuthTests() {
  console.log("==================================================");
  console.log("🔐 Testing Supabase Auth & Session Cookie Bridge");
  console.log("==================================================");

  // [Test 1] Environment Detection
  console.log("\n[Test 1] Testing Supabase Environment Detection...");
  const configured = isSupabaseConfigured();
  console.log(`   Supabase Configured: ${configured ? "LIVE_CREDENTIALS" : "SANDBOX_SIMULATED_MODE"}`);
  console.log("✅ Test 1 Passed: Environment detection returned valid status.");

  // [Test 2] Judge Demo Session Generation
  console.log("\n[Test 2] Testing 1-Click Judge Demo Session Generation...");
  const demoSession = getJudgeDemoSession();
  console.log("   Judge Email:", demoSession.user.email);
  console.log("   Judge Role:", demoSession.user.role);
  console.log("   Token Prefix:", demoSession.accessToken.slice(0, 30) + "...");

  if (
    demoSession.user.email !== "judge@paypal-hackathon.ai" ||
    demoSession.user.role !== "judge" ||
    !demoSession.accessToken
  ) {
    throw new Error("Test 2 Failed: Judge demo session generation failed!");
  }
  console.log("✅ Test 2 Passed: 1-Click Judge Evaluator session generated.");

  // [Test 3] Session Serialization & HMAC-SHA256 Tamper Detection
  console.log("\n[Test 3] Testing Cookie Signature & Tamper Detection...");
  const token = demoSession.accessToken;
  const parsed = extractSessionFromCookieValue(token);

  if (!parsed || parsed.user.email !== "judge@paypal-hackathon.ai") {
    throw new Error("Test 3 Failed: Valid signed token was rejected!");
  }

  // Tamper with token by modifying a payload byte
  const tamperedToken = token.slice(0, 10) + "X" + token.slice(11);
  const tamperedResult = extractSessionFromCookieValue(tamperedToken);

  if (tamperedResult !== null) {
    throw new Error("Test 3 Failed: Tampered token signature check was bypassed!");
  }
  console.log("✅ Test 3 Passed: Valid signature admitted; tampered token rejected.");

  // [Test 4] Expired Token Rejection
  console.log("\n[Test 4] Testing Expired Token Rejection...");
  const expiredSession = createUserSession(demoSession.user, true);
  expiredSession.expiresAt = Date.now() - 10000; // 10s in the past
  const expiredToken = serializeSessionToken(expiredSession);

  const expiredResult = extractSessionFromCookieValue(expiredToken);
  if (expiredResult !== null) {
    throw new Error("Test 4 Failed: Expired session should return null!");
  }
  console.log("✅ Test 4 Passed: Expired token cleanly rejected.");

  // [Test 5] SQLite Users Table Synchronization
  console.log("\n[Test 5] Testing SQLite User Database Synchronization...");
  // A Supabase-style ID: sandbox IDs (usr_...) deliberately never store a real email.
  const testUserId = randomUUID();
  const testUser = {
    id: testUserId,
    email: `founder_${Date.now()}@rico.ai`,
    fullName: "Alex Mercer",
    role: "user" as const,
  };

  await syncUserToDatabase(testUser);

  const [persisted] = await db.select().from(users).where(eq(users.id, testUserId));
  console.log("   Persisted User in DB:", {
    id: persisted?.id,
    email: persisted?.email,
    fullName: persisted?.fullName,
  });

  if (!persisted || persisted.email !== testUser.email) {
    throw new Error("Test 5 Failed: User was not synchronized to SQLite users table!");
  }

  // Clean up test user
  await db.delete(users).where(eq(users.id, testUserId));
  console.log("✅ Test 5 Passed: User synchronized to database.");

  // [Test 6] Cookie Configuration Security Parameters
  console.log("\n[Test 6] Testing Session Cookie Security Attributes...");
  const cookieOpts = getSessionCookieOptions();
  console.log("   Cookie Options:", cookieOpts);

  if (!cookieOpts.httpOnly || cookieOpts.path !== "/" || cookieOpts.sameSite !== "lax") {
    throw new Error("Test 6 Failed: Insecure cookie options detected!");
  }
  console.log("✅ Test 6 Passed: HTTP-only, SameSite lax, root path enforced.");

  console.log("\n==================================================");
  console.log("🎉 ALL 6 Supabase Auth & Session Bridge Tests PASSED!");
  console.log("==================================================");
}

runAuthTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Auth test failed:", err);
    process.exit(1);
  });
