"use client";

import React from "react";
import {
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Lock,
  Sparkles,
  UserCheck,
  Search,
  PanelRight,
} from "lucide-react";

interface ZephiumAddressBarProps {
  url: string;
  onRefresh?: () => void;
  isCalmActive: boolean;
  onToggleCalm: () => void;
  onManualTakeover: () => void;
  isStreamingLive: boolean;
  onOpenCommand: () => void;
  isAskOpen: boolean;
  onToggleAsk: () => void;
}

export function ZephiumAddressBar({
  url,
  onRefresh,
  isCalmActive,
  onToggleCalm,
  onManualTakeover,
  isStreamingLive,
  onOpenCommand,
  isAskOpen,
  onToggleAsk,
}: ZephiumAddressBarProps) {
  return (
    <div className="h-11 px-3 border-b border-neutral-800 bg-neutral-900/90 backdrop-blur-md flex items-center justify-between gap-2.5 text-xs select-none shrink-0 z-20">
      {/* 1. Browser Nav Controls */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors disabled:opacity-30"
          title="Back"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          className="p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors disabled:opacity-30"
          title="Forward"
        >
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={onRefresh}
          className="p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors active:rotate-180"
          title="Reload Page"
        >
          <RotateCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 2. Unified Zephium Omnibar / Address Pill */}
      <div className="flex-1 max-w-2xl flex items-center gap-2 px-3 py-1 bg-neutral-950 border border-neutral-800 rounded-full text-neutral-300 focus-within:border-blue-500/60 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all shadow-inner">
        <Lock className="w-3 h-3 text-emerald-400 shrink-0" />
        <span className="text-[10px] text-emerald-400 font-mono shrink-0 hidden sm:inline">
          TLS 1.3
        </span>
        <span className="w-1 h-1 rounded-full bg-neutral-700 shrink-0 hidden sm:inline" />
        <input
          type="text"
          value={url}
          readOnly
          className="flex-1 bg-transparent text-[11px] font-mono text-neutral-200 outline-none truncate"
        />
        {isStreamingLive && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-950/80 border border-red-500/30 text-red-400 font-mono text-[9px] font-bold shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            30 FPS CDP
          </span>
        )}
      </div>

      {/* 3. Zephium Superpower Action Buttons & Tools */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Calm Pricing Lens (Zephium Restyler) */}
        <button
          type="button"
          onClick={onToggleCalm}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
            isCalmActive
              ? "bg-purple-600 text-white shadow-xs font-semibold"
              : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700 hover:text-white"
          }`}
          title="Zephium Calm Lens: Strip marketing fluff and show clean comparison cards"
        >
          <Sparkles className="w-3 h-3 text-purple-300" />
          <span>Calm Lens</span>
        </button>

        {/* Human Takeover (CAPTCHA/2FA) */}
        <button
          type="button"
          onClick={onManualTakeover}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-neutral-800 text-neutral-300 hover:bg-neutral-700 hover:text-white transition-colors"
          title="Manual Takeover Mode (Solve CAPTCHA/2FA)"
        >
          <UserCheck className="w-3 h-3 text-amber-400" />
          <span className="hidden sm:inline">Takeover</span>
        </button>

        {/* Quick Command Launcher ⌘K */}
        <button
          type="button"
          onClick={onOpenCommand}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] bg-neutral-950 border border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700 transition-colors"
          title="Global Command Palette (⌘K)"
        >
          <Search className="w-3 h-3" />
          <kbd className="text-[9px] font-mono text-neutral-500">⌘K</kbd>
        </button>

        {/* Ask Zephium Toggle */}
        <button
          type="button"
          onClick={onToggleAsk}
          className={`p-1.5 rounded-md transition-colors ${
            isAskOpen
              ? "bg-blue-600 text-white"
              : "bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700"
          }`}
          title="Toggle Ask Zephium / Assistant Sidebar (⌘E)"
        >
          <PanelRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
