/**
 * Test Suite for Modular SKILL.md Parser & Runtime Injector
 * Run with tsx or node
 */

import { parseSkillMarkdown } from "./parser";
import { skillRegistry } from "./registry";
import { skillInjector } from "./injector";

export async function runSkillTests(): Promise<{
  passed: number;
  failed: number;
  results: Array<{ name: string; success: boolean; error?: string }>;
}> {
  const results: Array<{ name: string; success: boolean; error?: string }> = [];

  function assert(condition: boolean, message: string) {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  const testCases: Array<{ name: string; fn: () => void | Promise<void> }> = [
    {
      name: "1. Parse standard SKILL.md with YAML frontmatter",
      fn: () => {
        const raw = `---
id: crypto-yield-audit
name: Crypto Yield & Staking Auditor
description: Audits DeFi yields and tokenized cash buffers.
category: finance
persona: founder
version: 2.1.0
triggers:
  - staking yield
  - crypto treasury
  - defi audit
toolsRequired:
  - verify_web_price
  - execute_paypal_payment
---

## Instructions
1. Inspect smart contract APYs.
2. Check slippage and liquidity depth.

## Rules
- Never allocate more than 15% to unaudited protocols.
- Flag high-volatility token payouts.

## Few-Shot Examples
### Example 1
User: Can you check staking yield on Solana?
Thought: User wants a DeFi audit.
Assistant: Staking audit complete. Average risk-adjusted yield is 6.8%.
`;
        const skill = parseSkillMarkdown(raw);
        assert(skill.metadata.id === "crypto-yield-audit", "ID matches");
        assert(skill.metadata.name === "Crypto Yield & Staking Auditor", "Name matches");
        assert(skill.metadata.category === "finance", "Category matches");
        assert(skill.metadata.persona === "founder", "Persona matches");
        assert(skill.metadata.triggers.includes("staking yield"), "Trigger parsed");
        assert(skill.rules.length === 2, "Rules count matches 2");
        assert(skill.fewShotExamples.length === 1, "Example parsed");
        assert(skill.enabled === true, "Default enabled is true");
      },
    },
    {
      name: "2. Parse header-based SKILL.md without YAML frontmatter",
      fn: () => {
        const raw = `# Freelance Invoice Follow-up
Description: Automated reminders for overdue client invoices.

## Triggers
- unpaid invoice
- late payment
- client reminder

## Rules
- Only send reminders after net-30 has passed.
- Maintain professional and courteous tone.

## Instructions
Send respectful payment links via PayPal Invoicing.
`;
        const skill = parseSkillMarkdown(raw);
        assert(skill.metadata.name.includes("Freelance Invoice Follow-up"), "Header name extracted");
        assert(skill.metadata.triggers.includes("unpaid invoice"), "Markdown triggers extracted");
        assert(skill.rules.length === 2, "Rules extracted");
      },
    },
    {
      name: "3. Skill Registry operations",
      fn: () => {
        skillRegistry.reset();
        const initialCount = skillRegistry.getAllSkills().length;
        assert(initialCount >= 3, "Built-in skills registered on boot");

        const testSkillRaw = `---
id: test-temp-skill
name: Temporary Test Skill
description: Testing registry additions.
category: custom
triggers:
  - test query
---
Instructions here.
`;
        const created = skillRegistry.registerSkillFromMarkdown(testSkillRaw);
        assert(created.metadata.id === "test-temp-skill", "Created skill has right ID");
        assert(skillRegistry.getSkill("test-temp-skill") !== undefined, "Retrieved from registry");

        // Toggle enabled
        skillRegistry.setSkillEnabled("test-temp-skill", false);
        const disabled = skillRegistry.getSkill("test-temp-skill");
        assert(disabled?.enabled === false, "Skill successfully disabled");

        // Filter enabled only
        const enabledOnly = skillRegistry.getAllSkills({ enabledOnly: true });
        assert(!enabledOnly.some((s) => s.metadata.id === "test-temp-skill"), "Disabled excluded");

        // Remove
        const removed = skillRegistry.unregisterSkill("test-temp-skill");
        assert(removed === true, "Skill unregistered");
        assert(skillRegistry.getSkill("test-temp-skill") === undefined, "Skill no longer exists");
      },
    },
    {
      name: "4. Skill Injector matching & confidence scoring",
      fn: () => {
        skillRegistry.reset();

        // Should match startup credits skill
        const startupMatches = skillInjector.matchSkills(
          "I am starting a company and need PostHog credit and AWS Activate",
          { persona: "founder" }
        );
        assert(startupMatches.length > 0, "Matches startup query");
        assert(startupMatches[0].skill.metadata.id === "startup-credit-grant", "Top match is startup credit");
        assert(startupMatches[0].score >= 0.5, "Confidence score is strong");

        // Should match student discount skill
        const studentMatches = skillInjector.matchSkills(
          "Do you have a student discount for Spotify and university pricing?",
          { persona: "student" }
        );
        assert(studentMatches.length > 0, "Matches student query");
        assert(studentMatches[0].skill.metadata.id === "student-discount-enforcer", "Top match is student discount");

        // Unrelated query should not match
        const unrelatedMatches = skillInjector.matchSkills("The quick brown fox jumps over the lazy dog");
        assert(unrelatedMatches.length === 0, "No false positive matches");
      },
    },
    {
      name: "5. Prompt injection formatting conforms to zero-asterisk rules",
      fn: () => {
        skillRegistry.reset();
        const injection = skillInjector.injectSkills("Can I write off my AWS and software subscriptions for tax deduction?", {
          persona: "freelancer",
        });

        assert(injection.activeSkills.length > 0, "Tax skill matched");
        assert(injection.injectedPrompt.includes("DYNAMICALLY INJECTED DOMAIN SKILLS"), "Section header exists");
        assert(injection.injectedPrompt.includes("TAX DEDUCTION"), "Skill name included");

        // Verify Anas's rule: zero markdown asterisks
        assert(!injection.injectedPrompt.includes("**"), "No double asterisks in prompt");
        assert(!injection.injectedPrompt.includes("* "), "No asterisk bullet points");
      },
    },
  ];

  let passed = 0;
  let failed = 0;

  for (const tc of testCases) {
    try {
      await tc.fn();
      results.push({ name: tc.name, success: true });
      passed++;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      results.push({ name: tc.name, success: false, error: errorMsg });
      failed++;
    }
  }

  return { passed, failed, results };
}

// Allow CLI direct execution
if (process.argv[1]?.includes("test")) {
  runSkillTests().then((res) => {
    console.log(`\n=== SKILL RUNTIME INJECTOR TEST RESULTS ===`);
    console.log(`Passed: ${res.passed}/${res.passed + res.failed}`);
    for (const r of res.results) {
      console.log(`${r.success ? "✅" : "❌"} ${r.name}`);
      if (r.error) {
        console.error(`   Error: ${r.error}`);
      }
    }
  });
}
