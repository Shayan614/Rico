/**
 * Modular Skill Registry
 * Manages loaded skills, file system discovery, and runtime enablement.
 */

import fs from "fs";
import path from "path";
import { Skill } from "./types";
import { parseSkillMarkdown } from "./parser";

class SkillRegistry {
  private skills: Map<string, Skill> = new Map();
  private initialized = false;

  constructor() {
    this.registerBuiltInSkills();
  }

  /**
   * Registers a parsed Skill object
   */
  public registerSkill(skill: Skill): void {
    this.skills.set(skill.metadata.id, skill);
  }

  /**
   * Parses and registers a skill from a raw markdown string
   */
  public registerSkillFromMarkdown(markdown: string, filePath?: string): Skill {
    const skill = parseSkillMarkdown(markdown, filePath);
    this.registerSkill(skill);
    return skill;
  }

  /**
   * Removes a skill by its unique ID
   */
  public unregisterSkill(id: string): boolean {
    return this.skills.delete(id.toLowerCase());
  }

  /**
   * Retrieves a skill by ID
   */
  public getSkill(id: string): Skill | undefined {
    return this.skills.get(id.toLowerCase());
  }

  /**
   * Retrieves all registered skills with optional filtering
   */
  public getAllSkills(filter?: {
    category?: string;
    enabledOnly?: boolean;
    persona?: string;
  }): Skill[] {
    let list = Array.from(this.skills.values());

    if (filter?.enabledOnly) {
      list = list.filter((s) => s.enabled);
    }
    if (filter?.category) {
      list = list.filter((s) => s.metadata.category === filter.category);
    }
    if (filter?.persona && filter.persona !== "all") {
      list = list.filter(
        (s) => s.metadata.persona === "all" || s.metadata.persona === filter.persona
      );
    }

    return list;
  }

  /**
   * Toggles whether a skill is active in the agent runtime
   */
  public setSkillEnabled(id: string, enabled: boolean): boolean {
    const skill = this.skills.get(id.toLowerCase());
    if (!skill) return false;
    skill.enabled = enabled;
    this.skills.set(id.toLowerCase(), skill);
    return true;
  }

  /**
   * Scans a directory recursively for `SKILL.md` or `skill.md` files
   */
  public async loadSkillsFromDirectory(dirPath: string): Promise<Skill[]> {
    const loaded: Skill[] = [];
    if (!fs.existsSync(dirPath)) {
      return loaded;
    }

    const traverse = (currentDir: string) => {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          traverse(fullPath);
        } else if (
          entry.isFile() &&
          (entry.name.toLowerCase() === "skill.md" || entry.name.endsWith(".skill.md"))
        ) {
          try {
            const content = fs.readFileSync(fullPath, "utf-8");
            const skill = this.registerSkillFromMarkdown(content, fullPath);
            loaded.push(skill);
          } catch (err) {
            console.warn(`[SkillRegistry] Failed to parse ${fullPath}:`, err);
          }
        }
      }
    };

    try {
      traverse(dirPath);
    } catch (err) {
      console.warn(`[SkillRegistry] Error scanning directory ${dirPath}:`, err);
    }

    return loaded;
  }

  /**
   * Clears all skills (used primarily in tests)
   */
  public clear(): void {
    this.skills.clear();
  }

  /**
   * Resets registry to default built-in skills
   */
  public reset(): void {
    this.skills.clear();
    this.initialized = false;
    this.registerBuiltInSkills();
  }

  /**
   * Seeds default financial skills so Rico always has core capabilities
   */
  private registerBuiltInSkills(): void {
    if (this.initialized) return;
    this.initialized = true;

    // Built-in 1: Startup Credit & Grant Drafter
    this.registerSkillFromMarkdown(`---
id: startup-credit-grant
name: Startup Credit & Grant Application Drafter
description: Guides founders to claim up to $50,000 PostHog, $5,000 AWS, and Notion AI credits, and crafts high-acceptance pitch summaries.
category: startup
persona: founder
version: 1.2.0
triggers:
  - startup credit
  - posthog credit
  - aws activate
  - notion grant
  - founder discount
  - zero burn stack
  - tech stack savings
toolsRequired:
  - check_persona_savings
  - create_mandate
---

## Instructions
When a user asks about startup discounts or cloud credits:
1. Probe their stage (bootstrapped, pre-seed, or funded) and current tech stack.
2. Check eligibility for PostHog ($50k over 12 months for startups under $5M funding), AWS Activate ($5k credits), and Notion AI ($1k).
3. Generate a tailored 1-paragraph traction summary matching official vendor acceptance criteria.
4. If they accept, configure their recurring mandate at $0.00 until credits expire.

## Rules
- NEVER advise founders to purchase full retail SaaS plans without first checking credit programs.
- Highlight the exact dollar amount of runway saved.
- Ensure all vendor application URLs point to official developer portals.

## Few-Shot Examples
### Example 1
User: Can Rico help my seed startup save on analytics and server costs?
Thought: User is a seed startup founder looking for cloud and analytics savings.
Assistant: I have activated the Startup Credit Drafter skill. You qualify for $50,000 in PostHog startup credits and $5,000 in AWS Activate credits, saving your team over $4,500/month in burn. Would you like me to generate your application pitch or set up your $0-burn spending rules?
`);

    // Built-in 2: Student 50% Discount Enforcer
    this.registerSkillFromMarkdown(`---
id: student-discount-enforcer
name: Student 50% Discount Enforcer
description: Unlocks 50% student tiers for Spotify, Adobe Creative Cloud, Apple Music, and GitHub Student Developer Pack.
category: student
persona: student
version: 1.1.0
triggers:
  - student discount
  - college deal
  - university pricing
  - edu email
  - spotify student
  - adobe student
  - github student
toolsRequired:
  - verify_web_price
  - check_persona_savings
---

## Instructions
When a student inquires about subscriptions or services:
1. Verify their educational eligibility (.edu email address or SheerID/UNiDAYS check).
2. Look up the verified student rate (e.g. Spotify at $5.99/mo instead of $11.99/mo; Adobe at $19.99/mo instead of $59.99/mo).
3. Automatically apply the 50% discount to their budget ceiling before setting up recurring payments.

## Rules
- Cap spending mandates to the verified student rate.
- Notify the student 30 days before annual SheerID re-verification is required.
`);

    // Built-in 3: Tax Deduction & Expense OCR Classifier
    this.registerSkillFromMarkdown(`---
id: tax-deduction-ocr
name: Tax Deduction & Business Expense Classifier
description: Classifies recurring transactions, receipts, and vendor invoices into IRS Schedule C tax deductible expense categories.
category: tax
persona: freelancer
version: 1.0.0
triggers:
  - tax deduction
  - schedule c
  - write off
  - expense classification
  - receipt ocr
  - invoice deduction
  - business expense
toolsRequired:
  - create_mandate
---

## Instructions
When transactions or invoices are processed:
1. Analyze the vendor name, description, and itemized lines.
2. Map the purchase to IRS Schedule C categories:
   - Advertising & Marketing (Google Ads, Meta, PostHog)
   - Software & Cloud Infrastructure (AWS, GitHub, Vercel, Supabase, OpenAI)
   - Office Expenses & Subscriptions (Zoom, Slack, Notion)
   - Professional Services (Legal, Accounting, Contractors via PayPal Payouts)
3. Calculate estimated tax savings assuming standard 25-30% self-employment and corporate tax rates.

## Rules
- Mark 100% ordinary and necessary business expenses as deductible.
- Require dual-use items (home internet, mobile phones) to specify business percentage (typically 50-80%).
`);
    // Try to load any skills from the workspace "skills" directory if accessible
    try {
      const skillsDir = path.resolve(process.cwd(), "skills");
      if (fs.existsSync(skillsDir)) {
        this.loadSkillsFromDirectory(skillsDir);
      }
    } catch {
      // safe fallback in restricted environments
    }
  }
}

export const skillRegistry = new SkillRegistry();
