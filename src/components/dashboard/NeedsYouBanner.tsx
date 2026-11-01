"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  ShieldAlert,
  Check,
  CreditCard,
  X,
  TrendingUp,
  Lock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { ApprovalRequest } from "./ApprovalDialog";

interface NeedsYouBannerProps {
  request: ApprovalRequest;
  onApprovePayPal: () => void;
  onApproveBackupCard: () => void;
  onReject: () => void;
  className?: string;
}

export function NeedsYouBanner({
  request,
  onApprovePayPal,
  onApproveBackupCard,
  onReject,
  className = "",
}: NeedsYouBannerProps) {
  const [showDetails, setShowDetails] = useState(false);

  const baseline = request.baselinePrice || request.budgetCeiling * 0.8;
  const spike =
    request.spikePercentage ||
    Math.round(((request.detectedPrice - baseline) / baseline) * 100);

  return (
    <div
      className={`w-full bg-gradient-to-r from-amber-950/95 via-neutral-950/95 to-amber-950/95 border-b-2 border-amber-500 text-neutral-100 shadow-2xl backdrop-blur-md select-none transition-all duration-300 animate-in slide-in-from-top-4 z-40 ${className}`}
    >
      <div className="max-w-7xl mx-auto px-4 py-3">
        {/* Main Banner Bar */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          {/* Left: Attention Icon & Anomaly Reason */}
          <div className="flex items-start gap-3">
            <div className="relative mt-0.5 shrink-0">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400 shadow-inner">
                <AlertTriangle className="w-5 h-5 animate-bounce" />
              </div>
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-400 animate-ping" />
            </div>

            <div className="space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black tracking-wider uppercase px-2 py-0.5 rounded-full bg-amber-500 text-neutral-950 font-mono shadow-sm">
                  NEEDS YOU • HUMAN DECISION GATE
                </span>
                <span className="text-xs font-mono text-amber-300 font-semibold flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                  Price Spike Guardrail Halted Execution
                </span>
              </div>

              <div className="flex items-center gap-2 text-sm text-neutral-200">
                <span className="font-bold text-white text-base">
                  {request.service}
                </span>
                <span className="text-neutral-500">•</span>
                <span className="font-mono text-red-400 font-bold text-base">
                  ${request.detectedPrice.toFixed(2)} {request.currency}
                </span>
                {spike > 0 && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-950/80 border border-red-500/50 text-red-300 text-[11px] font-mono font-bold">
                    <TrendingUp className="w-3 h-3 text-red-400" />
                    +{spike}% Spike
                  </span>
                )}
                <span className="text-xs text-neutral-400 font-mono hidden sm:inline">
                  (Baseline: ${baseline.toFixed(2)})
                </span>
              </div>
            </div>
          </div>

          {/* Right: 3 1-Click Action Decision Buttons */}
          <div className="flex items-center gap-2 w-full md:w-auto shrink-0 justify-end flex-wrap">
            {/* Action 1: Approve with Primary PayPal */}
            <button
              type="button"
              onClick={onApprovePayPal}
              className="h-8 px-3.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md transition-all active:scale-95"
              title="Authorize payment via Primary PayPal Sandbox Wallet"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Approve (PayPal)</span>
            </button>

            {/* Action 2: Re-route to Secondary Vaulted Visa / MC */}
            <button
              type="button"
              onClick={onApproveBackupCard}
              className="h-8 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md transition-all active:scale-95"
              title="Route payment to secondary backup card via PayPal Vault Bridge"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Pay with Visa (•••• 4242)</span>
            </button>

            {/* Action 3: Decline / Cancel */}
            <button
              type="button"
              onClick={onReject}
              className="h-8 px-2.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700/80 text-xs font-medium flex items-center gap-1 transition-colors"
              title="Decline payment, hold mandate, and protect wallet funds"
            >
              <X className="w-3.5 h-3.5 text-neutral-400" />
              <span>Decline</span>
            </button>

            {/* Toggle Detailed Telemetry */}
            <button
              type="button"
              onClick={() => setShowDetails((prev) => !prev)}
              className="p-1 rounded text-neutral-400 hover:text-neutral-200 transition-colors ml-1"
              title="Toggle safety explanation & audit telemetry"
            >
              {showDetails ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Expandable Explanation Drawer */}
        {showDetails && (
          <div className="mt-3 pt-2.5 border-t border-amber-500/30 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono animate-in fade-in">
            <div className="p-2 rounded bg-neutral-950/80 border border-neutral-800">
              <span className="text-[10px] text-neutral-500 uppercase tracking-wider block">
                Safety Condition Trigger
              </span>
              <p className="text-neutral-300 mt-0.5 leading-snug">
                {request.reason}
              </p>
            </div>

            <div className="p-2 rounded bg-neutral-950/80 border border-neutral-800">
              <span className="text-[10px] text-neutral-500 uppercase tracking-wider block">
                Authorized Safety Ceiling
              </span>
              <p className="text-amber-300 font-bold mt-0.5">
                ${request.budgetCeiling.toFixed(2)} {request.currency}
              </p>
              <span className="text-[10px] text-neutral-500">
                Excess: ${(request.detectedPrice - request.budgetCeiling > 0
                  ? request.detectedPrice - request.budgetCeiling
                  : 0
                ).toFixed(2)} USD
              </span>
            </div>

            <div className="p-2 rounded bg-neutral-950/80 border border-neutral-800">
              <span className="text-[10px] text-neutral-500 uppercase tracking-wider block">
                Dual-Rail Protection
              </span>
              <div className="flex items-center gap-1.5 text-emerald-400 mt-0.5">
                <Lock className="w-3 h-3" />
                <span>Zero Unauthorized Captures</span>
              </div>
              <span className="text-[10px] text-neutral-500">
                PayPal PCI Vault Bridge active
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
