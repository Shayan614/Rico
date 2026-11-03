"use client";

import React, { useState, useEffect } from "react";
import {
  CreditCard,
  ShieldCheck,
  TrendingDown,
  Plus,
  Activity,
  CheckCircle2,
  AlertCircle,
  Table as TableIcon,
  Monitor,
  Bot,
  Sparkles,
} from "lucide-react";
import { Mandate, Transaction, AuditLog } from "./FinancialDashboard";
import { ReceiptData } from "./ReceiptDialog";
import { AgGridMandatesTable } from "./AgGridMandatesTable";
import { AgGridTransactionsTable } from "./AgGridTransactionsTable";
import { LiveBrowserViewport } from "./LiveBrowserViewport";
import { PriceSentinelPanel } from "./PriceSentinelPanel";
import { PersonaSavingsPanel } from "./PersonaSavingsPanel";
import { ApprovalRequest } from "./ApprovalDialog";
import { useTheme } from "next-themes";
import { Badge } from "@/components/ui/badge";

interface WorkSurfaceProps {
  mandates: Mandate[];
  transactions: Transaction[];
  auditLogs: AuditLog[];
  onTriggerMandate: (id: string) => void;
  onViewReceipt: (receipt: ReceiptData) => void;
  onCreateMandateClick: () => void;
  onDeployPlanMandate?: (service: string, price: number, planName: string) => void;
  approvalRequest?: ApprovalRequest | null;
  onApproveApproval?: (fundingSource?: "PAYPAL" | "BACKUP_CARD") => void;
  onRejectApproval?: () => void;
  onRefreshData?: () => void;
}

export function WorkSurface({
  mandates,
  transactions,
  auditLogs,
  onTriggerMandate,
  onViewReceipt,
  onCreateMandateClick,
  onDeployPlanMandate,
  approvalRequest,
  onApproveApproval,
  onRejectApproval,
  onRefreshData,
}: WorkSurfaceProps) {
  const [activeTab, setActiveTab] = useState<
    "viewport" | "savings" | "sentinel" | "mandates" | "transactions" | "audit"
  >("viewport");

  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDarkMode = mounted
    ? resolvedTheme === "dark" || theme === "dark"
    : false;

  const totalDisbursed = transactions
    .filter((t) => t.status === "COMPLETED")
    .reduce((acc, curr) => acc + curr.amount, 0);

  const blockedCount = auditLogs.filter(
    (l) => l.eventType === "GUARDRAIL_BLOCKED"
  ).length;

  return (
    <div className="h-full flex flex-col bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 overflow-hidden transition-colors">
      {/* Top Tab Bar & Actions */}
      <div className="h-11 px-4 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/40 flex items-center justify-between select-none shrink-0">
        <div className="flex items-center space-x-1">
          <button
            type="button"
            onClick={() => setActiveTab("viewport")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
              activeTab === "viewport"
                ? "bg-white dark:bg-neutral-800 text-blue-600 dark:text-blue-400 shadow-xs border border-blue-500/30"
                : "text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Live Viewport</span>
            {approvalRequest ? (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-black text-[9px] font-bold font-mono animate-pulse">
                Needs You
              </span>
            ) : (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("savings")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
              activeTab === "savings"
                ? "bg-white dark:bg-neutral-800 text-emerald-600 dark:text-emerald-400 shadow-xs border border-emerald-500/30"
                : "text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
            <span>Savings &amp; Credits</span>
            <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 text-[9px] font-mono font-bold">
              $50k+
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("sentinel")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
              activeTab === "sentinel"
                ? "bg-white dark:bg-neutral-800 text-sky-600 dark:text-sky-400 shadow-xs border border-sky-500/30"
                : "text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>Price Sentinel</span>
            <span className="px-1.5 py-0.2 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-300 text-[9px] font-mono font-bold">
              24/7
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("mandates")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
              activeTab === "mandates"
                ? "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-xs border border-neutral-200 dark:border-neutral-700"
                : "text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
            }`}
          >
            <span>Spending Rules</span>
            <Badge
              variant="outline"
              className="text-[9px] py-0 px-1 border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-900"
            >
              {mandates.length}
            </Badge>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("transactions")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
              activeTab === "transactions"
                ? "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-xs border border-neutral-200 dark:border-neutral-700"
                : "text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
            }`}
          >
            <span>Transactions</span>
            <Badge
              variant="outline"
              className="text-[9px] py-0 px-1 border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-900"
            >
              {transactions.length}
            </Badge>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("audit")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
              activeTab === "audit"
                ? "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-xs border border-neutral-200 dark:border-neutral-700"
                : "text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
            }`}
          >
            <span>Activity Log</span>
            <Badge
              variant="outline"
              className="text-[9px] py-0 px-1 border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-900"
            >
              {auditLogs.length}
            </Badge>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="hidden sm:inline-flex text-[9px] py-0.5 px-2 border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-mono items-center gap-1.5"
            title="Dual-Rail: Primary PayPal Wallet with Vaulted Visa & Mastercard Auto-Cascade"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Dual-Rail: PayPal + Visa/MC Vault
          </Badge>

          <Badge
            variant="outline"
            className="hidden md:inline-flex text-[9px] py-0 px-1.5 border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300 font-mono items-center gap-1"
          >
            <TableIcon className="w-2.5 h-2.5" />
            AG Grid UI Active
          </Badge>

          <button
            type="button"
            onClick={onCreateMandateClick}
            className="h-7 px-2.5 rounded-md bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200 text-xs font-medium flex items-center gap-1 transition-colors shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Spending Rule</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 p-3 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/20 shrink-0 text-xs">
        <div className="p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 text-[11px] mb-1">
            <span>Spending Rules</span>
            <CreditCard className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
            {mandates.filter((m) => m.status === "ACTIVE").length}
          </div>
          <span className="text-[10px] text-neutral-500">Autonomous rules</span>
        </div>

        <div className="p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 text-[11px] mb-1">
            <span>Total Captured</span>
            <TrendingDown className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
            ${totalDisbursed.toFixed(2)}
          </div>
          <span className="text-[10px] text-neutral-500">PayPal Sandbox MCP</span>
        </div>

        <div className="p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 text-[11px] mb-1">
            <span>Safety Intercepts</span>
            <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
            {blockedCount}
          </div>
          <span className="text-[10px] text-neutral-500">Ceilings enforced</span>
        </div>

        <div className="p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 text-[11px] mb-1">
            <span>Avg Reasoning Time</span>
            <Activity className="w-3.5 h-3.5 text-purple-500" />
          </div>
          <div className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
            1.18s
          </div>
          <span className="text-[10px] text-neutral-500">CDP + Gemini Flash</span>
        </div>
      </div>

      {/* Main Grid Content Area */}
      <div className="flex-1 overflow-hidden p-3">
        {activeTab === "viewport" && (
          <LiveBrowserViewport
            onPlanSelected={(service, price, planName) => {
              if (onDeployPlanMandate) {
                onDeployPlanMandate(service, price, planName);
              }
            }}
            approvalRequest={approvalRequest}
            onApproveApproval={onApproveApproval}
            onRejectApproval={onRejectApproval}
          />
        )}

        {activeTab === "savings" && (
          <PersonaSavingsPanel
            onDeployPlanMandate={onDeployPlanMandate}
            onRefreshData={onRefreshData}
          />
        )}

        {activeTab === "sentinel" && (
          <PriceSentinelPanel
            mandates={mandates}
            onRefreshData={onRefreshData}
          />
        )}

        {activeTab === "mandates" && (
          <AgGridMandatesTable
            mandates={mandates}
            onTriggerMandate={onTriggerMandate}
            isDarkMode={isDarkMode}
          />
        )}

        {activeTab === "transactions" && (
          <AgGridTransactionsTable
            transactions={transactions}
            onViewReceipt={onViewReceipt}
            isDarkMode={isDarkMode}
          />
        )}

        {activeTab === "audit" && (
          <div className="h-full overflow-y-auto space-y-2 pr-1">
            {auditLogs.map((log) => (
              <div
                key={log.id}
                className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 flex items-start justify-between gap-3 text-xs shadow-xs"
              >
                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center shrink-0 mt-0.5">
                    {log.severity === "danger" || log.severity === "warning" ? (
                      <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                        {log.service}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[9px] font-mono py-0 px-1 border-neutral-200 dark:border-neutral-700"
                      >
                        {log.eventType}
                      </Badge>
                    </div>
                    <p className="text-neutral-600 dark:text-neutral-400 mt-1 leading-relaxed text-[11px]">
                      {log.details}
                    </p>
                  </div>
                </div>

                <div className="text-[10px] text-neutral-400 dark:text-neutral-500 font-mono whitespace-nowrap">
                  {log.timestamp}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
