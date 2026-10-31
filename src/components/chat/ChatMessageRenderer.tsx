"use client";

import React, { useState } from "react";
import {
  User,
  Bot,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Loader2,
  Copy,
  Check,
  ShieldCheck,
} from "lucide-react";
import { ChatMessage } from "@/lib/chat/use-payagent-chat";
import { ReceiptData } from "@/components/dashboard/ReceiptDialog";
import { BrowserStepIndicator } from "./BrowserStepIndicator";
import { GenerativeReceiptCard } from "./GenerativeReceiptCard";

interface ChatMessageRendererProps {
  message: ChatMessage;
  onViewReceipt: (receipt: ReceiptData) => void;
  isExpandedDefault?: boolean;
}

export function ChatMessageRenderer({
  message,
  onViewReceipt,
  isExpandedDefault = false,
}: ChatMessageRendererProps) {
  const [isExpanded, setIsExpanded] = useState<boolean>(isExpandedDefault);
  const [copiedText, setCopiedText] = useState<boolean>(false);

  const handleCopyText = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(message.text);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    }
  };

  if (message.sender === "user") {
    return (
      <div className="flex justify-end items-end gap-2 group">
        <div className="space-y-1 max-w-[85%] sm:max-w-[75%]">
          <div className="rounded-2xl rounded-tr-sm bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 px-4 py-2.5 text-xs sm:text-sm shadow-sm leading-relaxed transition-colors">
            <p className="whitespace-pre-wrap">{message.text}</p>
          </div>
          <div className="text-[10px] text-neutral-400 dark:text-neutral-500 text-right px-1">
            {message.timestamp}
          </div>
        </div>
        <div className="w-6 h-6 rounded-full bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center text-neutral-700 dark:text-neutral-300 shrink-0 mb-4">
          <User className="w-3.5 h-3.5" />
        </div>
      </div>
    );
  }

  // Assistant message
  return (
    <div className="flex items-start gap-3 group">
      {/* Bot Avatar */}
      <div className="w-6 h-6 rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5 shadow-xs">
        <Bot className="w-3.5 h-3.5" />
      </div>

      <div className="flex-1 space-y-3 overflow-hidden text-xs sm:text-sm leading-relaxed">
        {/* Collapsible Execution / Thought Process */}
        {message.thoughtProcess && message.thoughtProcess.steps.length > 0 && (
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-900/60 overflow-hidden text-xs transition-colors">
            <button
              type="button"
              onClick={() => setIsExpanded((prev) => !prev)}
              className="w-full px-3.5 py-2 flex items-center justify-between text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100/60 dark:hover:bg-neutral-800/60 transition-colors"
            >
              <div className="flex items-center gap-1.5 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-neutral-600 dark:text-neutral-400" />
                <span>{message.thoughtProcess.summary}</span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-neutral-500">
                <span>{isExpanded ? "Hide details" : "Show details"}</span>
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />
                )}
              </div>
            </button>

            {isExpanded && (
              <div className="px-3.5 pb-3 pt-1 space-y-2 border-t border-neutral-200 dark:border-neutral-800 text-[11px] text-neutral-600 dark:text-neutral-400 bg-white dark:bg-neutral-900/90">
                {message.thoughtProcess.steps.map((st, i) => (
                  <div key={i} className="flex items-start gap-2">
                    {st.status === "running" ? (
                      <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin mt-0.5 shrink-0" />
                    ) : st.status === "done" ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                    ) : (
                      <div className="w-3.5 h-3.5 rounded-full border border-neutral-300 dark:border-neutral-600 mt-0.5 shrink-0" />
                    )}
                    <div className="flex-1">
                      <span className="text-neutral-900 dark:text-neutral-100 font-medium">
                        {st.step}
                      </span>
                      {st.detail && (
                        <span className="text-neutral-500 dark:text-neutral-400 block font-mono text-[10px] mt-0.5">
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

        {/* Live Multi-Phase Browser Progress Indicator Pill */}
        <BrowserStepIndicator
          statusPill={message.statusPill}
          steps={message.thoughtProcess?.steps}
          serviceName={message.receipt?.service}
        />

        {/* Text Body */}
        {message.text && (
          <div className="text-neutral-800 dark:text-neutral-200 whitespace-pre-wrap leading-relaxed">
            {message.text}
          </div>
        )}

        {/* Generative UI Payment Receipt Card */}
        {message.receipt && (
          <GenerativeReceiptCard
            receipt={message.receipt}
            onViewReceipt={onViewReceipt}
          />
        )}

        {/* Footer info: Timestamp and copy button */}
        <div className="flex items-center gap-2 text-[10px] text-neutral-400 dark:text-neutral-500 pt-0.5">
          <span>{message.timestamp}</span>
          <span>•</span>
          <button
            type="button"
            onClick={handleCopyText}
            className="hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors flex items-center gap-1"
          >
            {copiedText ? (
              <>
                <Check className="w-2.5 h-2.5 text-emerald-500" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-2.5 h-2.5" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
