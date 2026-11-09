"use client";

import React, { useState, useEffect } from "react";
import {
  Bot,
  CheckCircle2,
  CreditCard,
  XCircle,
  RefreshCw,
  Smartphone,
  MessageSquare,
  ShieldAlert,
  Zap,
  Sparkles,
  Activity,
  History,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Mandate } from "./FinancialDashboard";

interface PriceSentinelPanelProps {
  mandates: Mandate[];
  onRefreshData?: () => void;
}

interface SentinelStats {
  monitoringMode: "scheduled" | "awaiting_run" | "manual_only";
  lastScheduledRunAt: string | null;
  telegramMode: string;
  intervalMinutes: number;
  totalAuditsRun: number;
  anomaliesDetected: number;
  savingsIdentified: number;
  lastRunAt: string | null;
  pendingAlertsCount: number;
}

export function PriceSentinelPanel({
  mandates,
  onRefreshData,
}: PriceSentinelPanelProps) {
  const [stats, setStats] = useState<SentinelStats>({
    monitoringMode: "manual_only",
    lastScheduledRunAt: null,
    telegramMode: "SIMULATED_MOCK",
    intervalMinutes: 1440,
    totalAuditsRun: 0,
    anomaliesDetected: 0,
    savingsIdentified: 0,
    lastRunAt: "Not run yet",
    pendingAlertsCount: 0,
  });

  const monitoringLabel = {
    scheduled: { badge: "SCHEDULED", status: "Scheduled (daily)" },
    awaiting_run: { badge: "NO RECENT SCHEDULED RUN", status: "Configured, no recent run" },
    manual_only: { badge: "MANUAL ONLY", status: "Manual only" },
  }[stats.monitoringMode];

  const [activeChannel, setActiveChannel] = useState<"telegram" | "whatsapp" | "slack">("telegram");
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [runningAudit, setRunningAudit] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Default demo spike values matching the canonical Miro Board frame
  const [demoAlert, setDemoAlert] = useState({
    mandateId: "mandate-adobe-cc",
    service: "Adobe Creative Cloud",
    oldPrice: 35.0,
    newPrice: 54.99,
    jumpPercent: 57,
    budgetCeiling: 40.0,
    status: "PENDING" as "PENDING" | "APPROVED" | "BACKUP_PAID" | "CANCELLED",
  });

  // Sync with real mandates if an Adobe or active mandate exists
  useEffect(() => {
    const adobe = mandates.find((m) =>
      m.service.toLowerCase().includes("adobe")
    );
    if (adobe) {
      setDemoAlert((prev) => ({
        ...prev,
        mandateId: adobe.id,
        budgetCeiling: adobe.budgetCeiling,
        oldPrice: adobe.lastScrapedPrice > 0 ? adobe.lastScrapedPrice : 35.0,
      }));
    } else if (mandates.length > 0) {
      const first = mandates[0];
      setDemoAlert((prev) => ({
        ...prev,
        mandateId: first.id,
        service: first.service,
        budgetCeiling: first.budgetCeiling,
        oldPrice: first.lastScrapedPrice > 0 ? first.lastScrapedPrice : first.budgetCeiling * 0.8,
      }));
    }
  }, [mandates]);

  const fetchSentinelStatus = async () => {
    try {
      const res = await fetch("/api/sentinel/status");
      if (res.ok) {
        const data = await res.json();
        if (data.sentinel) {
          setStats((prev) => ({
            ...prev,
            monitoringMode: data.sentinel.monitoring?.mode ?? "manual_only",
            lastScheduledRunAt: data.sentinel.monitoring?.lastScheduledRunAt ?? null,
            telegramMode: data.sentinel.channels?.telegram?.mode ?? "SIMULATED_MOCK",
            totalAuditsRun: data.sentinel.totalAuditsRun || prev.totalAuditsRun,
            anomaliesDetected: data.sentinel.anomaliesDetected || prev.anomaliesDetected,
            savingsIdentified: data.sentinel.savingsIdentified || prev.savingsIdentified,
            lastRunAt: data.sentinel.lastRunAt || prev.lastRunAt,
            pendingAlertsCount: data.sentinel.pendingAlertsCount ?? prev.pendingAlertsCount,
          }));
        }
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchSentinelStatus();
  }, []);

  const handleRemoteButtonAction = async (action: "approve" | "backup_card" | "cancel") => {
    setLoadingAction(action);
    setActionSuccessMsg(null);

    try {
      // Find actual mandate id from mandates or use the demo id
      let targetMandateId = demoAlert.mandateId;
      const matched = mandates.find(
        (m) =>
          m.id === targetMandateId ||
          m.service.toLowerCase().includes(demoAlert.service.toLowerCase().slice(0, 5))
      );
      if (matched) {
        targetMandateId = matched.id;
      }

      const res = await fetch("/api/sentinel/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          mandateId: targetMandateId,
          price: demoAlert.newPrice,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setDemoAlert((prev) => ({
          ...prev,
          status:
            action === "approve"
              ? "APPROVED"
              : action === "backup_card"
              ? "BACKUP_PAID"
              : "CANCELLED",
        }));
        setActionSuccessMsg(data.result.message);
        if (onRefreshData) onRefreshData();
        fetchSentinelStatus();
      } else {
        setActionSuccessMsg(`Error: ${data.error || "Action execution failed"}`);
      }
    } catch (err) {
      setActionSuccessMsg(`Network error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleTriggerAudit = async (forceSpike: boolean = false) => {
    setRunningAudit(true);
    setActionSuccessMsg(null);
    try {
      const res = await fetch("/api/sentinel/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          forceSpike,
          service: forceSpike ? "Adobe" : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.summary) {
        setStats((prev) => ({
          ...prev,
          totalAuditsRun: prev.totalAuditsRun + data.summary.totalAudited,
          anomaliesDetected: prev.anomaliesDetected + data.summary.anomaliesDetected,
          lastRunAt: "Just now",
        }));
        if (forceSpike) {
          setDemoAlert((prev) => ({
            ...prev,
            status: "PENDING",
            newPrice: 54.99,
            jumpPercent: 57,
          }));
        }
        setActionSuccessMsg(data.message);
        if (onRefreshData) onRefreshData();
        fetchSentinelStatus();
      } else {
        setActionSuccessMsg(`Audit failed: ${data.error || "Please try again."}`);
      }
    } catch (err) {
      setActionSuccessMsg(`Audit failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRunningAudit(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-neutral-950 text-neutral-100 overflow-y-auto p-4 space-y-4">
      {/* Header Banner */}
      <div className="p-4 rounded-xl border border-sky-800/50 bg-gradient-to-r from-sky-950/70 via-slate-900 to-sky-950/60 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-md">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-ping" />
            <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <Bot className="w-4 h-4 text-sky-400" />
              Rico — Price Sentinel & Omnichannel Bot Team
            </h2>
            <Badge
              variant="outline"
              className="text-[10px] py-0 px-1.5 border-sky-400/40 text-sky-300 bg-sky-500/10 font-mono"
            >
              {monitoringLabel.badge}
            </Badge>
          </div>
          <p className="text-xs text-sky-200/80 mt-1">
            Price audits on demand or from an external daily scheduler, with Telegram alerts when a bot is connected
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={runningAudit}
            onClick={() => handleTriggerAudit(false)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-sky-600 hover:bg-sky-500 text-white transition-colors flex items-center gap-1.5 shadow-xs disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${runningAudit ? "animate-spin" : ""}`} />
            <span>Run Audit Now</span>
          </button>

          <button
            type="button"
            disabled={runningAudit}
            onClick={() => handleTriggerAudit(true)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-600 hover:bg-amber-500 text-white transition-colors flex items-center gap-1.5 shadow-xs disabled:opacity-50"
            title="Mock mode only: simulates an Adobe Creative Cloud +57% price spike"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Simulate Spike (+57%)</span>
          </button>
        </div>
      </div>

      {/* Sentinel Live Metrics Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 text-xs">
        <div className="p-2.5 rounded-lg border border-neutral-800 bg-neutral-900/60 shadow-xs">
          <div className="flex items-center justify-between text-neutral-400 text-[11px] mb-1">
            <span>Daemon Status</span>
            <Activity className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div className="text-sm font-bold text-sky-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
            {monitoringLabel.status}
          </div>
          <span className="text-[10px] text-neutral-500">
            {stats.lastScheduledRunAt
              ? `Last scheduled run: ${new Date(stats.lastScheduledRunAt).toLocaleString()}`
              : "No scheduled run recorded"}
          </span>
        </div>

        <div className="p-2.5 rounded-lg border border-neutral-800 bg-neutral-900/60 shadow-xs">
          <div className="flex items-center justify-between text-neutral-400 text-[11px] mb-1">
            <span>Total Audits</span>
            <History className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-sm font-bold text-white">
            {stats.totalAuditsRun} checks
          </div>
          <span className="text-[10px] text-neutral-500">Last: {stats.lastRunAt || "Recently"}</span>
        </div>

        <div className="p-2.5 rounded-lg border border-neutral-800 bg-neutral-900/60 shadow-xs">
          <div className="flex items-center justify-between text-neutral-400 text-[11px] mb-1">
            <span>Anomalies Flagged</span>
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-sm font-bold text-amber-400">
            {stats.anomaliesDetected} hold(s)
          </div>
          <span className="text-[10px] text-neutral-500">{stats.pendingAlertsCount} pending approval</span>
        </div>

        <div className="p-2.5 rounded-lg border border-neutral-800 bg-neutral-900/60 shadow-xs">
          <div className="flex items-center justify-between text-neutral-400 text-[11px] mb-1">
            <span>Saved via Sentinel</span>
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-sm font-bold text-emerald-400">
            ${stats.savingsIdentified.toFixed(2)}
          </div>
          <span className="text-[10px] text-neutral-500">Price drop captures</span>
        </div>
      </div>

      {actionSuccessMsg && (
        <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-950/50 text-emerald-200 text-xs flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {/* Main 2-Column Split: Interactive Phone Mockup on Left, Sentinel Daemon Status on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1">
        {/* Left Column: Omnichannel Mobile Interactive Alert (Miro Mockup) */}
        <div className="lg:col-span-6 flex flex-col space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-sky-400" />
              1. Omnichannel Mobile Interactive Alerts (Miro Live Mockup)
            </span>

            {/* Channel Tabs */}
            <div className="flex items-center gap-1 bg-neutral-900 border border-neutral-800 rounded-lg p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setActiveChannel("telegram")}
                className={`px-2 py-0.5 rounded font-medium transition-colors ${
                  activeChannel === "telegram"
                    ? "bg-sky-600 text-white"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                Telegram Bot
              </button>
              <button
                type="button"
                onClick={() => setActiveChannel("whatsapp")}
                className={`px-2 py-0.5 rounded font-medium transition-colors ${
                  activeChannel === "whatsapp"
                    ? "bg-emerald-600 text-white"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                WhatsApp Cloud
              </button>
              <button
                type="button"
                onClick={() => setActiveChannel("slack")}
                className={`px-2 py-0.5 rounded font-medium transition-colors ${
                  activeChannel === "slack"
                    ? "bg-amber-600 text-white"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                Slack Bot
              </button>
            </div>
          </div>

          {/* Telegram Phone Mockup */}
          {activeChannel === "telegram" && (
            <div className="rounded-2xl border-2 border-neutral-800 bg-[#0f172a] p-3 shadow-xl flex flex-col max-w-[390px] mx-auto w-full transition-all">
              {/* Telegram App Header Bar */}
              <div className="rounded-xl bg-[#242f3d] px-3 py-2 flex items-center justify-between mb-3 border border-neutral-700/50">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#0088cc] flex items-center justify-center text-white text-base shadow-xs">
                    🤖
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      Rico Sentinel
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    </div>
                    <div className="text-[10px] text-[#00c0ff]">
                      Telegram preview • {stats.telegramMode === "LIVE_BOT" ? "Bot connected" : "Simulated, nothing sent"}
                    </div>
                  </div>
                </div>
                <Badge className="bg-sky-500/20 text-sky-300 border-none text-[9px]">Verified</Badge>
              </div>

              {/* Telegram Message Bubble */}
              <div className="rounded-xl bg-[#17212b] border border-[#0088cc]/40 p-3.5 space-y-3 shadow-md">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                  <span className="text-xs font-bold text-red-400 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
                    🚨 24h Audit: Price Spike Detected!
                  </span>
                  <span className="text-[10px] text-neutral-400 font-mono">Today, 03:00 AM</span>
                </div>

                <div className="text-xs text-neutral-200 space-y-1 font-sans leading-relaxed">
                  <div>
                    <span className="text-neutral-400">Service:</span>{" "}
                    <strong className="text-white">{demoAlert.service}</strong>
                  </div>
                  <div className="text-[11px] text-neutral-300 space-y-0.5 pl-1 border-l-2 border-neutral-700">
                    <div>
                      • Old Price:{" "}
                      <span className="text-neutral-400 font-mono">
                        ${demoAlert.oldPrice.toFixed(2)} / mo
                      </span>
                    </div>
                    <div>
                      • New Price:{" "}
                      <strong className="text-red-400 font-mono">
                        ${demoAlert.newPrice.toFixed(2)} / mo (+{demoAlert.jumpPercent}%)
                      </strong>
                    </div>
                    <div>
                      • Your Budget Ceiling:{" "}
                      <span className="text-emerald-400 font-mono">
                        ${demoAlert.budgetCeiling.toFixed(2)} / mo
                      </span>
                    </div>
                  </div>

                  <p className="text-[11px] text-amber-300/90 pt-1.5 italic">
                    ⚠️ Payment is on hold. Choose an action:
                  </p>
                </div>

                {/* 3 Interactive Action Buttons (Miro Specifications) */}
                {demoAlert.status === "PENDING" ? (
                  <div className="space-y-2 pt-1">
                    <button
                      type="button"
                      disabled={loadingAction !== null}
                      onClick={() => handleRemoteButtonAction("approve")}
                      className="w-full py-2 px-3 rounded-lg bg-sky-600 hover:bg-sky-500 active:scale-98 text-white font-semibold text-xs transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                    >
                      {loadingAction === "approve" ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                      )}
                      <span>✅ Approve One-Time (${demoAlert.newPrice.toFixed(2)})</span>
                    </button>

                    <button
                      type="button"
                      disabled={loadingAction !== null}
                      onClick={() => handleRemoteButtonAction("backup_card")}
                      className="w-full py-2 px-3 rounded-lg bg-amber-600 hover:bg-amber-500 active:scale-98 text-white font-semibold text-xs transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                    >
                      {loadingAction === "backup_card" ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <CreditCard className="w-3.5 h-3.5 text-white" />
                      )}
                      <span>💳 Pay with Backup Card (Visa)</span>
                    </button>

                    <button
                      type="button"
                      disabled={loadingAction !== null}
                      onClick={() => handleRemoteButtonAction("cancel")}
                      className="w-full py-2 px-3 rounded-lg bg-rose-700 hover:bg-rose-600 active:scale-98 text-white font-semibold text-xs transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                    >
                      {loadingAction === "cancel" ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-white" />
                      )}
                      <span>🛑 1-Click Cancel Subscription</span>
                    </button>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-neutral-900 border border-neutral-700 text-center space-y-1">
                    <div className="text-xs font-bold text-white flex items-center justify-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      Action Completed:{" "}
                      <span className="text-sky-300 font-mono">{demoAlert.status}</span>
                    </div>
                    <p className="text-[10px] text-neutral-400">
                      Webhook dispatched to PayPal MCP server & SQLite updated.
                    </p>
                    <button
                      type="button"
                      onClick={() => setDemoAlert((p) => ({ ...p, status: "PENDING" }))}
                      className="text-[11px] text-sky-400 hover:underline pt-1 inline-block"
                    >
                      Reset Demo Alert
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* WhatsApp Card */}
          {activeChannel === "whatsapp" && (
            <div className="rounded-xl border border-emerald-800 bg-[#075e54]/30 p-4 space-y-3">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                <MessageSquare className="w-4 h-4" />
                <span>WhatsApp Cloud Interactive Quick Replies</span>
              </div>
              <p className="text-[11px] text-amber-300">Planned: only the message format exists. Nothing is sent.</p>
              <ul className="text-xs text-neutral-200 space-y-2 leading-relaxed">
                <li className="flex items-start gap-1.5">
                  <span className="text-emerald-400 font-bold">•</span>
                  <span>
                    <strong>Two-Way Conversational Finance:</strong> Users can text{" "}
                    <em>&quot;What are my payments this week?&quot;</em> or{" "}
                    <em>&quot;Pause Netflix mandate&quot;</em> directly in WhatsApp.
                  </span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-emerald-400 font-bold">•</span>
                  <span>
                    <strong>1-Tap Interactive Buttons:</strong> Quick Replies allow immediate
                    approval or cancellation without opening external browser apps.
                  </span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-emerald-400 font-bold">•</span>
                  <span>
                    <strong>Zero Barrier to Entry:</strong> Reaches 2+ billion users globally
                    where they already communicate daily.
                  </span>
                </li>
              </ul>
            </div>
          )}

          {/* Slack Card */}
          {activeChannel === "slack" && (
            <div className="rounded-xl border border-purple-800 bg-[#1a1d21]/60 p-4 space-y-3">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                <Bot className="w-4 h-4" />
                <span>Slack Enterprise Block Kit Integration</span>
              </div>
              <p className="text-[11px] text-amber-300">Planned: only the message format exists. Nothing is sent.</p>
              <ul className="text-xs text-neutral-200 space-y-2 leading-relaxed">
                <li className="flex items-start gap-1.5">
                  <span className="text-amber-400 font-bold">•</span>
                  <span>
                    <strong>Team &amp; B2B SaaS Tracking:</strong> Automatically pings company
                    finance channels when cloud bills (AWS, Twilio, OpenAI, Snowflake) increase.
                  </span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-amber-400 font-bold">•</span>
                  <span>
                    <strong>Multi-Party Manager Approvals:</strong> Financial managers click
                    &quot;Authorize PayPal Capture&quot; directly in Slack channels.
                  </span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-amber-400 font-bold">•</span>
                  <span>
                    <strong>Real-Time Audit Trail:</strong> Decision logs are published directly to
                    company security/finance audit feeds.
                  </span>
                </li>
              </ul>
            </div>
          )}
        </div>

        {/* Right Column: 24h Background Sentinel Architecture */}
        <div className="lg:col-span-6 flex flex-col space-y-3">
          <span className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            2. Sentinel Audit Flow
          </span>

          {/* 4 Architecture Steps matching Miro Frame */}
          <div className="space-y-2.5">
            {/* Step 1: Cron */}
            <div className="p-3 rounded-xl border border-sky-800/40 bg-neutral-900/60 flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-sky-950 border border-sky-700 flex items-center justify-center text-sky-400 font-mono text-xs font-bold shrink-0">
                1
              </div>
              <div>
                <h4 className="text-xs font-bold text-sky-300">
                  Scheduled Audit Endpoint (Needs an External Daily Scheduler)
                </h4>
                <p className="text-[11px] text-neutral-400 mt-0.5 leading-relaxed">
                  A scheduler or the Run Audit button starts an audit of every active spending rule.
                  Paused and held rules are skipped, and an audit never makes a payment.
                </p>
              </div>
            </div>

            {/* Step 2: Playwright */}
            <div className="p-3 rounded-xl border border-purple-800/40 bg-neutral-900/60 flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-purple-950 border border-purple-700 flex items-center justify-center text-purple-400 font-mono text-xs font-bold shrink-0">
                2
              </div>
              <div>
                <h4 className="text-xs font-bold text-purple-300">
                  Playwright Price Verification
                </h4>
                <p className="text-[11px] text-neutral-400 mt-0.5 leading-relaxed">
                  Headless browser worker visits merchant plan page, inspects current plan prices,
                  and compares against <code>last_scraped_price</code>. If no live price can be read,
                  the rule is reported as unverified and left unchanged.
                </p>
              </div>
            </div>

            {/* Step 3: Anomaly Engine */}
            <div className="p-3 rounded-xl border border-amber-800/40 bg-neutral-900/60 flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-amber-950 border border-amber-700 flex items-center justify-center text-amber-400 font-mono text-xs font-bold shrink-0">
                3
              </div>
              <div>
                <h4 className="text-xs font-bold text-amber-300">
                  Anomaly &amp; Change Detection Engine
                </h4>
                <p className="text-[11px] text-neutral-400 mt-0.5 leading-relaxed">
                  Records price drops and steady prices. A price spike or a price over budget puts the
                  rule on ANOMALY_HOLD and raises an alert.
                </p>
              </div>
            </div>

            {/* Step 4: Webhook & Interactive Callback */}
            <div className="p-3 rounded-xl border border-emerald-800/40 bg-neutral-900/60 flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-emerald-950 border border-emerald-700 flex items-center justify-center text-emerald-400 font-mono text-xs font-bold shrink-0">
                4
              </div>
              <div>
                <h4 className="text-xs font-bold text-emerald-300">
                  Omnichannel Webhook &amp; Interactive Callback
                </h4>
                <p className="text-[11px] text-neutral-400 mt-0.5 leading-relaxed">
                  Sends action buttons to Telegram when a bot is connected. Approving a hold goes through
                  the guarded payment path; cancelling pauses the rule.
                </p>
              </div>
            </div>
          </div>

          {/* Hackathon Prize Impact Box */}
          <div className="p-3 rounded-xl border border-yellow-600/30 bg-yellow-950/20 text-yellow-200 text-xs space-y-1">
            <div className="font-bold text-yellow-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
              🏆 Real-World Industry Impact &amp; Hackathon Value
            </div>
            <p className="text-[11px] text-yellow-100/80 leading-relaxed">
              • <strong>Scheduled Protection:</strong> Daily audits once an external scheduler is
              connected.<br />
              • <strong>Zero App Barrier:</strong> Telegram alerts and buttons, with WhatsApp planned.<br />
              • <strong>Qualifies For:</strong> Best Agentic Commerce ($5,000) and 1st Place Overall
              ($12,000)!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
