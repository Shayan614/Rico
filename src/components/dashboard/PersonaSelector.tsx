"use client";

import React from "react";
import type { UserPersona } from "@/lib/savings/types";
import { Rocket, GraduationCap, Code2, Check } from "lucide-react";

interface PersonaSelectorProps {
  activePersona: UserPersona;
  onSelectPersona: (persona: UserPersona) => void;
  variant?: "compact" | "full";
}

export function PersonaSelector({
  activePersona,
  onSelectPersona,
  variant = "compact",
}: PersonaSelectorProps) {
  const personas: Array<{
    id: UserPersona;
    label: string;
    icon: React.ReactNode;
    subtitle: string;
    perkHighlight: string;
    colorClasses: string;
  }> = [
    {
      id: "STARTUP_FOUNDER",
      label: "Startup Founder",
      icon: <Rocket className="w-3.5 h-3.5 text-emerald-400" />,
      subtitle: "$50k PostHog + $1k Notion",
      perkHighlight: "$50,000+ in SaaS Credits",
      colorClasses: "border-emerald-500/40 text-emerald-300 bg-emerald-950/40",
    },
    {
      id: "STUDENT",
      label: "Student Profile",
      icon: <GraduationCap className="w-3.5 h-3.5 text-blue-400" />,
      subtitle: "50% Spotify + Free Copilot",
      perkHighlight: "50% - 100% Student Perks",
      colorClasses: "border-blue-500/40 text-blue-300 bg-blue-950/40",
    },
    {
      id: "DEVELOPER_SMB",
      label: "Developer / SMB",
      icon: <Code2 className="w-3.5 h-3.5 text-amber-400" />,
      subtitle: "Active Coupons & Arbitrage",
      perkHighlight: "Live Coupons & Annual Arbitrage",
      colorClasses: "border-amber-500/40 text-amber-300 bg-amber-950/40",
    },
  ];

  if (variant === "compact") {
    return (
      <div className="flex items-center gap-1 bg-neutral-900 border border-neutral-800 rounded-lg p-0.5 text-xs">
        {personas.map((p) => {
          const isSelected = activePersona === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelectPersona(p.id)}
              className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 font-medium ${
                isSelected
                  ? "bg-neutral-800 text-white shadow-xs border border-neutral-700"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
              title={`${p.label}: ${p.perkHighlight}`}
            >
              {p.icon}
              <span className="hidden sm:inline">{p.label}</span>
              {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {personas.map((p) => {
        const isSelected = activePersona === p.id;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelectPersona(p.id)}
            className={`p-3.5 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
              isSelected
                ? `${p.colorClasses} ring-2 ring-emerald-500/40 shadow-md`
                : "border-neutral-800 bg-neutral-900/60 hover:bg-neutral-900 text-neutral-300"
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-neutral-800 flex items-center justify-center shrink-0">
                    {p.icon}
                  </div>
                  <span className="font-bold text-xs text-white">{p.label}</span>
                </div>
                {isSelected && (
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs">
                    <Check className="w-3 h-3" />
                  </span>
                )}
              </div>
              <p className="text-[11px] text-neutral-400 leading-relaxed">{p.subtitle}</p>
            </div>

            <div className="mt-2.5 pt-2 border-t border-neutral-800/80 flex items-center justify-between text-[10px] font-mono">
              <span className="text-neutral-400">Target Perk:</span>
              <span className="font-semibold text-emerald-400">{p.perkHighlight}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
