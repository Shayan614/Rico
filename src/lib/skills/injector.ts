/**
 * Modular Skill Runtime Injector
 * Matches user prompts against enabled skills and dynamically injects
 * domain-specific instructions, constraints, and few-shot tool calls into
 * the agent's runtime context.
 */

import { skillRegistry } from "./registry";
import {
  Skill,
  SkillMatchResult,
  SkillInjectionOptions,
  InjectedSkillContext,
} from "./types";

/**
 * Strips asterisks / markdown stars to strictly satisfy Anas's Clean Code rules.
 */
function cleanText(text: string): string {
  if (!text) return "";
  return text
    .replace(/^(\s*)\*+(\s*)/gm, "$1- $2")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^(\s*)\*+\s*/gm, "$1")
    .replace(/\s*\*+\s*$/gm, "")
    .replace(/^\*+/, "")
    .replace(/\*+$/, "");
}

export class SkillInjector {
  /**
   * Matches a user query and persona against all registered enabled skills.
   * Returns ranked match results with confidence score (0 to 1).
   */
  public matchSkills(
    userMessage: string,
    options?: SkillInjectionOptions
  ): SkillMatchResult[] {
    const skills = skillRegistry.getAllSkills({ enabledOnly: true });
    const normalizedInput = userMessage.toLowerCase();
    const results: SkillMatchResult[] = [];

    const minConfidence = options?.minConfidence ?? 0.25;
    const forceIds = options?.forceIncludeIds?.map((id) => id.toLowerCase()) || [];

    for (const skill of skills) {
      const skillId = skill.metadata.id.toLowerCase();

      // Check if forcibly included
      if (forceIds.includes(skillId)) {
        results.push({
          skill,
          score: 1.0,
          matchedTriggers: ["forced"],
          reason: "Manually selected or forced by session state",
        });
        continue;
      }

      let score = 0;
      const matchedTriggers: string[] = [];

      // 1. Check triggers
      for (const trigger of skill.metadata.triggers) {
        const lowerTrigger = trigger.toLowerCase();
        if (normalizedInput.includes(lowerTrigger)) {
          // Longer triggers have higher specificity
          const wordCount = lowerTrigger.split(/\s+/).length;
          const weight = 0.35 + Math.min(0.5, wordCount * 0.15);
          score += weight;
          matchedTriggers.push(trigger);
        }
      }

      // 2. Check skill name
      if (normalizedInput.includes(skill.metadata.name.toLowerCase())) {
        score += 0.4;
        matchedTriggers.push(skill.metadata.name);
      }

      // 3. Persona match bonus
      if (
        options?.persona &&
        (skill.metadata.persona === options.persona ||
          skill.metadata.persona === "all")
      ) {
        score += 0.15;
      }

      // Cap score at 1.0
      score = Math.min(1.0, score);

      if (score >= minConfidence && matchedTriggers.length > 0) {
        results.push({
          skill,
          score: Math.round(score * 100) / 100,
          matchedTriggers,
          reason: `Matched ${matchedTriggers.length} trigger phrase(s): ${matchedTriggers.slice(0, 3).join(", ")}`,
        });
      }
    }

    // Sort descending by score
    results.sort((a, b) => b.score - a.score);

    const maxSkills = options?.maxSkills ?? 3;
    return results.slice(0, maxSkills);
  }

  /**
   * Generates a clean markdown prompt block to inject into the system prompt.
   * Format is carefully structured with zero asterisks / AI slop.
   */
  public buildInjectionPrompt(activeSkills: Skill[]): string {
    if (!activeSkills || activeSkills.length === 0) {
      return "";
    }

    const sections: string[] = [];

    sections.push("### DYNAMICALLY INJECTED DOMAIN SKILLS");
    sections.push(
      "The following specialized skills have been matched and activated for this interaction:"
    );

    for (let i = 0; i < activeSkills.length; i++) {
      const s = activeSkills[i];
      const num = i + 1;
      sections.push(`\n--- SKILL ${num}: ${s.metadata.name.toUpperCase()} (ID: ${s.metadata.id}) ---`);
      sections.push(`CATEGORY: ${s.metadata.category.toUpperCase()}`);
      sections.push(`DESCRIPTION: ${cleanText(s.metadata.description)}`);

      if (s.rules && s.rules.length > 0) {
        sections.push("MANDATORY RULES & GUARDRAILS:");
        for (const rule of s.rules) {
          sections.push(`- ${cleanText(rule)}`);
        }
      }

      if (s.instructions) {
        sections.push("EXECUTION INSTRUCTIONS:");
        sections.push(cleanText(s.instructions));
      }

      if (s.fewShotExamples && s.fewShotExamples.length > 0) {
        sections.push("FEW-SHOT EXAMPLES:");
        s.fewShotExamples.forEach((ex, idx) => {
          sections.push(`Example ${idx + 1}:`);
          sections.push(`User: ${cleanText(ex.user)}`);
          if (ex.thought) {
            sections.push(`Thought: ${cleanText(ex.thought)}`);
          }
          sections.push(`Assistant: ${cleanText(ex.assistantResponse)}`);
        });
      }
    }

    sections.push("\n### END INJECTED SKILLS\n");
    return sections.join("\n");
  }

  /**
   * Complete runtime injection: matches relevant skills for the user message
   * and builds both the injected prompt and tool suggestions.
   */
  public injectSkills(
    userMessage: string,
    options?: SkillInjectionOptions
  ): InjectedSkillContext {
    const matched = this.matchSkills(userMessage, options);
    const activeSkills = matched.map((m) => m.skill);
    const injectedPrompt = this.buildInjectionPrompt(activeSkills);

    // Aggregate suggested tools
    const toolSet = new Set<string>();
    const triggerSet = new Set<string>();

    for (const m of matched) {
      if (m.skill.metadata.toolsRequired) {
        m.skill.metadata.toolsRequired.forEach((t) => toolSet.add(t));
      }
      m.matchedTriggers.forEach((t) => triggerSet.add(t));
    }

    return {
      activeSkills,
      injectedPrompt,
      suggestedTools: Array.from(toolSet),
      matchedTriggers: Array.from(triggerSet),
    };
  }
}

export const skillInjector = new SkillInjector();
