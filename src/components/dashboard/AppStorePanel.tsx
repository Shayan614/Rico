"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Boxes,
  Cpu,
  Plug,
  Plus,
  Search,
  AlertCircle,
  FileText,
  Sparkles,
  RefreshCw,
  SlidersHorizontal,
  X,
  Code,
  ShieldCheck,
  Check,
  ChevronRight,
  Play,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SkillItem {
  metadata: {
    id: string;
    name: string;
    description: string;
    version?: string;
    author?: string;
    category: string;
    triggers: string[];
    toolsRequired?: string[];
    mcpServers?: string[];
    persona?: string;
    tags?: string[];
  };
  enabled: boolean;
  rulesCount: number;
  examplesCount: number;
  hasFilePath?: boolean;
}

interface MCPServerRecord {
  id: string;
  name: string;
  endpointUrl: string;
  transport: string;
  category: string;
  status: "CONNECTED" | "CONNECTING" | "DISCONNECTED" | "ERROR";
  toolCount?: number;
  latencyMs?: number;
  tools?: Array<{
    name: string;
    description: string;
    isFinancial?: boolean;
  }>;
}

interface AppStorePanelProps {
  onRefreshData?: () => void;
  onDeployPlanMandate?: (service: string, price: number, planName: string) => void;
}

export function AppStorePanel({ onRefreshData }: AppStorePanelProps) {
  const [activeSubTab, setActiveSubTab] = useState<"skills" | "mcp">("skills");
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [mcpServers, setMcpServers] = useState<MCPServerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedPersona, setSelectedPersona] = useState<string>("all");

  // Inspection & Dialog States
  const [inspectSkill, setInspectSkill] = useState<SkillItem | null>(null);
  const [skillFullContent, setSkillFullContent] = useState<string>("");
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importMarkdown, setImportMarkdown] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Skill Testing State
  const [testPrompt, setTestPrompt] = useState("");
  const [testResult, setTestResult] = useState<Record<string, unknown> | null>(null);
  const [testingSkill, setTestingSkill] = useState(false);

  // Add Custom MCP State
  const [isAddMcpOpen, setIsAddMcpOpen] = useState(false);
  const [mcpForm, setMcpForm] = useState({
    name: "",
    endpointUrl: "",
    transport: "SSE",
    category: "finance",
  });
  const [mcpSubmitting, setMcpSubmitting] = useState(false);

  // Fetch Skills and MCP Servers
  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [skillsRes, mcpRes] = await Promise.all([
        fetch("/api/skills"),
        fetch("/api/mcp/registry"),
      ]);

      if (skillsRes.ok) {
        const skillsData = await skillsRes.json();
        setSkills(skillsData.skills || []);
      }

      if (mcpRes.ok) {
        const mcpData = await mcpRes.json();
        setMcpServers(mcpData.servers || []);
      }

      onRefreshData?.();
    } catch (err) {
      console.warn("Failed to fetch App Store data:", err);
    } finally {
      setLoading(false);
    }
  }, [onRefreshData]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Toggle Skill Active State
  const handleToggleSkill = async (id: string, currentEnabled: boolean) => {
    const nextState = !currentEnabled;
    // Optimistic UI update
    setSkills((prev) =>
      prev.map((s) =>
        s.metadata.id === id ? { ...s, enabled: nextState } : s
      )
    );

    try {
      const res = await fetch(`/api/skills/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: nextState }),
      });
      if (!res.ok) {
        // Revert on failure
        setSkills((prev) =>
          prev.map((s) =>
            s.metadata.id === id ? { ...s, enabled: currentEnabled } : s
          )
        );
      }
    } catch {
      setSkills((prev) =>
        prev.map((s) =>
          s.metadata.id === id ? { ...s, enabled: currentEnabled } : s
        )
      );
    }
  };

  // Inspect Skill Details
  const handleOpenInspect = async (skill: SkillItem) => {
    setInspectSkill(skill);
    setSkillFullContent("Loading full markdown definition...");
    try {
      const res = await fetch(`/api/skills/${skill.metadata.id}`);
      if (res.ok) {
        const data = await res.json();
        setSkillFullContent(data.skill?.rawContent || data.skill?.instructions || "");
      } else {
        setSkillFullContent("Failed to load skill details.");
      }
    } catch {
      setSkillFullContent("Error loading skill content.");
    }
  };

  // Test Skill Matching
  const handleTestMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPrompt.trim()) return;
    setTestingSkill(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/skills/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: testPrompt }),
      });
      if (res.ok) {
        const data = await res.json();
        setTestResult(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTestingSkill(false);
    }
  };

  // Import Custom Skill
  const handleImportSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importMarkdown.trim()) return;
    setImportLoading(true);
    setImportError(null);
    try {
      const res = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: importMarkdown }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setImportError(data.error || "Failed to parse skill markdown");
        return;
      }
      setIsImportModalOpen(false);
      setImportMarkdown("");
      fetchAllData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error";
      setImportError(msg);
    } finally {
      setImportLoading(false);
    }
  };

  // Connect Custom MCP Server
  const handleAddMcp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mcpForm.name.trim() || !mcpForm.endpointUrl.trim()) return;
    setMcpSubmitting(true);
    try {
      const res = await fetch("/api/mcp/registry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mcpForm),
      });
      if (res.ok) {
        setIsAddMcpOpen(false);
        setMcpForm({ name: "", endpointUrl: "", transport: "SSE", category: "finance" });
        fetchAllData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setMcpSubmitting(false);
    }
  };

  // Filtered Skills
  const filteredSkills = useMemo(() => {
    return skills.filter((s) => {
      const matchesSearch =
        s.metadata.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.metadata.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.metadata.triggers.some((t) =>
          t.toLowerCase().includes(searchQuery.toLowerCase())
        );

      const matchesCat =
        selectedCategory === "all" || s.metadata.category === selectedCategory;

      const matchesPersona =
        selectedPersona === "all" ||
        s.metadata.persona === "all" ||
        s.metadata.persona === selectedPersona;

      return matchesSearch && matchesCat && matchesPersona;
    });
  }, [skills, searchQuery, selectedCategory, selectedPersona]);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 overflow-hidden">
      {/* Top Banner / Summary */}
      <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/40 flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <Boxes className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
              Rico App Store &amp; Extensibility Hub
            </h2>
            <Badge
              variant="outline"
              className="text-[10px] font-mono border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
            >
              Universal MCP + SKILL.md
            </Badge>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Hot-load financial capabilities and connect external MCP servers with zero code changes.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <div className="bg-neutral-200/60 dark:bg-neutral-800/80 p-0.5 rounded-lg flex items-center">
            <button
              type="button"
              onClick={() => setActiveSubTab("skills")}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
                activeSubTab === "skills"
                  ? "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-xs"
                  : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Skills ({skills.filter((s) => s.enabled).length}/{skills.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab("mcp")}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
                activeSubTab === "mcp"
                  ? "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-xs"
                  : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
              }`}
            >
              <Plug className="w-3.5 h-3.5" />
              <span>MCP Connectors ({mcpServers.length})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={fetchAllData}
            title="Refresh Registry"
            className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>

          {activeSubTab === "skills" ? (
            <button
              type="button"
              onClick={() => setIsImportModalOpen(true)}
              className="h-8 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Import SKILL.md</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsAddMcpOpen(true)}
              className="h-8 px-3 rounded-lg bg-neutral-900 dark:bg-neutral-100 dark:text-neutral-900 hover:bg-neutral-800 text-white text-xs font-medium flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Connect MCP Server</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content View */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeSubTab === "skills" ? (
          <>
            {/* Filter Bar & Search */}
            <div className="flex flex-col lg:flex-row items-center justify-between gap-3 bg-neutral-50 dark:bg-neutral-900/40 p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800">
              <div className="relative w-full lg:w-72">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Search skills, triggers, tools..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-neutral-500 flex items-center gap-1">
                    <SlidersHorizontal className="w-3 h-3" />
                    Category:
                  </span>
                  <div className="flex items-center gap-1">
                    {["all", "startup", "student", "tax", "finance"].map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-2 py-0.5 text-[11px] rounded-md capitalize transition-colors ${
                          selectedCategory === cat
                            ? "bg-indigo-600 text-white font-medium"
                            : "bg-neutral-200/60 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-neutral-500">Persona:</span>
                  <div className="flex items-center gap-1">
                    {["all", "founder", "student", "freelancer"].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setSelectedPersona(p)}
                        className={`px-2 py-0.5 text-[11px] rounded-md capitalize transition-colors ${
                          selectedPersona === p
                            ? "bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 font-medium"
                            : "bg-neutral-200/60 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Prompt Match Simulator */}
            <div className="p-3 bg-neutral-50/70 dark:bg-neutral-900/30 rounded-xl border border-neutral-200/80 dark:border-neutral-800/80">
              <form onSubmit={handleTestMatch} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Test trigger detection (e.g. 'Can I claim PostHog startup credits or 50% Spotify discount?')"
                  value={testPrompt}
                  onChange={(e) => setTestPrompt(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  disabled={testingSkill || !testPrompt.trim()}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium flex items-center gap-1.5 disabled:opacity-50 transition-colors shrink-0"
                >
                  <Play className={`w-3 h-3 ${testingSkill ? "animate-spin" : ""}`} />
                  <span>Test Match</span>
                </button>
              </form>

              {testResult && (
                <div className="mt-2.5 pt-2.5 border-t border-neutral-200/60 dark:border-neutral-800/60 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-neutral-500 text-[11px]">Matcher Result:</span>
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30 font-mono"
                    >
                      {String((testResult.matches as unknown[])?.length || 0)} Skill(s) Matched
                    </Badge>
                  </div>
                  {Array.isArray(testResult.matches) && testResult.matches.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      {(testResult.matches as Array<{ name: string; score: number; matchedTriggers: string[] }>).map(
                        (m, idx) => (
                          <div
                            key={idx}
                            className="px-2 py-1 rounded-md bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-[11px] flex items-center gap-2"
                          >
                            <span className="font-semibold text-neutral-900 dark:text-neutral-100">{m.name}</span>
                            <span className="text-emerald-600 font-mono text-[10px] font-bold">
                              {Math.round(m.score * 100)}% match
                            </span>
                            <span className="text-neutral-400 text-[10px]">
                              ({m.matchedTriggers.join(", ")})
                            </span>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Skills Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredSkills.map((skill) => (
                <div
                  key={skill.metadata.id}
                  className={`p-4 rounded-xl border transition-all flex flex-col justify-between shadow-xs ${
                    skill.enabled
                      ? "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
                      : "border-neutral-200/50 dark:border-neutral-800/50 bg-neutral-50/50 dark:bg-neutral-950/40 opacity-70"
                  }`}
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                            skill.metadata.category === "startup"
                              ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                              : skill.metadata.category === "student"
                              ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                              : skill.metadata.category === "tax"
                              ? "bg-blue-500/10 text-blue-600 border border-blue-500/20"
                              : "bg-purple-500/10 text-purple-600 border border-purple-500/20"
                          }`}
                        >
                          {skill.metadata.name.charAt(0)}
                        </div>
                        <div>
                          <h3 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 line-clamp-1">
                            {skill.metadata.name}
                          </h3>
                          <span className="text-[10px] text-neutral-400 font-mono">
                            v{skill.metadata.version || "1.0.0"} • {skill.metadata.category}
                          </span>
                        </div>
                      </div>

                      {/* Enable/Disable Switch */}
                      <button
                        type="button"
                        onClick={() =>
                          handleToggleSkill(skill.metadata.id, skill.enabled)
                        }
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                          skill.enabled ? "bg-emerald-500" : "bg-neutral-300 dark:bg-neutral-700"
                        }`}
                        title={skill.enabled ? "Disable skill" : "Enable skill"}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                            skill.enabled ? "translate-x-4" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-2.5 line-clamp-2 leading-relaxed">
                      {skill.metadata.description}
                    </p>

                    {/* Triggers Tags */}
                    <div className="mt-3">
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-neutral-400">
                        Activation Triggers:
                      </span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {skill.metadata.triggers.slice(0, 4).map((t, i) => (
                          <span
                            key={i}
                            className="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-[10px] text-neutral-600 dark:text-neutral-300 font-mono"
                          >
                            {t}
                          </span>
                        ))}
                        {skill.metadata.triggers.length > 4 && (
                          <span className="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-[10px] text-neutral-400 font-mono">
                            +{skill.metadata.triggers.length - 4} more
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card Bottom Meta & Actions */}
                  <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-[10px] text-neutral-500 font-mono">
                      <span>{skill.rulesCount} Rules</span>
                      <span>•</span>
                      <span>{skill.examplesCount} Examples</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenInspect(skill)}
                      className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5"
                    >
                      <span>View SKILL.md</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {filteredSkills.length === 0 && (
              <div className="py-12 text-center text-neutral-400 text-xs">
                No skills matched your search or category filter.
              </div>
            )}
          </>
        ) : (
          /* MCP Connectors View */
          <div className="space-y-4">
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-between gap-3 text-xs text-blue-700 dark:text-blue-300">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-500 shrink-0" />
                <span>
                  <strong>Universal Model Context Protocol:</strong> Rico auto-discovers tools via{" "}
                  <code className="px-1 py-0.5 rounded bg-blue-500/20 font-mono">tools/list</code> and binds them to Gemini/Claude model memory in seconds.
                </span>
              </div>
              <Badge
                variant="outline"
                className="border-blue-500/30 bg-blue-500/20 text-blue-600 dark:text-blue-300 font-mono text-[10px]"
              >
                Zero-Code Rewrites
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {mcpServers.map((server) => (
                <div
                  key={server.id}
                  className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center font-bold text-xs text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700">
                          <Cpu className="w-4 h-4 text-indigo-500" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h3 className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                              {server.name}
                            </h3>
                            {server.id === "paypal-mcp" && (
                              <Badge
                                variant="outline"
                                className="text-[9px] px-1 py-0 bg-blue-500/10 text-blue-600 border-blue-500/30"
                              >
                                Primary
                              </Badge>
                            )}
                          </div>
                          <span className="text-[10px] text-neutral-400 font-mono">
                            {server.transport} • {server.category}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                        </span>
                        <span className="text-[10px] font-mono font-medium text-emerald-600 dark:text-emerald-400">
                          Connected
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 p-2 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-[11px] font-mono text-neutral-500 truncate">
                      {server.endpointUrl}
                    </div>

                    {/* Tools Preview */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider font-semibold text-neutral-400 mb-1.5">
                        <span>Discovered Tools:</span>
                        <span className="font-mono text-neutral-500">
                          {server.tools?.length || server.toolCount || 0} tools
                        </span>
                      </div>
                      <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                        {server.tools && server.tools.length > 0 ? (
                          server.tools.map((tool, idx) => (
                            <div
                              key={idx}
                              className="px-2 py-1 rounded bg-neutral-100/70 dark:bg-neutral-800/50 text-[11px] flex items-center justify-between"
                            >
                              <span className="font-mono text-neutral-700 dark:text-neutral-300">
                                {tool.name}
                              </span>
                              {tool.isFinancial && (
                                <Badge
                                  variant="outline"
                                  className="text-[9px] px-1 py-0 bg-emerald-500/10 text-emerald-600 border-emerald-500/30 font-mono"
                                >
                                  Payment Gate
                                </Badge>
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="text-[11px] text-neutral-400 italic">
                            Discovered tools bound in runtime memory
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between text-xs">
                    <span className="text-[10px] font-mono text-neutral-400">
                      Ping: ~28ms
                    </span>
                    <Badge
                      variant="outline"
                      className="text-[10px] font-mono border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400"
                    >
                      Auth: OAuth2 / Token
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Inspect Skill Modal */}
      {inspectSkill && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50 dark:bg-neutral-950 shrink-0">
              <div className="flex items-center gap-2">
                <Code className="w-4 h-4 text-indigo-500" />
                <h3 className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                  {inspectSkill.metadata.name} (SKILL.md)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectSkill(null)}
                className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 font-mono text-xs text-neutral-800 dark:text-neutral-200 bg-neutral-900 text-neutral-100 select-text whitespace-pre-wrap leading-relaxed">
              {skillFullContent}
            </div>

            <div className="p-3 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 flex items-center justify-between shrink-0 text-xs">
              <span className="text-neutral-400 text-[11px]">
                ID: {inspectSkill.metadata.id}
              </span>
              <button
                type="button"
                onClick={() => setInspectSkill(null)}
                className="px-3 py-1.5 rounded-lg bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import SKILL.md Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50 dark:bg-neutral-950 shrink-0">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-500" />
                <h3 className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                  Import Custom Financial Skill (SKILL.md)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleImportSkill} className="flex-1 flex flex-col overflow-hidden">
              <div className="p-4 flex-1 overflow-y-auto space-y-3">
                <p className="text-xs text-neutral-500">
                  Paste any valid YAML frontmatter + markdown <code className="px-1 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 font-mono">SKILL.md</code>.
                  Rico will parse its triggers, instructions, and guardrails automatically.
                </p>

                <textarea
                  value={importMarkdown}
                  onChange={(e) => setImportMarkdown(e.target.value)}
                  placeholder={`---
id: custom-contract-renegotiator
name: Contract Renewal & Price Auditor
description: Renegotiates enterprise SaaS renewals before 60-day auto-renew windows.
category: finance
persona: founder
triggers:
  - contract renewal
  - vendor renewal
  - price increase
---

## Instructions
1. Inspect vendor contract terms.
2. Flag automatic price escalator clauses.`}
                  rows={14}
                  className="w-full p-3 font-mono text-xs rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  required
                />

                {importError && (
                  <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{importError}</span>
                  </div>
                )}
              </div>

              <div className="p-3 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-xs text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={importLoading || !importMarkdown.trim()}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium flex items-center gap-1.5 disabled:opacity-50 transition-colors shadow-xs"
                >
                  {importLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Save &amp; Ingest Skill</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Connect Custom MCP Server Modal */}
      {isAddMcpOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50 dark:bg-neutral-950">
              <div className="flex items-center gap-2">
                <Plug className="w-4 h-4 text-indigo-500" />
                <h3 className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                  Connect Custom MCP Server
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddMcpOpen(false)}
                className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddMcp} className="p-4 space-y-3.5">
              <div>
                <label className="text-[11px] font-medium text-neutral-700 dark:text-neutral-300 block mb-1">
                  Server Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Stripe Bridge MCP"
                  value={mcpForm.name}
                  onChange={(e) => setMcpForm({ ...mcpForm, name: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-neutral-700 dark:text-neutral-300 block mb-1">
                  Endpoint URL (SSE / HTTP)
                </label>
                <input
                  type="url"
                  placeholder="https://mcp.yourdomain.com/sse"
                  value={mcpForm.endpointUrl}
                  onChange={(e) => setMcpForm({ ...mcpForm, endpointUrl: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-neutral-700 dark:text-neutral-300 block mb-1">
                    Transport
                  </label>
                  <select
                    value={mcpForm.transport}
                    onChange={(e) => setMcpForm({ ...mcpForm, transport: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
                  >
                    <option value="SSE">SSE</option>
                    <option value="STDIO">STDIO</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-neutral-700 dark:text-neutral-300 block mb-1">
                    Category
                  </label>
                  <select
                    value={mcpForm.category}
                    onChange={(e) => setMcpForm({ ...mcpForm, category: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
                  >
                    <option value="finance">Finance</option>
                    <option value="devtools">DevTools</option>
                    <option value="productivity">Productivity</option>
                    <option value="communication">Communication</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddMcpOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-xs text-neutral-600 dark:text-neutral-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={mcpSubmitting}
                  className="px-4 py-1.5 rounded-lg bg-neutral-900 dark:bg-neutral-100 dark:text-neutral-900 text-white text-xs font-medium flex items-center gap-1.5"
                >
                  {mcpSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Register Server</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
