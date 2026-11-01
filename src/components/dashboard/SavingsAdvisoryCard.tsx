"use client";

import React, { useState } from "react";
import {
  Sparkles,
  ExternalLink,
  CheckCircle2,
  CreditCard,
  Gift,
  RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { SavingsAdvisoryData } from "@/lib/savings/types";

interface SavingsAdvisoryCardProps {
  advisory: SavingsAdvisoryData;
  onApplyPayment?: (advisory: SavingsAdvisoryData) => void;
  onDismiss?: () => void;
}

export function SavingsAdvisoryCard({
  advisory,
  onApplyPayment,
  onDismiss,
}: SavingsAdvisoryCardProps) {
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);

  const handleApply = async () => {
    setApplying(true);
    try {
      if (onApplyPayment) {
        await onApplyPayment(advisory);
      } else {
        const res = await fetch("/api/savings/apply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            serviceName: advisory.service,
            originalPrice: advisory.originalPrice,
            discountedPrice: advisory.discountedPrice,
            budgetCeiling: advisory.originalPrice,
          }),
        });
        if (res.ok) {
          setApplied(true);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setApplying(false);
    }
  };

  const isCreditClaim = advisory.reclaimedCredits > 500;

  return (
    <div className="rounded-xl border border-emerald-500/40 bg-gradient-to-br from-emerald-950/60 via-slate-900 to-emerald-950/40 p-3.5 space-y-3 shadow-lg max-w-md w-full animate-fadeIn">
      {/* Top Banner */}
      <div className="flex items-center justify-between border-b border-emerald-800/40 pb-2">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold text-white tracking-tight">
            💡 Pre-Payment Savings Advisory
          </span>
        </div>
        <Badge
          variant="outline"
          className="text-[9px] py-0 px-1.5 border-emerald-400/40 text-emerald-300 bg-emerald-500/10 font-mono"
        >
          {advisory.persona === "STARTUP_FOUNDER"
            ? "🚀 STARTUP"
            : advisory.persona === "STUDENT"
            ? "🎓 STUDENT"
            : "💻 DEV / SMB"}
        </Badge>
      </div>

      {/* Main Headline & Badge */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Badge className="bg-emerald-600 text-white border-none text-[10px] font-semibold flex items-center gap-1">
            <Gift className="w-3 h-3" />
            {isCreditClaim
              ? `+$${advisory.reclaimedCredits.toLocaleString()} Credits Eligible`
              : `Save $${advisory.savingsEnforced.toFixed(2)}/mo`}
          </Badge>
          {advisory.couponCode && (
            <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-300 font-mono">
              Code: {advisory.couponCode}
            </Badge>
          )}
        </div>

        <h4 className="text-xs font-bold text-white leading-snug">
          {advisory.appliedDealHeadline}
        </h4>

        <p className="text-[11px] text-neutral-300 leading-relaxed">
          {isCreditClaim ? (
            <>
              Before charging PayPal for <strong className="text-white">{advisory.service}</strong>,
              Rico detected an official startup program granting up to{" "}
              <strong className="text-emerald-400">${advisory.reclaimedCredits.toLocaleString()}</strong> in credits.
            </>
          ) : (
            <>
              Rico verified your eligible discount for <strong className="text-white">{advisory.service}</strong>.
              Your plan rate drops from{" "}
              <span className="line-through text-neutral-400">${advisory.originalPrice.toFixed(2)}</span> to{" "}
              <strong className="text-emerald-400">${advisory.discountedPrice.toFixed(2)} / mo</strong>.
            </>
          )}
        </p>
      </div>

      {/* Price Comparison Summary Box */}
      <div className="p-2.5 rounded-lg bg-neutral-900/80 border border-neutral-800 flex items-center justify-between text-xs">
        <div>
          <span className="text-[10px] text-neutral-400 block">Regular Price</span>
          <span className="font-mono text-neutral-400 line-through">
            ${advisory.originalPrice.toFixed(2)}
          </span>
        </div>

        <div className="text-center">
          <span className="text-[10px] text-emerald-400 block">Savings Enforced</span>
          <span className="font-bold text-emerald-400 font-mono">
            {isCreditClaim
              ? `+$${advisory.reclaimedCredits.toLocaleString()}`
              : `-$${advisory.savingsEnforced.toFixed(2)}`}
          </span>
        </div>

        <div className="text-right">
          <span className="text-[10px] text-white block font-semibold">Discounted Total</span>
          <span className="font-bold text-white text-sm font-mono">
            ${advisory.discountedPrice.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      {applied ? (
        <div className="p-2 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-center text-xs text-emerald-200 flex items-center justify-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>Discount Applied! PayPal order captured for ${advisory.discountedPrice.toFixed(2)}.</span>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row items-center gap-2 pt-0.5">
          {advisory.discountedPrice > 0 ? (
            <button
              type="button"
              disabled={applying}
              onClick={handleApply}
              className="w-full sm:flex-1 py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-semibold text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              {applying ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CreditCard className="w-3.5 h-3.5" />
              )}
              <span>Apply &amp; Pay (${advisory.discountedPrice.toFixed(2)})</span>
            </button>
          ) : null}

          {advisory.claimUrl && (
            <a
              href={advisory.claimUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:flex-1 py-1.5 px-3 rounded-lg bg-neutral-800 hover:bg-neutral-700 active:scale-98 text-white font-medium text-xs transition-all flex items-center justify-center gap-1.5 border border-neutral-700 text-center"
            >
              <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
              <span>{isCreditClaim ? "Claim Credits Portal" : "Student Verification"}</span>
            </a>
          )}

          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="py-1 px-2 text-[11px] text-neutral-400 hover:text-neutral-200"
            >
              Dismiss
            </button>
          )}
        </div>
      )}
    </div>
  );
}
