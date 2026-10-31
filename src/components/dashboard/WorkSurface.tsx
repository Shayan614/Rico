"use client";

import React, { useState } from "react";
import {
  CreditCard,
  ShieldCheck,
  TrendingDown,
  Plus,
  Play,
  FileText,
  Activity,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Mandate, Transaction, AuditLog } from "./FinancialDashboard";
import { ReceiptData } from "./ReceiptDialog";

interface WorkSurfaceProps {
  mandates: Mandate[];
  transactions: Transaction[];
  auditLogs: AuditLog[];
  onTriggerMandate: (id: string) => void;
  onViewReceipt: (receipt: ReceiptData) => void;
  onCreateMandateClick: () => void;
}

export function WorkSurface({
  mandates,
  transactions,
  auditLogs,
  onTriggerMandate,
  onViewReceipt,
  onCreateMandateClick,
}: WorkSurfaceProps) {
  const [activeTab, setActiveTab] = useState<
    "mandates" | "transactions" | "audit"
  >("mandates");
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);

  const totalDisbursed = transactions
    .filter((t) => t.status === "COMPLETED")
    .reduce((acc, curr) => acc + curr.amount, 0);

  const blockedCount = auditLogs.filter(
    (l) => l.eventType === "GUARDRAIL_BLOCKED"
  ).length;

  const handleCopy = (text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedOrderId(text);
    setTimeout(() => setCopiedOrderId(null), 2000);
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 overflow-hidden transition-colors">
      {/* Top Tab Bar */}
      <div className="h-10 px-4 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 flex items-center justify-between select-none shrink-0">
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setActiveTab("mandates")}
            className={`px-3 py-1.5 text-xs font-medium rounded-t border-b-2 transition-colors ${
              activeTab === "mandates"
                ? "border-neutral-900 dark:border-neutral-100 text-neutral-900 dark:text-neutral-100 bg-white dark:bg-neutral-900"
                : "border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
            }`}
          >
            Mandates ({mandates.length})
          </button>
          <button
            onClick={() => setActiveTab("transactions")}
            className={`px-3 py-1.5 text-xs font-medium rounded-t border-b-2 transition-colors ${
              activeTab === "transactions"
                ? "border-neutral-900 dark:border-neutral-100 text-neutral-900 dark:text-neutral-100 bg-white dark:bg-neutral-900"
                : "border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
            }`}
          >
            Transactions ({transactions.length})
          </button>
          <button
            onClick={() => setActiveTab("audit")}
            className={`px-3 py-1.5 text-xs font-medium rounded-t border-b-2 transition-colors ${
              activeTab === "audit"
                ? "border-neutral-900 dark:border-neutral-100 text-neutral-900 dark:text-neutral-100 bg-white dark:bg-neutral-900"
                : "border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
            }`}
          >
            Activity ({auditLogs.length})
          </button>
        </div>

        <button
          onClick={onCreateMandateClick}
          className="h-6 px-2.5 rounded bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200 text-xs font-medium flex items-center gap-1 transition-colors"
        >
          <Plus className="w-3 h-3" />
          <span>New Mandate</span>
        </button>
      </div>

      {/* KPI Cards (Minimalist Two-Tone) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 p-3 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/20 shrink-0 text-xs">
        <div className="p-2.5 rounded border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 text-[11px] mb-1">
            <span>Active Mandates</span>
            <CreditCard className="w-3.5 h-3.5" />
          </div>
          <div className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
            {mandates.filter((m) => m.status === "ACTIVE").length}
          </div>
          <span className="text-[10px] text-neutral-500">Autonomous rules</span>
        </div>

        <div className="p-2.5 rounded border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 text-[11px] mb-1">
            <span>Total Executed</span>
            <TrendingDown className="w-3.5 h-3.5" />
          </div>
          <div className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
            ${totalDisbursed.toFixed(2)}
          </div>
          <span className="text-[10px] text-neutral-500">Captured orders</span>
        </div>

        <div className="p-2.5 rounded border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 text-[11px] mb-1">
            <span>Safety Intercepts</span>
            <ShieldCheck className="w-3.5 h-3.5" />
          </div>
          <div className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
            {blockedCount}
          </div>
          <span className="text-[10px] text-neutral-500">Ceilings enforced</span>
        </div>

        <div className="p-2.5 rounded border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 text-[11px] mb-1">
            <span>Avg Latency</span>
            <Activity className="w-3.5 h-3.5" />
          </div>
          <div className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
            1.18s
          </div>
          <span className="text-[10px] text-neutral-500">Decision time</span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "mandates" && (
          <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
            <div className="grid grid-cols-12 px-4 py-2 text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900/80 sticky top-0 border-b border-neutral-200 dark:border-neutral-800">
              <span className="col-span-4">Service & Category</span>
              <span className="col-span-2">Ceiling Cap</span>
              <span className="col-span-2">Verified Price</span>
              <span className="col-span-2">Schedule</span>
              <span className="col-span-2 text-right">Action</span>
            </div>

            {mandates.map((m) => (
              <div
                key={m.id}
                className="grid grid-cols-12 px-4 py-3 text-xs items-center hover:bg-neutral-50 dark:hover:bg-neutral-900/40 transition-colors"
              >
                <div className="col-span-4 flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center font-bold text-xs text-neutral-900 dark:text-neutral-100">
                    {m.service.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                      {m.service}
                    </div>
                    <div className="text-[10px] text-neutral-500">
                      {m.category}
                    </div>
                  </div>
                </div>

                <div className="col-span-2 font-semibold text-neutral-800 dark:text-neutral-200">
                  ${m.budgetCeiling.toFixed(2)} {m.currency}
                </div>

                <div className="col-span-2">
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                    ${m.lastScrapedPrice.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-neutral-500 block">
                    Verified
                  </span>
                </div>

                <div className="col-span-2 text-neutral-700 dark:text-neutral-300">
                  <div>{m.recurrence}</div>
                  <div className="text-[10px] text-neutral-500">{m.nextRun}</div>
                </div>

                <div className="col-span-2 text-right">
                  <button
                    onClick={() => onTriggerMandate(m.id)}
                    className="px-2.5 py-1 rounded border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-900 hover:text-white dark:hover:bg-neutral-100 dark:hover:text-neutral-900 text-neutral-800 dark:text-neutral-200 text-[11px] inline-flex items-center gap-1 transition-colors"
                  >
                    <Play className="w-3 h-3" />
                    <span>Run</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "transactions" && (
          <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
            <div className="grid grid-cols-12 px-4 py-2 text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900/80 sticky top-0 border-b border-neutral-200 dark:border-neutral-800">
              <span className="col-span-4">Order ID & Merchant</span>
              <span className="col-span-2">Amount</span>
              <span className="col-span-2">Status</span>
              <span className="col-span-2">Timestamp</span>
              <span className="col-span-2 text-right">Receipt</span>
            </div>

            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="grid grid-cols-12 px-4 py-3 text-xs items-center hover:bg-neutral-50 dark:hover:bg-neutral-900/40 transition-colors"
              >
                <div className="col-span-4">
                  <div className="flex items-center gap-1.5 font-mono text-neutral-600 dark:text-neutral-400 text-[11px]">
                    <span>{tx.orderId}</span>
                    <button
                      onClick={() => handleCopy(tx.orderId)}
                      className="text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
                    >
                      {copiedOrderId === tx.orderId ? (
                        <Check className="w-3 h-3 text-neutral-900 dark:text-neutral-100" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                  <div className="text-neutral-900 dark:text-neutral-100 font-medium">
                    {tx.service}
                  </div>
                </div>

                <div className="col-span-2 font-bold text-neutral-900 dark:text-neutral-100">
                  ${tx.amount.toFixed(2)} {tx.currency}
                </div>

                <div className="col-span-2">
                  <span className="px-2 py-0.5 rounded border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 text-[10px] font-medium">
                    {tx.status}
                  </span>
                </div>

                <div className="col-span-2 text-neutral-500 text-[11px]">
                  {tx.timestamp}
                </div>

                <div className="col-span-2 text-right">
                  {tx.receiptData && (
                    <button
                      onClick={() => onViewReceipt(tx.receiptData!)}
                      className="px-2 py-1 rounded text-[11px] text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors inline-flex items-center gap-1"
                    >
                      <FileText className="w-3 h-3" />
                      <span>Details</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "audit" && (
          <div className="p-3 space-y-2.5">
            {auditLogs.map((log) => (
              <div
                key={log.id}
                className="p-3 rounded border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/40 flex items-start justify-between gap-3 text-xs"
              >
                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center shrink-0 mt-0.5">
                    {log.severity === "danger" || log.severity === "warning" ? (
                      <AlertCircle className="w-3.5 h-3.5 text-neutral-800 dark:text-neutral-200" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 text-neutral-800 dark:text-neutral-200" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                        {log.service}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 text-[10px] text-neutral-700 dark:text-neutral-300 font-mono">
                        {log.eventType}
                      </span>
                    </div>
                    <p className="text-neutral-600 dark:text-neutral-400 mt-1 leading-relaxed">
                      {log.details}
                    </p>
                  </div>
                </div>

                <div className="text-[10px] text-neutral-500 whitespace-nowrap">
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
