"use client";

import React, { useState } from "react";
import {
  User,
  Bot,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Loader2,
  Globe,
  Receipt,
  Copy,
  Check,
  FileText,
  ShieldCheck,
} from "lucide-react";
import { ChatMessage } from "@/lib/chat/use-payagent-chat";
import { ReceiptData } from "@/components/dashboard/ReceiptDialog";
import { Badge } from "@/components/ui/badge";

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
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
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

        {/* Live Browser Status Pill */}
        {message.statusPill && (
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-[11px] text-blue-700 dark:text-blue-300 animate-in fade-in duration-200">
            <Globe className="w-3 h-3 text-blue-500 animate-pulse" />
            <span className="font-medium">{message.statusPill.step}</span>
          </div>
        )}

        {/* Text Body */}
        {message.text && (
          <div className="text-neutral-800 dark:text-neutral-200 whitespace-pre-wrap leading-relaxed">
            {message.text}
          </div>
        )}

        {/* Generative UI Payment Receipt Card */}
        {message.receipt && (
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/80 p-4 text-xs space-y-3 shadow-xs">
            <div className="flex items-center justify-between pb-2.5 border-b border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100 block">
                    Digital Payment Receipt
                  </span>
                  <span className="text-[10px] font-mono text-neutral-500">
                    {message.receipt.orderId}
                  </span>
                </div>
              </div>
              <Badge
                variant="outline"
                className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 text-[10px] font-medium"
              >
                Captured & Verified
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-[11px]">
              <div>
                <span className="text-neutral-500 block">Service:</span>
                <span className="font-medium text-neutral-900 dark:text-neutral-100">
                  {message.receipt.service}
                </span>
              </div>
              <div>
                <span className="text-neutral-500 block">Plan:</span>
                <span className="text-neutral-700 dark:text-neutral-300">
                  {message.receipt.planName}
                </span>
              </div>
              <div>
                <span className="text-neutral-500 block">Verified Price:</span>
                <span className="font-bold text-neutral-900 dark:text-neutral-100 text-sm">
                  ${message.receipt.verifiedPrice.toFixed(2)}{" "}
                  {message.receipt.currency}
                </span>
              </div>
              <div>
                <span className="text-neutral-500 block">Ceiling Limit:</span>
                <span className="text-neutral-700 dark:text-neutral-300">
                  ${message.receipt.budgetCeiling.toFixed(2)}{" "}
                  {message.receipt.currency}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2.5 border-t border-neutral-200 dark:border-neutral-800 text-[11px]">
              <button
                type="button"
                onClick={() => handleCopy(message.receipt!.orderId, message.id)}
                className="text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 flex items-center gap-1 transition-colors"
                title="Copy PayPal Order ID"
              >
                {copiedId === message.id ? (
                  <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
                <span>
                  {copiedId === message.id ? "Copied ID" : "Copy Order ID"}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onViewReceipt(message.receipt!)}
                className="px-2.5 py-1 rounded bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 text-[11px] font-medium flex items-center gap-1.5 hover:opacity-90 transition-opacity"
              >
                <FileText className="w-3 h-3" />
                <span>View Full Details</span>
              </button>
            </div>
          </div>
        )}

        {/* Footer info: Timestamp and copy button */}
        <div className="flex items-center gap-2 text-[10px] text-neutral-400 dark:text-neutral-500 pt-0.5">
          <span>{message.timestamp}</span>
          <span>•</span>
          <button
            type="button"
            onClick={() => handleCopy(message.text, `${message.id}-text`)}
            className="hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors flex items-center gap-1"
          >
            {copiedId === `${message.id}-text` ? (
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
