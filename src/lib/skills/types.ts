/**
 * Modular SKILL.md Types & Interfaces
 * Rico Agentic Commerce - PayPal AI Hackathon 2026
 */

export type SkillCategory =
  | "finance"
  | "startup"
  | "student"
  | "tax"
  | "commerce"
  | "contract"
  | "custom";

export interface SkillMetadata {
  id: string;
  name: string;
  description: string;
  version?: string;
  author?: string;
  category: SkillCategory;
  triggers: string[];
  toolsRequired?: string[];
  mcpServers?: string[];
  persona?: "founder" | "student" | "freelancer" | "consumer" | "all";
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface SkillFewShotExample {
  user: string;
  thought?: string;
  toolCall?: {
    name: string;
    arguments: Record<string, unknown>;
  };
  assistantResponse: string;
}

export interface Skill {
  metadata: SkillMetadata;
  instructions: string;
  rules: string[];
  fewShotExamples: SkillFewShotExample[];
  rawContent: string;
  filePath?: string;
  enabled: boolean;
}

export interface SkillMatchResult {
  skill: Skill;
  score: number; // 0 to 1 confidence
  matchedTriggers: string[];
  reason: string;
}

export interface SkillInjectionOptions {
  maxSkills?: number;
  minConfidence?: number;
  persona?: string;
  forceIncludeIds?: string[];
}

export interface InjectedSkillContext {
  activeSkills: Skill[];
  injectedPrompt: string;
  suggestedTools: string[];
  matchedTriggers: string[];
}
