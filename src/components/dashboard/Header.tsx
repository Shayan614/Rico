"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import {
  Bot,
  Zap,
  ExternalLink,
  Radio,
  SlidersHorizontal,
} from "lucide-react";

interface HeaderProps {
  strictMode: boolean;
  onToggleStrictMode: () => void;
}

export function Header({ strictMode, onToggleStrictMode }: HeaderProps) {
  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-40 px-4 lg:px-6 py-3">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left: Branding & Tagline */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-cyan-500 shadow-lg shadow-blue-500/20 text-white font-bold">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
                Rico
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">
                  PayPal AI 2026
                </span>
              </h1>
            </div>
            <p className="text-xs text-slate-400">
              Autonomous Financial Mandates & Agentic Commerce Engine
            </p>
          </div>
        </div>

        {/* Center: Live Connectivity Status */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-950/60 border border-emerald-800/40 text-emerald-300 text-xs font-medium">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-semibold">PayPal MCP:</span>
            <span className="text-emerald-400">Sandbox Ready</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-950/60 border border-blue-800/40 text-blue-300 text-xs font-medium">
            <Zap className="w-3.5 h-3.5 text-blue-400" />
            <span>Gemini 3.8 Flash</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-950/60 border border-purple-800/40 text-purple-300 text-xs font-medium">
            <Radio className="w-3.5 h-3.5 text-purple-400" />
            <span>Playwright CDP</span>
          </div>
        </div>

        {/* Right: Mode Switcher & External Links */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleStrictMode}
            className={`border transition-all text-xs flex items-center gap-1.5 ${
              strictMode
                ? "border-amber-500/50 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                : "border-blue-500/50 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20"
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>
              Mode:{" "}
              <strong>{strictMode ? "Strict Approval" : "Autonomous"}</strong>
            </span>
          </Button>

          <a
            href="https://miro.com/app/board/uXjVETEzN_g=/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button
              variant="outline"
              size="sm"
              className="border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5 text-yellow-400" />
              <span className="hidden sm:inline">Miro Board</span>
            </Button>
          </a>

          <a
            href="https://github.com/abrarnasirjaffari/Rico"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button
              variant="outline"
              size="sm"
              className="border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs flex items-center gap-1.5"
            >
              <svg
                className="w-3.5 h-3.5 fill-current"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                />
              </svg>
              <span className="hidden sm:inline">GitHub</span>
            </Button>
          </a>
        </div>
      </div>
    </header>
  );
}
