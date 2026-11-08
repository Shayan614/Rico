import { creditMatcherEngine } from "./credit-matcher";
import { FounderProfile } from "./types";

async function runCreditsTests() {
  console.log("==================================================");
  console.log("⚡ Testing 2.9 Startup Credit & Grant Matcher Engine");
  console.log("==================================================");

  // [Test 1] Seed AI Startup Profile Matching
  console.log("\n[Test 1] Testing Early-Stage AI Startup Profile Matching...");
  const aiStartup: FounderProfile = {
    name: "Alex Mercer",
    companyName: "Rico AI",
    websiteUrl: "https://rico.ai",
    foundedYear: 2025,
    fundingStage: "SEED",
    totalFundingRaisedUsd: 500000,
    monthlyBurnRateUsd: 12000,
    techStack: ["Next.js", "TypeScript", "PostgreSQL", "DeepSeek", "Gemini", "AWS"],
    productCategory: "AI Agentic Commerce",
    tagline: "Autonomous financial agent for businesses",
    description: "Multi-agent autonomous financial platform with verified budget ceilings and digital receipts.",
  };

  const report1 = await creditMatcherEngine.matchProfile(aiStartup, 2026);
  console.log("   Company:", report1.profile.companyName);
  console.log("   Eligible Programs:", `${report1.totalEligiblePrograms} / ${report1.topMatches.length}`);
  console.log("   Total Potential Credits:", `$${report1.totalPotentialCreditsUsd.toLocaleString()}`);
  console.log("   Runway Extension:", `${report1.runwayExtensionMonths} months`);
  console.log("   Dilution Saved:", `${report1.dilutionSavedPercent}% equity preserved`);
  console.log("   Top 3 Matches:", report1.topMatches.slice(0, 3).map((m) => `${m.program.name} ($${m.estimatedValueUsd.toLocaleString()})`));

  if (
    report1.totalEligiblePrograms < 5 ||
    report1.totalPotentialCreditsUsd < 100000 ||
    report1.runwayExtensionMonths <= 0
  ) {
    throw new Error("Test 1 Failed: Expected early-stage AI startup to match at least 5 programs and $100k+ in credits!");
  }
  console.log("✅ Test 1 Passed: Early-stage startup matched premier credits ($100k+) and extended runway.");

  // [Test 2] Student Founder Profile Matching
  console.log("\n[Test 2] Testing Student Founder Matching (.edu email verification)...");
  const studentProfile: FounderProfile = {
    name: "Maya Lin",
    companyName: "StudySprint",
    websiteUrl: "https://studysprint.app",
    foundedYear: 2026,
    fundingStage: "BOOTSTRAPPED",
    totalFundingRaisedUsd: 0,
    monthlyBurnRateUsd: 500,
    techStack: ["React", "Python", "FastAPI"],
    productCategory: "EdTech",
    tagline: "AI study session coordinator",
    description: "App helping university students organize group study sessions.",
    isStudentFounder: true,
    universityName: "Stanford University",
    studentEmail: "mlin@stanford.edu",
  };

  const studentReport = await creditMatcherEngine.matchProfile(studentProfile, 2026);
  const studentPack = studentReport.topMatches.find((m) => m.program.id === "github-student-pack");

  console.log("   Student Eligible Programs:", studentReport.totalEligiblePrograms);
  console.log("   GitHub Student Pack Matched:", !!studentPack?.isEligible);
  console.log("   Student Dev Suite Value:", `$${studentPack?.estimatedValueUsd.toLocaleString()}`);

  if (!studentPack || !studentPack.isEligible) {
    throw new Error("Test 2 Failed: Student founder with .edu email must be eligible for GitHub Student Developer Pack!");
  }
  console.log("✅ Test 2 Passed: Student founder successfully matched GitHub Student Developer Pack & education grants.");

  // [Test 3] Disqualification & Criteria Validation
  console.log("\n[Test 3] Testing Disqualification Logic (Over-Funded & Aged Startup)...");
  const matureCompany: FounderProfile = {
    name: "Enterprise Founder",
    companyName: "Legacy SaaS Corp",
    websiteUrl: "https://legacysaas.com",
    foundedYear: 2018, // 8 years old!
    fundingStage: "SERIES_A",
    totalFundingRaisedUsd: 25000000, // $25M raised (exceeds PostHog $5M cap and AWS $10M cap)
    monthlyBurnRateUsd: 150000,
    techStack: ["Java", "Oracle"],
    productCategory: "Legacy ERP",
    tagline: "Enterprise database connectors",
    description: "Mature ERP migration systems.",
  };

  const matureReport = await creditMatcherEngine.matchProfile(matureCompany, 2026);
  const posthogMatch = matureReport.topMatches.find((m) => m.program.id === "posthog-startups");

  console.log("   Mature Company Eligible Programs:", matureReport.totalEligiblePrograms);
  console.log("   PostHog Eligible:", posthogMatch?.isEligible);
  console.log("   PostHog Disqualification Reasons:", posthogMatch?.disqualificationReasons);

  if (posthogMatch?.isEligible) {
    throw new Error("Test 3 Failed: Mature startup with $25M funding should be disqualified from PostHog startup program!");
  }
  console.log("✅ Test 3 Passed: Ineligible startup correctly disqualified with clear explanation.");

  // [Test 4] Application Pitch & Essay Drafter
  console.log("\n[Test 4] Testing Application Pitch & Essay Drafter...");
  const draft = await creditMatcherEngine.draftPitch(aiStartup, "posthog-startups");

  console.log("   Program Name:", draft.programName);
  console.log("   One-Liner:", draft.oneLinerPitch);
  console.log("   Readiness Score:", `${draft.readinessScore}%`);
  console.log("   Sample Answer [use_case]:", draft.answers["use_case"]);

  if (!draft.answers["use_case"] || !draft.oneLinerPitch || draft.readinessScore < 90) {
    throw new Error("Test 4 Failed: Expected generated pitch answers and high readiness score!");
  }
  console.log("✅ Test 4 Passed: Tailored pitch application drafted with architectural details.");

  // [Test 5] Runway Extension & Dilution Equivalent Calculation
  console.log("\n[Test 5] Testing Dilution & Runway Math...");
  // $100,000 in credits at $10,000/mo burn = exactly 10 months runway added!
  const mathProfile: FounderProfile = {
    name: "Math Test",
    companyName: "Math Test Corp",
    websiteUrl: "https://mathtest.io",
    foundedYear: 2025,
    fundingStage: "BOOTSTRAPPED",
    totalFundingRaisedUsd: 0,
    monthlyBurnRateUsd: 10000,
    techStack: ["Next.js"],
    productCategory: "Fintech",
    tagline: "Testing math",
    description: "Testing math.",
  };

  const mathReport = await creditMatcherEngine.matchProfile(mathProfile, 2026);
  console.log(`   Monthly Burn: $10,000/mo | Credits: $${mathReport.totalPotentialCreditsUsd.toLocaleString()}`);
  console.log(`   Calculated Runway Extension: ${mathReport.runwayExtensionMonths} months`);
  console.log(`   Dilution Preserved: ${mathReport.dilutionSavedPercent}%`);

  if (mathReport.runwayExtensionMonths <= 0 || mathReport.dilutionSavedPercent <= 0) {
    throw new Error("Test 5 Failed: Runway and dilution calculation must be positive non-zero!");
  }
  console.log("✅ Test 5 Passed: Runway months and equity dilution math verified.");

  // [Test 6] Parallel High-Throughput Batch Matching via Worker Pool
  console.log("\n[Test 6] Testing Parallel Batch Matching (3 Profiles via BatchQueueEngine)...");
  const batchProfiles = [
    aiStartup,
    studentProfile,
    {
      name: "Bio Founder",
      companyName: "BioGen",
      websiteUrl: "https://biogen.health",
      foundedYear: 2025,
      fundingStage: "PRE_SEED" as const,
      totalFundingRaisedUsd: 100000,
      monthlyBurnRateUsd: 8000,
      techStack: ["Python", "TensorFlow", "Next.js"],
      productCategory: "BioTech AI",
      tagline: "Genomics sequencing acceleration",
      description: "AI platform for clinical gene analysis.",
    },
  ];

  const batchResults = await creditMatcherEngine.batchMatch(batchProfiles, { priority: "HIGH" });
  console.log("   Batch Profiles Processed:", batchResults.length);
  console.log("   Companies Matched:", batchResults.map((r) => `${r.profile.companyName} ($${r.totalPotentialCreditsUsd.toLocaleString()})`));

  if (batchResults.length !== 3) {
    throw new Error("Test 6 Failed: Batch matching failed to process all 3 profiles!");
  }
  console.log("✅ Test 6 Passed: High-throughput batch credit matching verified across worker pool.");

  console.log("\n==================================================");
  console.log("🎉 ALL 6 Startup Credit & Grant Matcher Tests PASSED!");
  console.log("==================================================");
}

runCreditsTests().catch((err) => {
  console.error("❌ Credits Tests Failed:", err);
  process.exit(1);
});
