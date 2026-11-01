"use client";

import React, { useState } from "react";
import {
  Sparkles,
  ShieldAlert,
  CheckCircle2,
  Lock,
  ArrowRight,
  Eye,
  EyeOff,
  AlertTriangle,
  Zap,
  TrendingDown,
  Check,
  Building2,
  Server,
  Film,
  Code2,
} from "lucide-react";
import { CalmPricingResult, CalmPlanTier } from "@/lib/browser/types";

interface CalmPricingLensProps {
  data: CalmPricingResult;
  onSelectPlan: (service: string, price: number, planName: string) => void;
  isLoading?: boolean;
}

export function CalmPricingLens({
  data,
  onSelectPlan,
  isLoading = false,
}: CalmPricingLensProps) {
  const [showRawContrast, setShowRawContrast] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [showGotchas, setShowGotchas] = useState(true);

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case "Streaming":
        return <Film className="w-3.5 h-3.5 text-red-400" />;
      case "Developer Tools":
        return <Code2 className="w-3.5 h-3.5 text-purple-400" />;
      case "Cloud & Infrastructure":
        return <Server className="w-3.5 h-3.5 text-blue-400" />;
      default:
        return <Building2 className="w-3.5 h-3.5 text-emerald-400" />;
    }
  };

  const handlePlanClick = (plan: CalmPlanTier) => {
    setSelectedPlanId(plan.id);
    onSelectPlan(data.service, plan.normalizedMonthlyPrice || plan.price, plan.name);
  };

  return (
    <div className="w-full h-full flex flex-col bg-neutral-950 text-neutral-100 overflow-y-auto select-none p-4 space-y-4 font-sans">
      {/* 1. Zephium Brand Header & Contrast Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-md bg-purple-500/20 text-purple-400 border border-purple-500/40">
              <Sparkles className="w-4 h-4 animate-pulse" />
            </span>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
                <span>Calm Pricing Lens™</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-purple-950/80 text-purple-300 border border-purple-500/30">
                  Zephium In-Place Restyling
                </span>
              </h3>
            </div>
          </div>
          <p className="text-xs text-neutral-400 mt-1 max-w-xl">
            {data.simplifierSummary}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowRawContrast((prev) => !prev)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium border flex items-center gap-1.5 transition-colors ${
              showRawContrast
                ? "bg-amber-950/60 border-amber-500/60 text-amber-300"
                : "bg-neutral-900 border-neutral-700/60 text-neutral-300 hover:text-white hover:bg-neutral-800"
            }`}
            title="Inspect original convoluted marketing copy vs clean transparent restyling"
          >
            {showRawContrast ? (
              <>
                <EyeOff className="w-3.5 h-3.5" />
                <span>Hide Raw Traps</span>
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5" />
                <span>Compare Raw Traps</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. Real-Time Telemetry & Metric Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div className="p-2.5 rounded-lg bg-neutral-900/80 border border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-red-500/20 text-red-400">
              <ShieldAlert className="w-3.5 h-3.5" />
            </span>
            <span className="text-neutral-400 text-[11px]">Traps Stripped</span>
          </div>
          <span className="font-mono font-bold text-red-400 text-sm">
            {data.darkPatternsStrippedCount} detected
          </span>
        </div>

        <div className="p-2.5 rounded-lg bg-neutral-900/80 border border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-emerald-500/20 text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </span>
            <span className="text-neutral-400 text-[11px]">Calm Score</span>
          </div>
          <span className="font-mono font-bold text-emerald-400 text-sm">
            {data.calmScore}/100
          </span>
        </div>

        <div className="p-2.5 rounded-lg bg-neutral-900/80 border border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-amber-500/20 text-amber-400">
              <TrendingDown className="w-3.5 h-3.5" />
            </span>
            <span className="text-neutral-400 text-[11px]">Original Noise</span>
          </div>
          <span className="font-mono font-bold text-neutral-300 text-sm line-through">
            {data.rawPageComplexityScore}%
          </span>
        </div>

        <div className="p-2.5 rounded-lg bg-neutral-900/80 border border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-blue-500/20 text-blue-400">
              {getCategoryIcon(data.category)}
            </span>
            <span className="text-neutral-400 text-[11px]">Category</span>
          </div>
          <span className="font-medium text-blue-300 text-xs truncate max-w-[90px]">
            {data.category}
          </span>
        </div>
      </div>

      {/* 3. Hidden Fees Uncovered Banner */}
      {data.hiddenFeesUncovered.length > 0 && (
        <div className="p-3 rounded-xl bg-amber-950/25 border border-amber-500/30 space-y-1.5 animate-in fade-in">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setShowGotchas((prev) => !prev)}
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                {data.hiddenFeesUncovered.length} Hidden Fees &amp; Fine-Print Clauses Neutralized by Rico
              </span>
            </div>
            <span className="text-[10px] text-amber-400/80 underline font-mono">
              {showGotchas ? "Hide" : "View"}
            </span>
          </div>

          {showGotchas && (
            <ul className="space-y-1 pt-1.5 border-t border-amber-500/20 text-xs text-amber-200/90 font-mono">
              {data.hiddenFeesUncovered.map((gotcha, idx) => (
                <li key={idx} className="flex items-start gap-1.5 text-[11px]">
                  <span className="text-amber-400 shrink-0">•</span>
                  <span>{gotcha}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* 4. Plan Cards Grid */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-neutral-400 px-1">
          <span className="font-semibold text-white">
            Available Verified Plans ({data.plans.length})
          </span>
          <span className="text-[11px] font-mono text-neutral-400 flex items-center gap-1">
            <Lock className="w-3 h-3 text-emerald-400" />
            1-Click Direct to PayPal Mandate
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {data.plans.map((plan) => {
            const isSelected = selectedPlanId === plan.id;
            return (
              <div
                key={plan.id}
                className={`relative rounded-xl border p-4 transition-all duration-200 flex flex-col justify-between ${
                  isSelected
                    ? "bg-neutral-900 border-blue-500 ring-2 ring-blue-500/40 shadow-xl shadow-blue-500/10"
                    : plan.recommended
                    ? "bg-neutral-900/90 border-purple-500/50 hover:border-purple-400"
                    : "bg-neutral-900/60 border-neutral-800 hover:border-neutral-700"
                }`}
              >
                {/* Recommendation Pill */}
                {plan.recommended && (
                  <div className="absolute -top-2.5 right-4 px-2 py-0.5 rounded-full bg-purple-600 border border-purple-400 text-[10px] font-bold text-white tracking-wider uppercase flex items-center gap-1 shadow-md">
                    <Sparkles className="w-2.5 h-2.5" />
                    <span>Rico Best Value</span>
                  </div>
                )}

                <div className="space-y-3">
                  {/* Plan Title & Transparent Rate */}
                  <div>
                    <h4 className="text-base font-bold text-white flex items-center gap-2">
                      <span>{plan.name}</span>
                    </h4>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      {plan.headline}
                    </p>
                  </div>

                  {/* Clean Transparent Price Display */}
                  <div className="p-2.5 rounded-lg bg-neutral-950/80 border border-neutral-800 space-y-1">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-black text-white font-mono">
                        ${plan.normalizedMonthlyPrice.toFixed(2)}
                      </span>
                      <span className="text-xs text-neutral-400 font-mono">
                        {plan.billingPeriod === "usage"
                          ? "est. / mo"
                          : "/ month"}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 shrink-0" />
                      <span>{plan.transparentLabel}</span>
                    </div>
                  </div>

                  {/* Raw Trap Comparison Snippet (If toggled) */}
                  {showRawContrast && plan.rawMarketingTrapSnippet && (
                    <div className="p-2 rounded bg-red-950/30 border border-red-500/30 text-[11px] text-red-300 font-mono space-y-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-red-400 block">
                        Original Raw Marketing Trap:
                      </span>
                      <p className="italic text-neutral-400 line-through">
                        &quot;{plan.rawMarketingTrapSnippet}&quot;
                      </p>
                    </div>
                  )}

                  {/* Stripped Traps Badges */}
                  {plan.trapAlerts.length > 0 && (
                    <div className="space-y-1">
                      {plan.trapAlerts.map((alert, idx) => (
                        <div
                          key={idx}
                          className="px-2 py-1 rounded bg-neutral-950 border border-amber-500/30 text-[11px] text-amber-300 font-mono flex items-center gap-1.5"
                        >
                          <span className="shrink-0">•</span>
                          <span className="truncate">{alert}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Clean Features Bullet List */}
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider font-mono">
                      Honest Features:
                    </span>
                    <ul className="space-y-1 text-xs text-neutral-300">
                      {plan.cleanFeatures.map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <span className="leading-snug">{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* 1-Click Select & Lock Action Button */}
                <div className="pt-4 mt-3 border-t border-neutral-800">
                  <button
                    type="button"
                    onClick={() => handlePlanClick(plan)}
                    disabled={isLoading}
                    className={`w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-md ${
                      isSelected
                        ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                        : plan.recommended
                        ? "bg-purple-600 hover:bg-purple-500 text-white"
                        : "bg-blue-600 hover:bg-blue-500 text-white"
                    }`}
                  >
                    {isSelected ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Plan Selected &amp; Ready to Deploy</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-3.5 h-3.5" />
                        <span>
                          Deploy Mandate with PayPal (${plan.normalizedMonthlyPrice.toFixed(2)}/mo)
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 ml-auto" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
