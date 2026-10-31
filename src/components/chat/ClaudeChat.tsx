"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  ArrowUp,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  SlidersHorizontal,
  Copy,
  Check,
  CheckCircle2,
  FileText,
} from "lucide-react";
import { ReceiptData } from "@/components/dashboard/ReceiptDialog";

export interface ExecutionStep {
  step: string;
  status: "done" | "running" | "waiting";
  detail?: string;
}

export interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: string;
  thoughtProcess?: {
    summary: string;
    steps: ExecutionStep[];
  };
  receipt?: ReceiptData;
}

interface ClaudeChatProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onClearChat: () => void;
  onViewReceipt: (receipt: ReceiptData) => void;
  strictMode: boolean;
  onToggleStrictMode: () => void;
}

export function ClaudeChat({
  messages,
  onSendMessage,
  onClearChat,
  onViewReceipt,
  strictMode,
  onToggleStrictMode,
}: ClaudeChatProps) {
  const [inputText, setInputText] = useState("");
  const [expandedThoughts, setExpandedThoughts] = useState<Record<string, boolean>>({
    "msg-demo-sample": true,
  });
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const toggleThought = (id: string) => {
    setExpandedThoughts((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const sampleSuggestions = [
    "Pay Netflix $15.99 on 5th, max $20",
    "Spotify Premium $11.99 monthly cap $15",
    "Verify AWS cloud bill cap at $120",
  ];

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText);
    setInputText("");
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
      <div className="h-10 px-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-xs select-none shrink-0">
        <span className="font-medium text-neutral-500 dark:text-neutral-400">
          Agent Conversation
        </span>

        <button
          onClick={onClearChat}
          className="flex items-center gap-1 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 px-2 py-1 rounded transition-colors"
          title="Clear Conversation"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Clear</span>
        </button>
      </div>

      {/* Message Stream */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {messages.map((msg) => (
            <div key={msg.id} className="space-y-3">
              {msg.sender === "user" ? (
                /* User Message (Right-aligned bubble) */
                <div className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 px-4 py-2.5 text-xs sm:text-sm text-neutral-900 dark:text-neutral-100 shadow-xs leading-relaxed">
                    {msg.text}
                  </div>
                </div>
              ) : (
                /* Assistant Message */
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                    A
                  </div>

                  <div className="flex-1 space-y-3 overflow-hidden text-xs sm:text-sm leading-relaxed">
                    {/* Collapsible Execution / Thought Process */}
                    {msg.thoughtProcess && (
                      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/60 overflow-hidden text-xs">
                        <button
                          onClick={() => toggleThought(msg.id)}
                          className="w-full px-3.5 py-2 flex items-center justify-between text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100/50 dark:hover:bg-neutral-800/50 transition-colors"
                        >
                          <span className="font-medium">
                            {msg.thoughtProcess.summary}
                          </span>
                          {expandedThoughts[msg.id] ? (
                            <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />
                          )}
                        </button>

                        {expandedThoughts[msg.id] && (
                          <div className="px-3.5 pb-3 pt-1 space-y-2 border-t border-neutral-200 dark:border-neutral-800 text-[11px] text-neutral-600 dark:text-neutral-400 bg-white dark:bg-neutral-900">
                            {msg.thoughtProcess.steps.map((st, i) => (
                              <div key={i} className="flex items-start gap-2">
                                <CheckCircle2 className="w-3.5 h-3.5 text-neutral-900 dark:text-neutral-100 mt-0.5 shrink-0" />
                                <div className="flex-1">
                                  <span className="text-neutral-900 dark:text-neutral-100 font-medium">
                                    {st.step}
                                  </span>
                                  {st.detail && (
                                    <span className="text-neutral-500 dark:text-neutral-400 block font-mono text-[10px]">
                                      {st.detail}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Text Body */}
                    <div className="text-neutral-800 dark:text-neutral-200 whitespace-pre-wrap leading-relaxed">
                      {msg.text}
                    </div>

                    {/* Minimalist Digital Receipt */}
                    {msg.receipt && (
                      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 p-4 text-xs space-y-3">
                        <div className="flex items-center justify-between pb-2.5 border-b border-neutral-200 dark:border-neutral-800">
                          <div>
                            <span className="font-semibold text-neutral-900 dark:text-neutral-100 block">
                              Digital Receipt
                            </span>
                            <span className="text-[10px] font-mono text-neutral-500">
                              {msg.receipt.orderId}
                            </span>
                          </div>
                          <span className="px-2 py-0.5 rounded border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 text-[10px] font-medium text-neutral-800 dark:text-neutral-200">
                            Captured
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div>
                            <span className="text-neutral-500 block">Service:</span>
                            <span className="font-medium text-neutral-900 dark:text-neutral-100">
                              {msg.receipt.service}
                            </span>
                          </div>
                          <div>
                            <span className="text-neutral-500 block">Plan:</span>
                            <span className="text-neutral-700 dark:text-neutral-300">
                              {msg.receipt.planName}
                            </span>
                          </div>
                          <div>
                            <span className="text-neutral-500 block">Verified Price:</span>
                            <span className="font-bold text-neutral-900 dark:text-neutral-100 text-sm">
                              ${msg.receipt.verifiedPrice.toFixed(2)}{" "}
                              {msg.receipt.currency}
                            </span>
                          </div>
                          <div>
                            <span className="text-neutral-500 block">Ceiling Limit:</span>
                            <span className="text-neutral-700 dark:text-neutral-300">
                              ${msg.receipt.budgetCeiling.toFixed(2)}{" "}
                              {msg.receipt.currency}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-neutral-200 dark:border-neutral-800 text-[11px]">
                          <button
                            onClick={() =>
                              handleCopy(msg.receipt!.orderId, msg.id)
                            }
                            className="text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 flex items-center gap-1 transition-colors"
                          >
                            {copiedId === msg.id ? (
                              <Check className="w-3 h-3 text-neutral-900 dark:text-neutral-100" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                            <span>
                              {copiedId === msg.id ? "Copied" : "Copy ID"}
                            </span>
                          </button>

                          <button
                            onClick={() => onViewReceipt(msg.receipt!)}
                            className="px-2.5 py-1 rounded bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 text-[11px] font-medium flex items-center gap-1 hover:opacity-90 transition-opacity"
                          >
                            <FileText className="w-3 h-3" />
                            <span>View Details</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Floating Bottom Input */}
      <div className="p-3 md:p-4 bg-white/90 dark:bg-neutral-950/90 border-t border-neutral-100 dark:border-neutral-900 shrink-0">
        <div className="max-w-2xl mx-auto space-y-2">
          {/* Quick Suggestions */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs py-0.5">
            {sampleSuggestions.map((prompt, idx) => (
              <button
                key={idx}
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
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask PayAgent to set or execute a mandate..."
              rows={1}
              className="w-full bg-transparent resize-none outline-none text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 text-xs sm:text-sm min-h-[36px] max-h-[140px] py-1"
            />

            <div className="flex items-center justify-between pt-1.5 border-t border-neutral-100 dark:border-neutral-800/60">
              <div className="flex items-center gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={onToggleStrictMode}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors flex items-center gap-1 ${
                    strictMode
                      ? "border-neutral-900 dark:border-neutral-100 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900"
                      : "border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
                  }`}
                >
                  <SlidersHorizontal className="w-2.5 h-2.5" />
                  <span>{strictMode ? "Manual Approval" : "Autonomous"}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => handleSubmit()}
                disabled={!inputText.trim()}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                  inputText.trim()
                    ? "bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 shadow hover:opacity-90"
                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed"
                }`}
                title="Send"
              >
                <ArrowUp className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
