"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Send,
  Sparkles,
  Bot,
  User,
  ShieldCheck,
  Globe,
  Receipt,
  CheckCircle2,
  Trash2,
  ArrowRight,
} from "lucide-react";
import { ReceiptData } from "./ReceiptDialog";
import type { SavingsAdvisoryData } from "@/lib/savings/types";
import { SavingsAdvisoryCard } from "./SavingsAdvisoryCard";

export interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: string;
  statusPill?: {
    step: string;
    state: "loading" | "success" | "warning";
  };
  receipt?: ReceiptData;
  savingsAdvisory?: SavingsAdvisoryData;
}

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onClearChat: () => void;
  onViewReceipt: (receipt: ReceiptData) => void;
  onRequestApproval?: (service: string, price: number, ceiling: number) => void;
  strictMode: boolean;
}

export function ChatPanel({
  messages,
  onSendMessage,
  onClearChat,
  onViewReceipt,
  strictMode,
}: ChatPanelProps) {
  const [inputText, setInputText] = useState("");

  const samplePrompts = [
    "Pay Netflix $15.99 on the 5th, max $20",
    "Spotify Premium $11.99 monthly cap $15",
    "Verify AWS cloud bill cap at $120",
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText);
    setInputText("");
  };

  return (
    <Card className="h-full flex flex-col border-slate-800 bg-slate-900/60 backdrop-blur shadow-xl rounded-xl overflow-hidden">
      {/* Panel Header */}
      <CardHeader className="py-3 px-4 border-b border-slate-800 bg-slate-950/50 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold text-white">
              Agentic Financial Chat
            </CardTitle>
            <p className="text-[11px] text-slate-400">
              Gemini 3.8 Flash • Playwright Browser Engine
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="text-[10px] px-2 py-0.5 border-slate-700 bg-slate-800/60 text-slate-300"
          >
            {strictMode ? "Strict Safety" : "Autonomous Mode"}
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClearChat}
            className="h-7 w-7 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            title="Reset Chat"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </CardHeader>

      {/* Suggested Quick Prompts */}
      <div className="px-4 py-2 border-b border-slate-800/60 bg-slate-950/20 flex items-center gap-1.5 overflow-x-auto text-xs no-scrollbar">
        <span className="text-[11px] text-slate-500 shrink-0 font-medium">
          Quick Prompts:
        </span>
        {samplePrompts.map((prompt, idx) => (
          <button
            key={idx}
            onClick={() => onSendMessage(prompt)}
            className="whitespace-nowrap px-2.5 py-1 rounded-full bg-slate-800/80 hover:bg-blue-600/20 hover:border-blue-500/40 border border-slate-700/60 text-[11px] text-slate-300 transition-all flex items-center gap-1"
          >
            <span>{prompt}</span>
            <ArrowRight className="w-2.5 h-2.5 opacity-60" />
          </button>
        ))}
      </div>

      {/* Messages Feed */}
      <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${
              msg.sender === "user" ? "items-end" : "items-start"
            }`}
          >
            <div
              className={`flex items-start gap-2.5 max-w-[92%] sm:max-w-[85%] ${
                msg.sender === "user" ? "flex-row-reverse" : "flex-row"
              }`}
            >
              {/* Avatar */}
              <div
                className={`w-7 h-7 rounded-lg shrink-0 flex items-center justify-center text-xs font-semibold ${
                  msg.sender === "user"
                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                    : "bg-slate-800 border border-slate-700 text-blue-400"
                }`}
              >
                {msg.sender === "user" ? (
                  <User className="w-4 h-4" />
                ) : (
                  <Bot className="w-4 h-4" />
                )}
              </div>

              {/* Message Bubble */}
              <div className="space-y-2">
                <div
                  className={`rounded-xl p-3 text-xs leading-relaxed ${
                    msg.sender === "user"
                      ? "bg-blue-600 text-white rounded-tr-none shadow-md"
                      : "bg-slate-950/90 text-slate-200 border border-slate-800 rounded-tl-none"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                </div>

                {/* Browser Execution Status Pill */}
                {msg.statusPill && (
                  <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-950/80 border border-blue-500/30 text-[11px] text-blue-300">
                    <Globe className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
                    <span className="font-medium">{msg.statusPill.step}</span>
                  </div>
                )}

                {/* Generative UI Payment Receipt Card */}
                {msg.receipt && (
                  <div className="p-3 rounded-xl bg-gradient-to-b from-slate-950 to-slate-900 border border-emerald-500/40 text-slate-200 space-y-2.5 shadow-lg shadow-emerald-950/20">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                      <div className="flex items-center gap-1.5">
                        <Receipt className="w-4 h-4 text-emerald-400" />
                        <span className="font-semibold text-white text-xs">
                          Digital Payment Receipt
                        </span>
                      </div>
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 text-[10px]">
                        Verified & Captured
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-slate-400 block">Service:</span>
                        <span className="font-medium text-white">
                          {msg.receipt.service}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Plan:</span>
                        <span className="text-slate-200">
                          {msg.receipt.planName}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Live Price:</span>
                        <span className="text-emerald-400 font-bold">
                          ${msg.receipt.verifiedPrice.toFixed(2)}{" "}
                          {msg.receipt.currency}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">PayPal ID:</span>
                        <span className="font-mono text-cyan-400 truncate block">
                          {msg.receipt.orderId.substring(0, 14)}...
                        </span>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onViewReceipt(msg.receipt!)}
                      className="w-full h-7 border-emerald-500/30 bg-emerald-950/30 hover:bg-emerald-900/40 text-emerald-300 text-xs flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>View Full Sandbox Details</span>
                    </Button>
                  </div>
                )}

                {/* Generative UI Savings Advisory Card */}
                {msg.savingsAdvisory && (
                  <SavingsAdvisoryCard advisory={msg.savingsAdvisory} />
                )}

                <div className="text-[10px] text-slate-500 px-1">
                  {msg.timestamp}
                </div>
              </div>
            </div>
          </div>
        ))}
      </CardContent>

      {/* Input & Form */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/80">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type mandate (e.g. 'Pay Netflix $15.99 on 5th, max $20')..."
            className="flex-1 bg-slate-900 border-slate-700/80 text-white placeholder:text-slate-500 text-xs h-9 focus-visible:ring-blue-500"
          />
          <Button
            type="submit"
            size="sm"
            className="h-9 px-3.5 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-md shadow-blue-600/30"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Send</span>
          </Button>
        </form>
        <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
          <div className="flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            <span>Autonomous Playwright web scraper + PayPal Sandbox MCP</span>
          </div>
          <span className="text-slate-500">PostHog Telemetry active</span>
        </div>
      </div>
    </Card>
  );
}
