"use client";

import React, { useRef, useEffect } from "react";
import {
  ArrowUp,
  RotateCcw,
  Square,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { ReceiptData } from "@/components/dashboard/ReceiptDialog";
import { ChatMessage } from "@/lib/chat/use-payagent-chat";
import { ChatMessageRenderer } from "./ChatMessageRenderer";

export type { ExecutionStep, ThoughtProcess, StatusPill, ChatMessage } from "@/lib/chat/use-payagent-chat";

interface ClaudeChatProps {
  messages: ChatMessage[];
  input?: string;
  onInputChange?: (value: string) => void;
  onSendMessage: (text: string) => void;
  onClearChat: () => void;
  onViewReceipt: (receipt: ReceiptData) => void;
  strictMode: boolean;
  onToggleStrictMode: () => void;
  isLoading?: boolean;
  onStop?: () => void;
  onReload?: () => void;
}

export function ClaudeChat({
  messages,
  input = "",
  onInputChange,
  onSendMessage,
  onClearChat,
  onViewReceipt,
  strictMode,
  onToggleStrictMode,
  isLoading = false,
  onStop,
}: ClaudeChatProps) {
  const [internalInput, setInternalInput] = React.useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Synchronize internal vs external input
  const currentInput = onInputChange ? input : internalInput;
  const setInput = (val: string) => {
    if (onInputChange) {
      onInputChange(val);
    } else {
      setInternalInput(val);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const sampleSuggestions = [
    "Pay Netflix $15.99 on 5th, max $20",
    "Spotify Premium $11.99 monthly cap $15",
    "Verify AWS cloud bill cap at $120",
  ];

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentInput.trim() || isLoading) return;
    onSendMessage(currentInput);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 transition-colors">
      {/* Top Bar */}
      <div className="h-11 px-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-xs select-none shrink-0 bg-neutral-50/50 dark:bg-neutral-900/40">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <Sparkles className="w-3 h-3" />
          </div>
          <span className="font-semibold text-neutral-800 dark:text-neutral-200">
            Agentic Conversation
          </span>
          <span className="hidden sm:inline-block text-[11px] text-neutral-400 dark:text-neutral-500">
            • Gemini 3.8 Flash + Playwright CDP
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClearChat}
            className="flex items-center gap-1 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 px-2 py-1 rounded transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
            title="Clear Conversation"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Message Stream */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {messages.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-10 h-10 mx-auto rounded-xl bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center text-neutral-700 dark:text-neutral-300">
                <Sparkles className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-sm text-neutral-900 dark:text-neutral-100">
                What financial mandate should Rico handle?
              </h3>
              <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                Issue a natural language mandate like &quot;Pay Netflix $15.99 on 5th, max $20&quot;. Rico will autonomously verify pricing, check guardrails, and execute via PayPal Sandbox.
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <ChatMessageRenderer
                key={msg.id}
                message={msg}
                onViewReceipt={onViewReceipt}
                isExpandedDefault={msg.id === "msg-demo-sample"}
              />
            ))
          )}

          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-neutral-500 py-1 pl-9 animate-pulse">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
              <span>Rico reasoning & verifying live merchant data...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Floating Bottom Input Area */}
      <div className="p-3 md:p-4 bg-white/95 dark:bg-neutral-950/95 border-t border-neutral-100 dark:border-neutral-900 shrink-0 backdrop-blur-xs">
        <div className="max-w-2xl mx-auto space-y-2">
          {/* Quick Suggestions */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs py-0.5">
            <span className="text-[10px] text-neutral-400 dark:text-neutral-500 shrink-0 uppercase tracking-wider font-semibold">
              Try:
            </span>
            {sampleSuggestions.map((prompt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onSendMessage(prompt)}
                className="whitespace-nowrap px-3 py-1 rounded-full bg-neutral-100 dark:bg-neutral-900 hover:bg-neutral-200 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 text-[11px] text-neutral-700 dark:text-neutral-300 transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Rounded Input Container */}
          <div className="rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-neutral-900 focus-within:border-neutral-900 dark:focus-within:border-neutral-100 transition-colors p-2 px-3 shadow-xs">
            <textarea
              value={currentInput}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Rico to set or execute a mandate..."
              rows={1}
              className="w-full bg-transparent resize-none outline-none text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 text-xs sm:text-sm min-h-[38px] max-h-[140px] py-1"
            />

            <div className="flex items-center justify-between pt-1.5 border-t border-neutral-100 dark:border-neutral-800/60">
              <div className="flex items-center gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={onToggleStrictMode}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-medium border transition-colors flex items-center gap-1.5 ${
                    strictMode
                      ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                      : "border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-800/80 text-neutral-700 dark:text-neutral-300"
                  }`}
                  title={
                    strictMode
                      ? "Strict mode: Manual user approval required before any PayPal charge"
                      : "Autonomous mode: Auto-executes within authorized budget ceiling"
                  }
                >
                  {strictMode ? (
                    <ShieldAlert className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                  ) : (
                    <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  )}
                  <span>{strictMode ? "Manual Approval" : "Autonomous"}</span>
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                {isLoading ? (
                  <button
                    type="button"
                    onClick={onStop}
                    className="w-7 h-7 rounded-full flex items-center justify-center bg-red-600 hover:bg-red-700 text-white shadow-xs transition-colors"
                    title="Stop generation"
                  >
                    <Square className="w-3 h-3 fill-current" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSubmit()}
                    disabled={!currentInput.trim()}
                    className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                      currentInput.trim()
                        ? "bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 shadow hover:opacity-90"
                        : "bg-neutral-100 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed"
                    }`}
                    title="Send Mandate (Enter)"
                  >
                    <ArrowUp className="w-3.5 h-3.5 stroke-[2.5]" />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] text-neutral-400 dark:text-neutral-500 px-1">
            <span>Press Enter to send, Shift + Enter for new line</span>
            <span>PayPal Sandbox MCP Connected</span>
          </div>
        </div>
      </div>
    </div>
  );
}
