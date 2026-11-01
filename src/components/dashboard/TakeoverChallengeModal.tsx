"use client";

import React, { useState } from "react";
import {
  ShieldCheck,
  CheckCircle2,
  Lock,
  Smartphone,
  RefreshCw,
  Sparkles,
  Bot,
  UserCheck,
  X,
} from "lucide-react";

interface TakeoverChallengeModalProps {
  challengeType: "CLOUDFLARE_TURNSTILE" | "TWO_FACTOR_SMS" | "RECAPTCHA";
  serviceName?: string;
  onSolved: () => void;
  onCancel: () => void;
}

export function TakeoverChallengeModal({
  challengeType,
  serviceName = "Merchant Checkout",
  onSolved,
  onCancel,
}: TakeoverChallengeModalProps) {
  // Cloudflare Turnstile state
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // 2FA SMS Code state
  const [smsCode, setSmsCode] = useState("");
  const [smsError, setSmsError] = useState(false);

  const handleTurnstileClick = () => {
    if (isVerifying || isSuccess) return;
    setIsVerifying(true);

    setTimeout(() => {
      setIsVerifying(false);
      setIsSuccess(true);

      setTimeout(() => {
        onSolved();
      }, 1200);
    }, 1000);
  };

  const handleSmsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (smsCode.trim() === "492026" || smsCode.length === 6) {
      setIsSuccess(true);
      setTimeout(() => {
        onSolved();
      }, 1200);
    } else {
      setSmsError(true);
    }
  };

  const handleAutofillSms = () => {
    setSmsCode("492026");
    setSmsError(false);
    setIsSuccess(true);
    setTimeout(() => {
      onSolved();
    }, 1200);
  };

  return (
    <div className="absolute inset-0 z-50 bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-neutral-900 border-2 border-amber-500/80 rounded-2xl shadow-2xl p-5 space-y-4 font-sans select-none relative">
        {/* Close / Cancel Button */}
        <button
          type="button"
          onClick={onCancel}
          className="absolute top-3.5 right-3.5 p-1 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          title="Exit Takeover Challenge"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Badge */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400">
            <UserCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                Live Human Intervention Required
              </span>
            </div>
            <h3 className="text-sm font-bold text-white mt-0.5">
              {challengeType === "CLOUDFLARE_TURNSTILE"
                ? "Cloudflare Bot Defense Check"
                : "2-Factor SMS Verification Challenge"}
            </h3>
          </div>
        </div>

        <p className="text-xs text-neutral-400 leading-relaxed">
          {challengeType === "CLOUDFLARE_TURNSTILE"
            ? `${serviceName} triggered an anti-bot challenge. Complete the verification below to hand control back to Rico.`
            : `A temporary security challenge was triggered. Complete the human verification below so the agent can resume checkout.`}
        </p>

        {/* Challenge Widget Body */}
        {challengeType === "CLOUDFLARE_TURNSTILE" ? (
          <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-3">
            <div
              onClick={handleTurnstileClick}
              className={`p-3.5 rounded-lg border flex items-center justify-between cursor-pointer transition-all ${
                isSuccess
                  ? "bg-emerald-950/30 border-emerald-500/60"
                  : "bg-neutral-900 border-neutral-700 hover:border-neutral-500"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-6 h-6 rounded-md border flex items-center justify-center transition-colors ${
                    isSuccess
                      ? "bg-emerald-600 border-emerald-400 text-white"
                      : isVerifying
                      ? "bg-neutral-800 border-blue-400 text-blue-400"
                      : "bg-neutral-800 border-neutral-600"
                  }`}
                >
                  {isSuccess ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : isVerifying ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : null}
                </div>
                <span className="text-xs font-medium text-neutral-200">
                  {isSuccess
                    ? "Success! Human verified."
                    : isVerifying
                    ? "Verifying interaction..."
                    : "Verify you are human"}
                </span>
              </div>

              {/* Cloudflare Logo Mock */}
              <div className="flex flex-col items-end text-[9px] text-neutral-500 font-mono">
                <div className="flex items-center gap-1 font-bold text-neutral-400">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                  <span>Cloudflare</span>
                </div>
                <span>Privacy • Terms</span>
              </div>
            </div>

            {isSuccess && (
              <div className="p-2 rounded bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs font-mono flex items-center gap-2 animate-in fade-in">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span>Verified! Returning control to Rico agent...</span>
              </div>
            )}
          </div>
        ) : (
          /* 2FA SMS Challenge Form */
          <form onSubmit={handleSmsSubmit} className="space-y-3">
            <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2">
              <div className="flex items-center justify-between text-xs text-neutral-400">
                <span className="flex items-center gap-1">
                  <Smartphone className="w-3.5 h-3.5 text-blue-400" />
                  <span>SMS Code sent to (•••) •••-4921</span>
                </span>
                <span className="font-mono text-emerald-400">PayPal 2FA</span>
              </div>

              <input
                type="text"
                maxLength={6}
                value={smsCode}
                onChange={(e) => {
                  setSmsCode(e.target.value);
                  setSmsError(false);
                }}
                placeholder="492026"
                className="w-full text-center tracking-[0.4em] font-mono text-lg py-2 rounded-lg bg-neutral-900 border border-neutral-700 focus:border-blue-500 text-white focus:outline-none"
              />

              {smsError && (
                <p className="text-[11px] text-red-400 font-mono">
                  Invalid code. Try entering 492026 or click autofill below.
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAutofillSms}
                className="flex-1 py-1.5 px-3 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium border border-neutral-700 flex items-center justify-center gap-1 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                <span>Auto-fill Demo Code (492026)</span>
              </button>

              <button
                type="submit"
                disabled={isSuccess || smsCode.length < 4}
                className="py-1.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Verify</span>
              </button>
            </div>
          </form>
        )}

        {/* Footer info banner */}
        <div className="pt-2 border-t border-neutral-800 flex items-center justify-between text-[11px] text-neutral-500 font-mono">
          <span className="flex items-center gap-1">
            <Bot className="w-3.5 h-3.5 text-purple-400" />
            <span>Zero Workflow Failure Guarantee</span>
          </span>
          <span className="flex items-center gap-1">
            <Lock className="w-3 h-3 text-emerald-400" />
            <span>Encrypted Session</span>
          </span>
        </div>
      </div>
    </div>
  );
}
