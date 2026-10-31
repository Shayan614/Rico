"use client";

import React from "react";
import {
  Columns2,
  PanelLeft,
  PanelRight,
  Sun,
  Moon,
  SlidersHorizontal,
} from "lucide-react";

interface AppHeaderProps {
  splitMode: "split" | "chat" | "dashboard";
  onSplitModeChange: (mode: "split" | "chat" | "dashboard") => void;
  strictMode: boolean;
  onToggleStrictMode: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

export function AppHeader({
  splitMode,
  onSplitModeChange,
  strictMode,
  onToggleStrictMode,
  darkMode,
  onToggleDarkMode,
}: AppHeaderProps) {
  return (
    <header className="h-12 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 flex items-center justify-between px-4 select-none shrink-0 transition-colors">
      {/* Left: Clean Minimal Title */}
      <div className="flex items-center gap-3">
        <div className="w-5 h-5 rounded bg-black dark:bg-white flex items-center justify-center text-white dark:text-black font-semibold text-xs">
          P
        </div>
        <span className="font-semibold text-xs tracking-tight text-neutral-900 dark:text-neutral-100">
          PayAgent
        </span>
      </div>

      {/* Right: Layout Switcher, Mode Toggle & Theme Toggle */}
      <div className="flex items-center gap-2">
        {/* Layout View Toggles */}
        <div className="flex items-center bg-neutral-100 dark:bg-neutral-900 p-0.5 rounded border border-neutral-200 dark:border-neutral-800">
          <button
            onClick={() => onSplitModeChange("chat")}
            className={`p-1 rounded text-xs transition-colors ${
              splitMode === "chat"
                ? "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-xs"
                : "text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
            }`}
            title="Chat Only"
          >
            <PanelLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onSplitModeChange("split")}
            className={`p-1 rounded text-xs transition-colors ${
              splitMode === "split"
                ? "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-xs"
                : "text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
            }`}
            title="Split View"
          >
            <Columns2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onSplitModeChange("dashboard")}
            className={`p-1 rounded text-xs transition-colors ${
              splitMode === "dashboard"
                ? "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-xs"
                : "text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
            }`}
            title="Dashboard Only"
          >
            <PanelRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Mode Toggle */}
        <button
          onClick={onToggleStrictMode}
          className={`h-7 px-2.5 text-xs rounded border transition-colors flex items-center gap-1.5 ${
            strictMode
              ? "border-neutral-900 dark:border-neutral-100 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 font-medium"
              : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-900"
          }`}
        >
          <SlidersHorizontal className="w-3 h-3" />
          <span>{strictMode ? "Manual Approval" : "Autonomous"}</span>
        </button>

        {/* Theme Toggle (Light / Dark) */}
        <button
          onClick={onToggleDarkMode}
          className="h-7 w-7 rounded border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-900 flex items-center justify-center transition-colors"
          title={darkMode ? "Switch to Light mode" : "Switch to Dark mode"}
        >
          {darkMode ? (
            <Sun className="w-3.5 h-3.5" />
          ) : (
            <Moon className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
    </header>
  );
}
