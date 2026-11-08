/**
 * Modular SKILL.md Parser
 * Parses standard YAML frontmatter + markdown SKILL.md files into typed Skill definitions.
 * Zero-dependency, safe string extraction with fallback support for header-based metadata.
 */

import { Skill, SkillMetadata, SkillCategory, SkillFewShotExample } from "./types";

interface ParsedFrontmatter {
  attributes: Record<string, unknown>;
  body: string;
}

/**
 * Extracts YAML-like key-value frontmatter without heavy external libraries.
 */
function extractFrontmatter(content: string): ParsedFrontmatter {
  const trimmed = content.trim();
  if (!trimmed.startsWith("---")) {
    return { attributes: {}, body: trimmed };
  }

  const endIdx = trimmed.indexOf("\n---", 3);
  if (endIdx === -1) {
    return { attributes: {}, body: trimmed };
  }

  const rawYaml = trimmed.slice(3, endIdx).trim();
  const body = trimmed.slice(endIdx + 4).trim();
  const attributes: Record<string, unknown> = {};

  const lines = rawYaml.split("\n");
  let currentKey = "";
  let inArray = false;
  let arrayValues: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    // Check for array item continuation
    if (inArray && line.startsWith("-")) {
      const val = line.replace(/^-\s*/, "").replace(/^["']|["']$/g, "").trim();
      arrayValues.push(val);
      continue;
    } else if (inArray && !line.startsWith("-")) {
      attributes[currentKey] = arrayValues;
      inArray = false;
      arrayValues = [];
    }

    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim();
    const val = line.slice(colonIdx + 1).trim();

    if (val === "" || val === "[]") {
      // Might be start of multiline array
      currentKey = key;
      inArray = true;
      arrayValues = [];
    } else if (val.startsWith("[") && val.endsWith("]")) {
      // Inline array: [a, b, c]
      const items = val
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
      attributes[key] = items;
    } else {
      // Scalar value
      const cleanVal = val.replace(/^["']|["']$/g, "").trim();
      if (cleanVal.toLowerCase() === "true") {
        attributes[key] = true;
      } else if (cleanVal.toLowerCase() === "false") {
        attributes[key] = false;
      } else if (!isNaN(Number(cleanVal)) && cleanVal !== "") {
        attributes[key] = Number(cleanVal);
      } else {
        attributes[key] = cleanVal;
      }
    }
  }

  if (inArray && currentKey) {
    attributes[currentKey] = arrayValues;
  }

  return { attributes, body };
}

/**
 * Extracts sections from markdown body using H2 headings (## Section Name)
 */
function extractMarkdownSections(body: string): Record<string, string> {
  const sections: Record<string, string> = {};
  const lines = body.split("\n");
  let currentHeader = "__intro__";
  let currentContent: string[] = [];

  for (const line of lines) {
    // Only split top-level sections on H2 headers (## Section) or H1
    const headerMatch = line.match(/^#{1,2}\s+(.+)$/);
    if (headerMatch) {
      if (currentContent.length > 0) {
        sections[currentHeader.toLowerCase()] = currentContent.join("\n").trim();
      }
      currentHeader = headerMatch[1].trim();
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }

  if (currentContent.length > 0) {
    sections[currentHeader.toLowerCase()] = currentContent.join("\n").trim();
  }

  return sections;
}

/**
 * Parses bullet rules from markdown text
 */
function parseRules(text: string): string[] {
  if (!text) return [];
  const lines = text.split("\n");
  const rules: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      rules.push(trimmed.slice(2).trim());
    } else if (/^\d+\.\s+/.test(trimmed)) {
      rules.push(trimmed.replace(/^\d+\.\s+/, "").trim());
    }
  }

  return rules;
}

/**
 * Parses few-shot examples from markdown
 */
function parseFewShotExamples(text: string): SkillFewShotExample[] {
  if (!text) return [];
  const examples: SkillFewShotExample[] = [];

  // Split on "### Example", "Example 1:", or "---"
  const blocks = text.split(/(?:^|\n)(?:###?\s*Example[^\n]*|Example\s*\d+:?)/i).filter((b) => b.trim().length > 0);

  for (const block of blocks) {
    const userMatch = block.match(/(?:User|Prompt|Input):\s*([\s\S]+?)(?=\n\s*(?:Thought|Assistant|Action|Response|$))/i);
    const thoughtMatch = block.match(/Thought:\s*([\s\S]+?)(?=\n\s*(?:Assistant|Action|Response|$))/i);
    const assistantMatch = block.match(/(?:Assistant|Response):\s*([\s\S]+)$/i);

    if (userMatch && assistantMatch) {
      examples.push({
        user: userMatch[1].trim(),
        thought: thoughtMatch ? thoughtMatch[1].trim() : undefined,
        assistantResponse: assistantMatch[1].trim(),
      });
    }
  }

  return examples;
}

/**
 * Normalizes category string to valid SkillCategory enum
 */
function normalizeCategory(cat?: unknown): SkillCategory {
  if (typeof cat !== "string") return "custom";
  const lower = cat.toLowerCase().trim();
  if (["finance", "startup", "student", "tax", "commerce", "contract"].includes(lower)) {
    return lower as SkillCategory;
  }
  return "custom";
}

/**
 * Main parser entry point: parses a SKILL.md raw string into a structured Skill object
 */
export function parseSkillMarkdown(rawContent: string, filePath?: string): Skill {
  if (!rawContent || typeof rawContent !== "string") {
    throw new Error("Cannot parse empty or invalid SKILL.md content");
  }

  const { attributes, body } = extractFrontmatter(rawContent);
  const sections = extractMarkdownSections(body);

  // Extract metadata from frontmatter or top headers
  const h1Match = body.match(/^#\s+(.+)$/m);
  const descMatch = body.match(/^(?:Description|Summary):\s*(.+)$/im);

  const id =
    (typeof attributes.id === "string" && attributes.id.trim()) ||
    (h1Match ? h1Match[1].trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-") : undefined) ||
    (filePath ? filePath.split(/[\/\\]/).slice(-2, -1)[0] : undefined) ||
    "skill-" + Math.random().toString(36).substring(2, 8);

  const name =
    (typeof attributes.name === "string" && attributes.name.trim()) ||
    (h1Match ? h1Match[1].trim() : undefined) ||
    (sections["__intro__"] ? sections["__intro__"].split("\n")[0].replace(/^#+\s*/, "").trim() : "") ||
    id;

  const description =
    (typeof attributes.description === "string" && attributes.description.trim()) ||
    (descMatch ? descMatch[1].trim() : undefined) ||
    sections["description"] ||
    (sections["__intro__"] ? sections["__intro__"].slice(0, 300).trim() : "Custom financial agent skill");

  const rawTriggers = attributes.triggers || attributes.trigger_phrases || attributes.keywords;
  let triggers: string[] = [];
  if (Array.isArray(rawTriggers)) {
    triggers = rawTriggers.map((t) => String(t).toLowerCase().trim()).filter(Boolean);
  } else if (typeof rawTriggers === "string") {
    triggers = rawTriggers.split(",").map((t) => t.toLowerCase().trim()).filter(Boolean);
  }

  // Fallback to triggers section in markdown
  if (triggers.length === 0 && sections["triggers"]) {
    triggers = parseRules(sections["triggers"]).map((t) => t.toLowerCase().trim());
  }

  // Extract tools required
  const rawTools = attributes.tools || attributes.toolsRequired;
  let toolsRequired: string[] | undefined;
  if (Array.isArray(rawTools)) {
    toolsRequired = rawTools.map(String);
  } else if (typeof rawTools === "string") {
    toolsRequired = rawTools.split(",").map((s) => s.trim()).filter(Boolean);
  }

  // Extract MCP servers
  const rawMcp = attributes.mcpServers || attributes.mcp_servers;
  let mcpServers: string[] | undefined;
  if (Array.isArray(rawMcp)) {
    mcpServers = rawMcp.map(String);
  }

  // Extract persona
  const personaRaw = typeof attributes.persona === "string" ? attributes.persona.toLowerCase() : undefined;
  const persona =
    personaRaw === "founder" || personaRaw === "student" || personaRaw === "freelancer" || personaRaw === "consumer"
      ? personaRaw
      : "all";

  // Parse rules
  const rulesSection = sections["rules"] || sections["guardrails"] || sections["constraints"] || "";
  const rules = parseRules(rulesSection);

  // Parse few-shot examples
  const examplesSection = sections["examples"] || sections["few-shot examples"] || sections["few shot"] || "";
  const fewShotExamples = parseFewShotExamples(examplesSection);

  // Instructions body (either dedicated section or the body without examples and rules)
  const instructions =
    sections["instructions"] ||
    sections["workflow"] ||
    sections["guidance"] ||
    body;

  const metadata: SkillMetadata = {
    id: id.toLowerCase().replace(/[^a-z0-9_-]/g, "-"),
    name,
    description,
    version: typeof attributes.version === "string" ? attributes.version : "1.0.0",
    author: typeof attributes.author === "string" ? attributes.author : "Rico Team",
    category: normalizeCategory(attributes.category),
    triggers: triggers.length > 0 ? triggers : [id],
    toolsRequired,
    mcpServers,
    persona,
    tags: Array.isArray(attributes.tags) ? attributes.tags.map(String) : [],
    createdAt: typeof attributes.createdAt === "string" ? attributes.createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return {
    metadata,
    instructions: instructions.trim(),
    rules,
    fewShotExamples,
    rawContent,
    filePath,
    enabled: attributes.enabled !== false,
  };
}
