"use client";

import React, { useState } from "react";
import {
  Sparkles,
  Gift,
  ExternalLink,
  CreditCard,
  CheckCircle2,
  Rocket,
  GraduationCap,
  Code2,
  RefreshCw,
  Search,
  ShieldCheck,
  TrendingDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  UserPersona,
  SavingsAdvisoryData,
} from "@/lib/savings/types";
import { PERSONA_DEALS_MATRIX } from "@/lib/savings/deal-matrix";
import { PersonaSelector } from "./PersonaSelector";
import { SavingsAdvisoryCard } from "./SavingsAdvisoryCard";

interface PersonaSavingsPanelProps {
  onDeployPlanMandate?: (service: string, price: number, planName: string) => void;
  onRefreshData?: () => void;
}

export function PersonaSavingsPanel({
  onDeployPlanMandate,
  onRefreshData,
}: PersonaSavingsPanelProps) {
  const [activePersona, setActivePersona] = useState<UserPersona>("STARTUP_FOUNDER");
  const [probingService, setProbingService] = useState<string | null>(null);
  const [activeAdvisory, setActiveAdvisory] = useState<SavingsAdvisoryData | null>(null);
  const [appliedSuccessMsg, setAppliedSuccessMsg] = useState<string | null>(null);

  const filteredDeals = PERSONA_DEALS_MATRIX.filter((d) => d.persona === activePersona);

  const totalCreditsPotential = filteredDeals.reduce(
    (acc, curr) => acc + curr.reclaimedCreditValue,
    0
  );

  const handleProbe = async (serviceName: string, regularPrice: number) => {
    setProbingService(serviceName);
    setAppliedSuccessMsg(null);
    try {
      const res = await fetch("/api/savings/probe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service: serviceName,
          price: regularPrice,
          persona: activePersona,
        }),
      });

      const data = await res.json();
      if (res.ok && data.result?.advisory) {
        setActiveAdvisory(data.result.advisory);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setProbingService(null);
    }
  };

  const handleApplyDiscountPayment = async (advisory: SavingsAdvisoryData) => {
    try {
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

      const data = await res.json();
      if (res.ok && data.success) {
        setAppliedSuccessMsg(
          `Payment authorized! Captured $${advisory.discountedPrice.toFixed(
            2
          )} via PayPal Sandbox Orders API. Reclaimed $${advisory.savingsEnforced.toFixed(2)} in savings.`
        );
        if (onRefreshData) onRefreshData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="h-full flex flex-col bg-neutral-950 text-neutral-100 overflow-y-auto p-4 space-y-4">
      {/* Header Banner */}
      <div className="p-4 rounded-xl border border-emerald-800/50 bg-gradient-to-r from-emerald-950/70 via-slate-900 to-emerald-950/60 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-md">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              Rico — Persona-Based Savings &amp; Startup/Student Credits Optimizer
            </h2>
            <Badge
              variant="outline"
              className="text-[10px] py-0 px-1.5 border-emerald-400/40 text-emerald-300 bg-emerald-500/10 font-mono"
            >
              PRE-PAYMENT ADVISOR ACTIVE
            </Badge>
          </div>
          <p className="text-xs text-emerald-200/80 mt-1">
            Autonomous Pre-Payment Deal Probe: $50k PostHog &amp; Notion Startup Credits, 50% Student Discounts &amp; Annual Billing Arbitrage
          </p>
        </div>

        <div className="shrink-0">
          <PersonaSelector
            activePersona={activePersona}
            onSelectPersona={(p) => {
              setActivePersona(p);
              setActiveAdvisory(null);
            }}
            variant="compact"
          />
        </div>
      </div>

      {appliedSuccessMsg && (
        <div className="p-3 rounded-lg border border-emerald-500/40 bg-emerald-950/60 text-emerald-200 text-xs flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{appliedSuccessMsg}</span>
        </div>
      )}

      {/* KPI Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 text-xs">
        <div className="p-2.5 rounded-lg border border-neutral-800 bg-neutral-900/60 shadow-xs">
          <div className="flex items-center justify-between text-neutral-400 text-[11px] mb-1">
            <span>Reclaimed Credit Value</span>
            <Gift className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-sm font-bold text-emerald-400">
            ${totalCreditsPotential.toLocaleString()}
          </div>
          <span className="text-[10px] text-neutral-500">Startup &amp; education credits</span>
        </div>

        <div className="p-2.5 rounded-lg border border-neutral-800 bg-neutral-900/60 shadow-xs">
          <div className="flex items-center justify-between text-neutral-400 text-[11px] mb-1">
            <span>Active Persona Deals</span>
            <Rocket className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="text-sm font-bold text-white">{filteredDeals.length} Programs</div>
          <span className="text-[10px] text-neutral-500">Tailored to your profile</span>
        </div>

        <div className="p-2.5 rounded-lg border border-neutral-800 bg-neutral-900/60 shadow-xs">
          <div className="flex items-center justify-between text-neutral-400 text-[11px] mb-1">
            <span>Avg Subsidy Rate</span>
            <TrendingDown className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-sm font-bold text-amber-400">50% - 100% Off</div>
          <span className="text-[10px] text-neutral-500">Zero-dollar tiers included</span>
        </div>

        <div className="p-2.5 rounded-lg border border-neutral-800 bg-neutral-900/60 shadow-xs">
          <div className="flex items-center justify-between text-neutral-400 text-[11px] mb-1">
            <span>Pre-Payment Probe</span>
            <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div className="text-sm font-bold text-sky-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Always-On Intercept
          </div>
          <span className="text-[10px] text-neutral-500">Checks before PayPal charge</span>
        </div>
      </div>

      {/* Interactive Probe Test Bar */}
      <div className="p-3.5 rounded-xl border border-neutral-800 bg-neutral-900/40 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5 text-emerald-400" />
            Simulate Pre-Payment Deal Probe (Click to Test):
          </span>
          <span className="text-[10px] text-neutral-400 font-mono">
            Persona: <strong className="text-emerald-400">{activePersona}</strong>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activePersona === "STARTUP_FOUNDER" && (
            <>
              <button
                type="button"
                disabled={probingService !== null}
                onClick={() => handleProbe("PostHog", 120.0)}
                className="px-2.5 py-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-600/40 text-xs font-medium transition-all flex items-center gap-1.5"
              >
                {probingService === "PostHog" ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <Rocket className="w-3 h-3 text-emerald-400" />
                )}
                <span>Probe PostHog ($50k Credits)</span>
              </button>

              <button
                type="button"
                disabled={probingService !== null}
                onClick={() => handleProbe("Notion", 10.0)}
                className="px-2.5 py-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-600/40 text-xs font-medium transition-all flex items-center gap-1.5"
              >
                {probingService === "Notion" ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <Rocket className="w-3 h-3 text-emerald-400" />
                )}
                <span>Probe Notion ($1k Credits)</span>
              </button>

              <button
                type="button"
                disabled={probingService !== null}
                onClick={() => handleProbe("AWS", 84.5)}
                className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 text-xs font-medium transition-all flex items-center gap-1.5"
              >
                <span>Probe AWS ($5k Credits)</span>
              </button>
            </>
          )}

          {activePersona === "STUDENT" && (
            <>
              <button
                type="button"
                disabled={probingService !== null}
                onClick={() => handleProbe("Spotify", 11.99)}
                className="px-2.5 py-1.5 rounded-lg bg-blue-950/80 hover:bg-blue-900 text-blue-300 border border-blue-600/40 text-xs font-medium transition-all flex items-center gap-1.5"
              >
                {probingService === "Spotify" ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <GraduationCap className="w-3 h-3 text-blue-400" />
                )}
                <span>Probe Spotify (50% Off Student)</span>
              </button>

              <button
                type="button"
                disabled={probingService !== null}
                onClick={() => handleProbe("Adobe", 54.99)}
                className="px-2.5 py-1.5 rounded-lg bg-blue-950/80 hover:bg-blue-900 text-blue-300 border border-blue-600/40 text-xs font-medium transition-all flex items-center gap-1.5"
              >
                {probingService === "Adobe" ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <GraduationCap className="w-3 h-3 text-blue-400" />
                )}
                <span>Probe Adobe (64% Off Student)</span>
              </button>

              <button
                type="button"
                disabled={probingService !== null}
                onClick={() => handleProbe("GitHub", 19.0)}
                className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 text-xs font-medium transition-all flex items-center gap-1.5"
              >
                <span>Probe GitHub Copilot (100% Free)</span>
              </button>
            </>
          )}

          {activePersona === "DEVELOPER_SMB" && (
            <>
              <button
                type="button"
                disabled={probingService !== null}
                onClick={() => handleProbe("ChatGPT", 20.0)}
                className="px-2.5 py-1.5 rounded-lg bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-600/40 text-xs font-medium transition-all flex items-center gap-1.5"
              >
                {probingService === "ChatGPT" ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <Code2 className="w-3 h-3 text-amber-400" />
                )}
                <span>Probe ChatGPT Plus (SAVE20 Coupon)</span>
              </button>

              <button
                type="button"
                disabled={probingService !== null}
                onClick={() => handleProbe("AWS", 84.5)}
                className="px-2.5 py-1.5 rounded-lg bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-600/40 text-xs font-medium transition-all flex items-center gap-1.5"
              >
                <span>Probe AWS Savings Plan (28% Arbitrage)</span>
              </button>
            </>
          )}
        </div>

        {/* Live In-App Savings Advisory Card Rendering */}
        {activeAdvisory && (
          <div className="pt-2">
            <SavingsAdvisoryCard
              advisory={activeAdvisory}
              onApplyPayment={handleApplyDiscountPayment}
              onDismiss={() => setActiveAdvisory(null)}
            />
          </div>
        )}
      </div>

      {/* Deals Catalog Grid */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-neutral-300">
            Available Programs for {activePersona === "STARTUP_FOUNDER" ? "Startups & Founders" : activePersona === "STUDENT" ? "Students & Academics" : "Developers & SMBs"} ({filteredDeals.length})
          </span>
          <span className="text-[10px] text-neutral-500 font-mono">
            Zero-Knowledge Verification • PayPal MCP Integrated
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredDeals.map((deal) => (
            <div
              key={deal.id}
              className="p-3.5 rounded-xl border border-neutral-800 bg-neutral-900/60 flex flex-col justify-between space-y-3 hover:border-neutral-700 transition-colors shadow-xs"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-white">{deal.service}</span>
                    <Badge variant="outline" className="text-[9px] border-emerald-500/40 text-emerald-300 bg-emerald-500/10 font-mono">
                      {deal.badge}
                    </Badge>
                  </div>
                  {deal.couponCode && (
                    <Badge variant="outline" className="text-[9px] border-amber-500/40 text-amber-300 font-mono">
                      {deal.couponCode}
                    </Badge>
                  )}
                </div>

                <h4 className="text-xs font-bold text-emerald-300 leading-snug">
                  {deal.headline}
                </h4>

                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  {deal.description}
                </p>

                <div className="text-[10px] text-neutral-500 pt-1 border-t border-neutral-800 flex items-center justify-between font-mono">
                  <span>Regular: ${deal.regularPrice.toFixed(2)}/mo</span>
                  <span className="text-emerald-400 font-bold">
                    {deal.discountedPrice === 0 ? "100% Free / $0" : `Discounted: $${deal.discountedPrice.toFixed(2)}/mo`}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <a
                  href={deal.claimUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-1 px-2.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium flex items-center justify-center gap-1.5 border border-neutral-700 transition-colors text-center"
                >
                  <ExternalLink className="w-3 h-3 text-emerald-400" />
                  <span>Claim Portal</span>
                </a>

                <button
                  type="button"
                  onClick={() => {
                    if (onDeployPlanMandate) {
                      onDeployPlanMandate(
                        deal.service,
                        deal.discountedPrice,
                        `${deal.service} (${deal.badge})`
                      );
                    }
                  }}
                  className="flex-1 py-1 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                >
                  <CreditCard className="w-3 h-3" />
                  <span>Deploy Mandate</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
