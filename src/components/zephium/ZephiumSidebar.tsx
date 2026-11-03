"use client";

import React from "react";
import {
  Globe,
  Sparkles,
  CheckSquare,
  Clock,
  FileText,
  Plus,
  X,
  Bot,
  Layers,
} from "lucide-react";

export interface ZephiumTab {
  id: string;
  title: string;
  url: string;
  favicon?: string;
  active: boolean;
  isStreaming?: boolean;
  category?: string;
}

interface ZephiumSidebarProps {
  mode: "browse" | "work";
  onModeChange: (mode: "browse" | "work") => void;
  tabs: ZephiumTab[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onNewTab: () => void;
  strictMode: boolean;
  onToggleStrictMode: () => void;
  isAskOpen: boolean;
  onToggleAsk: () => void;
  onOpenTasks: () => void;
  onOpenTime: () => void;
  onOpenNotes: () => void;
  activeTasksCount: number;
}

export function ZephiumSidebar({
  mode,
  onModeChange,
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onNewTab,
  strictMode,
  onToggleStrictMode,
  isAskOpen,
  onToggleAsk,
  onOpenTasks,
  onOpenTime,
  onOpenNotes,
  activeTasksCount,
}: ZephiumSidebarProps) {
  return (
    <aside className="w-64 h-full flex flex-col bg-neutral-900 text-neutral-200 border-r border-neutral-800 select-none shrink-0 text-xs">
      {/* 1. Desktop Window Header / Traffic Lights */}
      <div className="h-10 px-3.5 flex items-center justify-between border-b border-neutral-800/80 bg-neutral-950/60">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56] border border-[#e0443e]" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e] border border-[#dea123]" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f] border border-[#1aab29]" />
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-neutral-400">
          <span className="text-white font-mono font-bold">ZEPHIUM</span>
          <span className="text-[9px] px-1 py-0.2 rounded bg-neutral-800 text-neutral-400 font-mono">
            RICO
          </span>
        </div>
        <div className="w-6" /> {/* spacer for balance */}
      </div>

      {/* 2. Mode Switcher: Browse vs Work (Zephium Core Innovation) */}
      <div className="p-2.5 border-b border-neutral-800/80">
        <div className="grid grid-cols-2 p-0.5 bg-neutral-950 rounded-lg border border-neutral-800 text-[11px]">
          <button
            type="button"
            onClick={() => onModeChange("browse")}
            className={`flex items-center justify-center gap-1.5 py-1.5 rounded-md font-medium transition-all ${
              mode === "browse"
                ? "bg-neutral-800 text-white shadow-xs font-semibold"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <Globe className="w-3.5 h-3.5 text-blue-400" />
            <span>Browse</span>
          </button>
          <button
            type="button"
            onClick={() => onModeChange("work")}
            className={`flex items-center justify-center gap-1.5 py-1.5 rounded-md font-medium transition-all ${
              mode === "work"
                ? "bg-gradient-to-r from-teal-900/80 to-emerald-900/80 text-teal-200 shadow-xs border border-teal-500/30 font-semibold"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Work</span>
          </button>
        </div>
      </div>

      {/* 3. Spaces Switcher */}
      <div className="px-3 pt-2.5 pb-1 flex items-center justify-between text-[10px] font-medium text-neutral-400 uppercase tracking-wider">
        <span className="flex items-center gap-1.5">
          <Layers className="w-3 h-3 text-neutral-500" />
          <span>Space: Commerce & Agents</span>
        </span>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" />
      </div>

      {/* 4. Vertical Tabs List */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
        <div className="px-1.5 py-1 flex items-center justify-between text-[10px] text-neutral-500 font-medium">
          <span>ACTIVE SITES ({tabs.length})</span>
          <button
            type="button"
            onClick={onNewTab}
            className="p-0.5 hover:text-neutral-200 rounded hover:bg-neutral-800 transition-colors"
            title="Open New Tab"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>

        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`group flex items-center justify-between px-2.5 py-1.5 rounded-md cursor-pointer transition-all ${
                isActive
                  ? "bg-neutral-800 text-white font-medium border border-neutral-700/80"
                  : "text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200"
              }`}
            >
              <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                {tab.isStreaming ? (
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                  </span>
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-neutral-600 shrink-0" />
                )}
                <span className="truncate text-[11px]">{tab.title}</span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab(tab.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-neutral-700 text-neutral-400 hover:text-white transition-opacity ml-1"
                title="Close Tab"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>

      {/* 5. Built-in Apps & Assistant Drawer Launcher */}
      <div className="p-2 border-t border-neutral-800/80 space-y-1 bg-neutral-950/40">
        <button
          type="button"
          onClick={onToggleAsk}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md transition-colors ${
            isAskOpen
              ? "bg-blue-600/20 text-blue-300 border border-blue-500/30"
              : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
          }`}
        >
          <span className="flex items-center gap-2">
            <Bot className="w-3.5 h-3.5 text-blue-400" />
            <span className="font-medium text-[11px]">Ask Zephium / Rico</span>
          </span>
          <kbd className="px-1.5 py-0.2 text-[9px] rounded bg-neutral-800 text-neutral-400 font-mono">
            ⌘E
          </kbd>
        </button>

        <button
          type="button"
          onClick={onOpenTasks}
          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200 transition-colors"
        >
          <span className="flex items-center gap-2">
            <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-medium text-[11px]">Tasks (Mandates)</span>
          </span>
          <span className="px-1.5 py-0.2 rounded-full bg-neutral-800 text-neutral-300 text-[10px] font-bold">
            {activeTasksCount}
          </span>
        </button>

        <button
          type="button"
          onClick={onOpenTime}
          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200 transition-colors"
        >
          <span className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-medium text-[11px]">Time & Focus</span>
          </span>
          <span className="text-[10px] text-neutral-500 font-mono">1.18s avg</span>
        </button>

        <button
          type="button"
          onClick={onOpenNotes}
          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200 transition-colors"
        >
          <span className="flex items-center gap-2">
            <FileText className="w-3.5 h-3.5 text-purple-400" />
            <span className="font-medium text-[11px]">Notes & Audit Logs</span>
          </span>
          <span className="text-[10px] text-neutral-500 font-mono">MD</span>
        </button>
      </div>

      {/* 6. Footer: Model & PayPal MCP Sandbox Status */}
      <div className="p-2.5 border-t border-neutral-800 bg-neutral-950 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="w-5 h-5 rounded bg-blue-600 flex items-center justify-center font-bold text-[10px] text-white">
              P
            </div>
            <div className="truncate">
              <div className="text-[11px] font-semibold text-neutral-200 truncate">
                PayPal MCP Live
              </div>
              <div className="text-[9px] text-emerald-400 font-mono">
                SSE Connected
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onToggleStrictMode}
            className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border transition-colors ${
              strictMode
                ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
            }`}
            title="Toggle Strict Approval vs Autonomous Mode"
          >
            {strictMode ? "STRICT" : "AUTO"}
          </button>
        </div>
      </div>
    </aside>
  );
}
