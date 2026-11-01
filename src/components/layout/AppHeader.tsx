"use client";

import React, { useEffect, useState } from "react";
import {
  Columns2,
  PanelLeft,
  PanelRight,
  Sun,
  Moon,
  Layers,
  ShieldCheck,
  ShieldAlert,
  Search,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Badge } from "@/components/ui/badge";

interface AppHeaderProps {
  splitMode: "split" | "chat" | "dashboard";
  onSplitModeChange: (mode: "split" | "chat" | "dashboard") => void;
  strictMode: boolean;
  onToggleStrictMode: () => void;
  darkMode?: boolean;
  onToggleDarkMode?: () => void;
  mandatesCount?: number;
  onOpenMobileDrawer?: () => void;
  onOpenCommandPalette?: () => void;
}

export function AppHeader({
  splitMode,
  onSplitModeChange,
  strictMode,
  onToggleStrictMode,
  darkMode,
  onToggleDarkMode,
  mandatesCount = 3,
  onOpenMobileDrawer,
  onOpenCommandPalette,
}: AppHeaderProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted
    ? resolvedTheme === "dark" || theme === "dark"
    : Boolean(darkMode);

  const handleToggleTheme = () => {
    if (onToggleDarkMode) {
      onToggleDarkMode();
    }
    const nextTheme = isDark ? "light" : "dark";
    setTheme(nextTheme);
  };

  return (
    <header className="h-12 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 flex items-center justify-between px-3 md:px-4 select-none shrink-0 transition-colors z-30">
      {/* Left: Brand & Status */}
      <div className="flex items-center gap-3">
        <div className="w-6 h-6 rounded-md bg-neutral-900 dark:bg-white flex items-center justify-center text-white dark:text-neutral-950 font-bold text-xs shadow-xs">
          R
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-xs tracking-tight text-neutral-900 dark:text-neutral-100">
              Rico
            </span>
            <Badge
              variant="outline"
              className="hidden sm:inline-flex text-[9px] py-0 px-1.5 border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-mono"
            >
              PayPal MCP Sandbox
            </Badge>
          </div>
        </div>
      </div>

      {/* Right: Actions, Layout Switcher & Theme Toggle */}
      <div className="flex items-center gap-1.5 md:gap-2">
        {/* Mobile Drawer Trigger (Mobile Only) */}
        {onOpenMobileDrawer && (
          <button
            type="button"
            onClick={onOpenMobileDrawer}
            className="md:hidden flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 font-medium active:scale-95 transition-transform"
            title="Open Financial Command Center Drawer"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Dashboard</span>
            <span className="px-1.5 py-0.2 rounded-full bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 text-[10px] font-bold">
              {mandatesCount}
            </span>
          </button>
        )}

        {/* Quick Command Launcher (Ctrl+K / ⌘K) Trigger */}
        {onOpenCommandPalette && (
          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="flex items-center gap-2 h-7 px-2.5 rounded-md border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors text-xs"
            title="Open Quick Command Launcher (Ctrl+K / ⌘K)"
          >
            <Search className="w-3.5 h-3.5 text-neutral-500" />
            <span className="hidden sm:inline font-medium">Command</span>
            <kbd className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-neutral-200 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-[10px] font-mono text-neutral-500 dark:text-neutral-400">
              <span>⌘K</span>
            </kbd>
          </button>
        )}

        {/* Desktop Layout View Toggles */}
        <div className="hidden md:flex items-center bg-neutral-100 dark:bg-neutral-900 p-0.5 rounded border border-neutral-200 dark:border-neutral-800">
          <button
            type="button"
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
            type="button"
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
            type="button"
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

        {/* Mode Toggle (Autonomous vs Strict Manual Approval) */}
        <button
          type="button"
          onClick={onToggleStrictMode}
          className={`h-7 px-2.5 text-xs rounded border transition-colors flex items-center gap-1.5 ${
            strictMode
              ? "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300 font-medium"
              : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          }`}
          title={
            strictMode
              ? "Strict Approval Mode: User review required before payments"
              : "Autonomous Mode: Auto-executes within authorized ceiling"
          }
        >
          {strictMode ? (
            <ShieldAlert className="w-3 h-3 text-amber-600 dark:text-amber-400" />
          ) : (
            <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
          )}
          <span className="hidden sm:inline">
            {strictMode ? "Manual Approval" : "Autonomous"}
          </span>
        </button>

        {/* Dark/Light Theme Toggle */}
        <button
          type="button"
          onClick={handleToggleTheme}
          className="h-7 w-7 rounded border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-center transition-colors"
          title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          aria-label="Toggle theme"
        >
          {isDark ? (
            <Sun className="w-3.5 h-3.5 text-amber-400" />
          ) : (
            <Moon className="w-3.5 h-3.5 text-neutral-600" />
          )}
        </button>
      </div>
    </header>
  );
}
