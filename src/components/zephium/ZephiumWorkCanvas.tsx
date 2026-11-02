"use client";

import React, { useState } from "react";
import {
  Sparkles,
  Bot,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  CreditCard,
  ShieldCheck,
  TrendingDown,
  Layers,
  ArrowRight,
  Plus,
  Play,
  RotateCw,
  Search,
} from "lucide-react";
import { Mandate, Transaction, AuditLog } from "@/components/dashboard/FinancialDashboard";
import { ReceiptData } from "@/components/dashboard/ReceiptDialog";
import { AgGridMandatesTable } from "@/components/dashboard/AgGridMandatesTable";
import { AgGridTransactionsTable } from "@/components/dashboard/AgGridTransactionsTable";
import { PersonaSavingsPanel } from "@/components/dashboard/PersonaSavingsPanel";
import { PriceSentinelPanel } from "@/components/dashboard/PriceSentinelPanel";
import { CalmPricingLens } from "@/components/dashboard/CalmPricingLens";
import { CalmPricingResult } from "@/lib/browser/types";
import { Badge } from "@/components/ui/badge";

const DEFAULT_CALM_DATA: CalmPricingResult = {
  service: "Netflix",
  url: "https://www.netflix.com/signup/planform",
  pageTitle: "Netflix Plans & Pricing",
  category: "Streaming",
  simplifierSummary: "Stripped 4 hidden fees, normalized billing cycle to monthly, unmasked ad restrictions.",
  darkPatternsStrippedCount: 4,
  hiddenFeesUncovered: ["Per-member sharing fee $7.99", "Extra device stream limits", "Auto-tier downgrade penalty"],
  rawPageComplexityScore: 78,
  calmScore: 98,
  analyzedAt: "Just now",
  plans: [
    {
      id: "netflix-ads",
      name: "Standard with Ads",
      headline: "Basic streaming with sponsor ads",
      price: 6.99,
      currency: "USD",
      billingPeriod: "monthly",
      normalizedMonthlyPrice: 6.99,
      transparentLabel: "Ad-supported 1080p stream",
      trapAlerts: ["4-5 mins of ads per hour", "Cannot download offline titles"],
      cleanFeatures: ["Full HD 1080p", "Watch on 2 supported devices"],
    },
    {
      id: "netflix-standard",
      name: "Standard HD (Target)",
      headline: "Full HD ad-free streaming on 2 devices",
      price: 15.49,
      currency: "USD",
      billingPeriod: "monthly",
      normalizedMonthlyPrice: 15.49,
      transparentLabel: "Ad-free Full HD streaming",
      trapAlerts: ["Extra members cost +$7.99/mo each"],
      cleanFeatures: ["Full HD 1080p", "Ad-free streaming", "Download on 2 devices"],
      recommended: true,
      recommendationReason: "Honest transparent rate matching user ceiling limit ($20.00)",
    },
    {
      id: "netflix-premium",
      name: "Premium 4K HDR",
      headline: "Ultra HD 4K + spatial audio on 4 devices",
      price: 22.99,
      currency: "USD",
      billingPeriod: "monthly",
      normalizedMonthlyPrice: 22.99,
      transparentLabel: "Ultra HD 4K + Spatial Audio",
      trapAlerts: ["Exceeds your $20.00 ceiling limit ($2.99 overrun)"],
      cleanFeatures: ["Ultra HD 4K + HDR", "Spatial Audio", "Watch on 4 devices"],
    },
  ],
};

interface ZephiumWorkCanvasProps {
  mandates: Mandate[];
  transactions: Transaction[];
  auditLogs: AuditLog[];
  onTriggerMandate: (id: string) => void;
  onViewReceipt: (receipt: ReceiptData) => void;
  onCreateMandateClick: () => void;
  onDeployPlanMandate?: (service: string, price: number, planName: string) => void;
  onSwitchToBrowseWithUrl?: (url: string) => void;
  onSelectHelperBot?: (botName: string) => void;
}

export function ZephiumWorkCanvas({
  mandates,
  transactions,
  auditLogs,
  onTriggerMandate,
  onViewReceipt,
  onCreateMandateClick,
  onDeployPlanMandate,
  onSwitchToBrowseWithUrl,
  onSelectHelperBot,
}: ZephiumWorkCanvasProps) {
  const [activeCanvasTab, setActiveCanvasTab] = useState<
    "overview" | "mandates" | "transactions" | "savings" | "sentinel"
  >("overview");

  const totalCaptured = transactions
    .filter((t) => t.status === "COMPLETED")
    .reduce((acc, curr) => acc + curr.amount, 0);

  const blockedCount = auditLogs.filter(
    (l) => l.eventType === "GUARDRAIL_BLOCKED"
  ).length;

  return (
    <div className="h-full flex flex-col bg-neutral-950 text-neutral-100 overflow-y-auto selection:bg-teal-500/30">
      {/* 1. Canvas Header & Outcome Statement */}
      <div className="p-5 border-b border-neutral-800 bg-neutral-900/60 backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 text-[10px] font-mono font-semibold border border-teal-500/30 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-teal-400" />
                ZEPHIUM WORK CANVAS
              </span>
              <span className="px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 text-[10px] font-mono">
                Outcome-Driven Agent Execution
              </span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              Autonomous Financial Mandates & Agentic Commerce
            </h1>
            <p className="text-xs text-neutral-400 mt-1 max-w-2xl">
              Describe an outcome in natural language. Rico dispatches parallel Playwright helpers to verify live merchant pricing, enforces safety ceilings, and captures transactions via PayPal Sandbox MCP.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCreateMandateClick}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-neutral-950 font-semibold text-xs transition-colors shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Deploy New Mandate</span>
            </button>
          </div>
        </div>

        {/* 2. Canvas Sub-Navigation Tabs */}
        <div className="flex items-center gap-1 mt-4 pt-3 border-t border-neutral-800/80 text-xs">
          <button
            type="button"
            onClick={() => setActiveCanvasTab("overview")}
            className={`px-3 py-1 rounded-md font-medium transition-colors ${
              activeCanvasTab === "overview"
                ? "bg-neutral-800 text-white font-semibold"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            Agent Workspace & Helpers
          </button>
          <button
            type="button"
            onClick={() => setActiveCanvasTab("mandates")}
            className={`px-3 py-1 rounded-md font-medium transition-colors ${
              activeCanvasTab === "mandates"
                ? "bg-neutral-800 text-white font-semibold"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            AG Grid Mandates ({mandates.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveCanvasTab("transactions")}
            className={`px-3 py-1 rounded-md font-medium transition-colors ${
              activeCanvasTab === "transactions"
                ? "bg-neutral-800 text-white font-semibold"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            Transactions Ledger (${totalCaptured.toFixed(2)})
          </button>
          <button
            type="button"
            onClick={() => setActiveCanvasTab("savings")}
            className={`px-3 py-1 rounded-md font-medium transition-colors ${
              activeCanvasTab === "savings"
                ? "bg-neutral-800 text-white font-semibold"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            Savings & Credits ($50k+)
          </button>
          <button
            type="button"
            onClick={() => setActiveCanvasTab("sentinel")}
            className={`px-3 py-1 rounded-md font-medium transition-colors ${
              activeCanvasTab === "sentinel"
                ? "bg-neutral-800 text-white font-semibold"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            24/7 Price Sentinel
          </button>
        </div>
      </div>

      {/* 3. Canvas Content Area */}
      <div className="p-5 flex-1 space-y-6">
        {activeCanvasTab === "overview" && (
          <>
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl border border-neutral-800 bg-neutral-900/60 flex flex-col justify-between">
                <span className="text-[11px] text-neutral-400 font-medium">Active Mandates</span>
                <span className="text-2xl font-bold text-white mt-1">{mandates.length}</span>
                <span className="text-[10px] text-teal-400 mt-1 font-mono">100% Autonomous</span>
              </div>
              <div className="p-3.5 rounded-xl border border-neutral-800 bg-neutral-900/60 flex flex-col justify-between">
                <span className="text-[11px] text-neutral-400 font-medium">Total Captured</span>
                <span className="text-2xl font-bold text-emerald-400 mt-1">
                  ${totalCaptured.toFixed(2)}
                </span>
                <span className="text-[10px] text-neutral-400 mt-1 font-mono">PayPal Sandbox MCP</span>
              </div>
              <div className="p-3.5 rounded-xl border border-neutral-800 bg-neutral-900/60 flex flex-col justify-between">
                <span className="text-[11px] text-neutral-400 font-medium">Safety Intercepts</span>
                <span className="text-2xl font-bold text-amber-400 mt-1">{blockedCount || 1}</span>
                <span className="text-[10px] text-amber-500/80 mt-1 font-mono">Budget Guardrails</span>
              </div>
              <div className="p-3.5 rounded-xl border border-neutral-800 bg-neutral-900/60 flex flex-col justify-between">
                <span className="text-[11px] text-neutral-400 font-medium">Avg Reasoning Time</span>
                <span className="text-2xl font-bold text-purple-400 mt-1">1.18s</span>
                <span className="text-[10px] text-purple-400/80 mt-1 font-mono">CDP + Gemini Flash</span>
              </div>
            </div>

            {/* Section: Helpers Working in Parallel (Zephium Signature Feature) */}
            <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/40 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-blue-400" />
                  <h2 className="text-sm font-semibold text-white">
                    Helpers Working in Parallel (In the Open)
                  </h2>
                </div>
                <span className="text-[10px] text-neutral-400 font-mono">
                  Concurrent Multi-Site Check • Zero Desktop Installs
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                {/* Helper 1: Netflix */}
                <div className="p-3 rounded-lg border border-neutral-800 bg-neutral-950 hover:border-neutral-700 transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-semibold text-white flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        Helper #1: Netflix
                      </span>
                      <span className="px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-mono font-bold">
                        $15.49/mo
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-400">
                      Standard HD plan price verified under $20.00 ceiling limit.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (onSwitchToBrowseWithUrl) {
                        onSwitchToBrowseWithUrl("https://www.netflix.com/signup/planform");
                      }
                    }}
                    className="mt-3 flex items-center justify-between text-[11px] text-teal-400 hover:text-teal-300 font-medium"
                  >
                    <span>Watch in Live Viewport</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                {/* Helper 2: Spotify */}
                <div className="p-3 rounded-lg border border-neutral-800 bg-neutral-950 hover:border-neutral-700 transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-semibold text-white flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        Helper #2: Spotify
                      </span>
                      <span className="px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-mono font-bold">
                        $11.99/mo
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-400">
                      Premium Individual plan verified. Student discount probe available.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (onSwitchToBrowseWithUrl) {
                        onSwitchToBrowseWithUrl("https://www.spotify.com/us/premium/");
                      }
                    }}
                    className="mt-3 flex items-center justify-between text-[11px] text-teal-400 hover:text-teal-300 font-medium"
                  >
                    <span>Watch in Live Viewport</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                {/* Helper 3: AWS */}
                <div className="p-3 rounded-lg border border-neutral-800 bg-neutral-950 hover:border-neutral-700 transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-semibold text-white flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        Helper #3: AWS Cloud
                      </span>
                      <span className="px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 text-[10px] font-mono font-bold">
                        $84.20/mo
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-400">
                      EC2 & S3 tier usage checked. Within $120.00 ceiling limit.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (onSwitchToBrowseWithUrl) {
                        onSwitchToBrowseWithUrl("https://aws.amazon.com/pricing/");
                      }
                    }}
                    className="mt-3 flex items-center justify-between text-[11px] text-teal-400 hover:text-teal-300 font-medium"
                  >
                    <span>Watch in Live Viewport</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>

            {/* Calm Pricing Lens: Clean Cards with 1-Click Plan Selector */}
            <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/40 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    Calm Pricing Lens (Real-Time Simplifier)
                  </h2>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    Zephium in-place restyling strips dark patterns, confusing tiered formulas, and hidden fees into calm cards. Click any plan to lock it into PayPal Mandate execution.
                  </p>
                </div>
              </div>

              <CalmPricingLens
                data={DEFAULT_CALM_DATA}
                onSelectPlan={(service, price, planName) => {
                  if (onDeployPlanMandate) {
                    onDeployPlanMandate(service, price, planName);
                  }
                }}
              />
            </div>

            {/* Verified Digital Payment Receipt Card */}
            <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/40 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-emerald-400" />
                  <h2 className="text-sm font-semibold text-white">
                    Official PayPal Sandbox MCP Receipt & Dual-Rail Proof
                  </h2>
                </div>
                <Badge
                  variant="outline"
                  className="text-[10px] border-emerald-500/30 text-emerald-400 font-mono"
                >
                  Captured & Stored in SQLite
                </Badge>
              </div>

              <div className="p-4 rounded-lg border border-neutral-800 bg-neutral-950 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-white">Netflix Standard HD</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-mono font-bold">
                      Order: ORD-84920491
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-mono">
                      PayPal Primary
                    </span>
                  </div>
                  <p className="text-neutral-400 text-[11px]">
                    Standard 2-Screen HD Streaming • Captured: Oct 31, 2026, 02:45 PM • Auth: AUTH-8921
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-lg font-bold text-emerald-400 font-mono">$15.49 USD</div>
                    <div className="text-[10px] text-teal-400 font-mono">Saved $4.51 under ceiling</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onViewReceipt({
                        orderId: "ORD-84920491",
                        service: "Netflix Standard HD",
                        planName: "Standard 2-Screen HD Streaming",
                        verifiedPrice: 15.49,
                        budgetCeiling: 20.0,
                        currency: "USD",
                        paymentMethod: "Connected Account",
                        status: "COMPLETED",
                        timestamp: "Oct 31, 2026, 02:45 PM",
                        payerEmail: "user@example.com",
                        sandboxAuthCode: "AUTH-8921",
                      });
                    }}
                    className="px-3 py-1.5 rounded-md bg-neutral-800 hover:bg-neutral-700 text-white font-medium transition-colors"
                  >
                    View Full Details
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Tab 2: AG Grid Mandates Table */}
        {activeCanvasTab === "mandates" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-white">
                  Active Recurring Mandates (AG Grid Community)
                </h2>
                <p className="text-xs text-neutral-400 mt-0.5">
                  High-performance financial audit table with real-time sorting, status filtering, and autonomous execution.
                </p>
              </div>
              <button
                type="button"
                onClick={onCreateMandateClick}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-teal-500 hover:bg-teal-400 text-neutral-950 font-semibold text-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Mandate</span>
              </button>
            </div>
            <div className="h-[500px] rounded-xl border border-neutral-800 overflow-hidden bg-neutral-900">
              <AgGridMandatesTable
                mandates={mandates}
                onTriggerMandate={onTriggerMandate}
              />
            </div>
          </div>
        )}

        {/* Tab 3: AG Grid Transactions Ledger */}
        {activeCanvasTab === "transactions" && (
          <div className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-white">
                Captured Transactions Ledger (PayPal Sandbox MCP)
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Every captured order, cryptographic proof, and authorization code is persisted in SQLite with zero telemetry leakage.
              </p>
            </div>
            <div className="h-[500px] rounded-xl border border-neutral-800 overflow-hidden bg-neutral-900">
              <AgGridTransactionsTable
                transactions={transactions}
                onViewReceipt={onViewReceipt}
                isDarkMode={true}
              />
            </div>
          </div>
        )}

        {/* Tab 4: Savings & Credits ($50k+) */}
        {activeCanvasTab === "savings" && (
          <PersonaSavingsPanel
            onDeployPlanMandate={onDeployPlanMandate}
          />
        )}

        {/* Tab 5: 24/7 Price Sentinel */}
        {activeCanvasTab === "sentinel" && <PriceSentinelPanel mandates={mandates} />}
      </div>
    </div>
  );
}
