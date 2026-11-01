"use client";

import React, { useState } from "react";
import {
  Receipt,
  CheckCircle2,
  Copy,
  Check,
  FileText,
  Download,
  ShieldCheck,
  TrendingDown,
} from "lucide-react";
import { ReceiptData } from "@/components/dashboard/ReceiptDialog";
import { Badge } from "@/components/ui/badge";

interface GenerativeReceiptCardProps {
  receipt: ReceiptData;
  onViewReceipt: (receipt: ReceiptData) => void;
}

export function GenerativeReceiptCard({
  receipt,
  onViewReceipt,
}: GenerativeReceiptCardProps) {
  const [copiedId, setCopiedId] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const handleCopyOrderId = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(receipt.orderId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const handleDownloadReceipt = () => {
    const receiptContent = `==================================================
PAYAGENT — OFFICIAL AUTONOMOUS PAYMENT RECEIPT
PayPal AI Agent Sandbox Verification & Capture
==================================================

Order ID:          ${receipt.orderId}
Transaction Status: ${receipt.status}
Merchant / Service:${receipt.service}
Plan Name:         ${receipt.planName}

Financial Breakdown:
--------------------------------------------------
Verified Price:    $${receipt.verifiedPrice.toFixed(2)} ${receipt.currency}
Budget Ceiling:    $${receipt.budgetCeiling.toFixed(2)} ${receipt.currency}
Savings Enforced:  $${(receipt.budgetCeiling - receipt.verifiedPrice).toFixed(2)} ${receipt.currency}
Payment Method:    ${receipt.paymentMethod}
Authorization:     ${receipt.sandboxAuthCode}

Metadata:
--------------------------------------------------
Timestamp:         ${receipt.timestamp}
Payer Account:     ${receipt.payerEmail}
Verification Tool: Playwright CDP Headless Engine
MCP Server:        https://mcp.sandbox.paypal.com/sse

Status: 100% VERIFIED & CAPTURED ON PAYPAL SANDBOX
==================================================`;

    const blob = new Blob([receiptContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Rico-Receipt-${receipt.orderId}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 2500);
  };

  const savings = Math.max(0, receipt.budgetCeiling - receipt.verifiedPrice);
  const savingsPercent =
    receipt.budgetCeiling > 0
      ? Math.round((savings / receipt.budgetCeiling) * 100)
      : 0;

  const budgetUsagePercent = Math.min(
    100,
    Math.round((receipt.verifiedPrice / receipt.budgetCeiling) * 100)
  );

  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/95 dark:bg-neutral-900/95 p-4 sm:p-5 text-xs space-y-4 shadow-sm hover:shadow-md transition-all">
      {/* Top Header with Brand, PayPal badge and Verified status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800 gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
            <Receipt className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-neutral-900 dark:text-neutral-100 text-sm">
                Digital Payment Receipt
              </span>
              <Badge
                variant="outline"
                className="text-[9px] py-0 px-1.5 border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-mono flex items-center gap-1"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                PayPal Sandbox MCP
              </Badge>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 font-mono mt-0.5">
              <span>Order: {receipt.orderId}</span>
              <button
                type="button"
                onClick={handleCopyOrderId}
                className="hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
                title="Copy Order ID"
              >
                {copiedId ? (
                  <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400 inline" />
                ) : (
                  <Copy className="w-3 h-3 inline" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Green Verified Badge */}
        <div className="self-start sm:self-auto">
          <Badge className="bg-emerald-600 text-white dark:bg-emerald-500 dark:text-neutral-950 text-[10px] font-medium px-2.5 py-1 flex items-center gap-1 shadow-xs border-0">
            <CheckCircle2 className="w-3.5 h-3.5 fill-current text-white dark:text-neutral-950" />
            <span>Verified &amp; Captured</span>
          </Badge>
        </div>
      </div>

      {/* Main Pricing & Service Showcase */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-950/70 border border-neutral-200 dark:border-neutral-800/80">
        <div className="space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-neutral-400 font-medium block">
            Merchant / Service
          </span>
          <div className="font-semibold text-neutral-900 dark:text-neutral-100 text-sm">
            {receipt.service}
          </div>
          <div className="text-[11px] text-neutral-500">
            {receipt.planName}
          </div>
        </div>

        <div className="space-y-1 sm:text-right">
          <span className="text-[10px] uppercase tracking-wider text-neutral-400 font-medium block">
            Verified Amount Captured
          </span>
          <div className="text-xl font-bold text-neutral-900 dark:text-neutral-100 flex items-center sm:justify-end gap-1">
            <span className="text-emerald-600 dark:text-emerald-400 font-black">
              ${receipt.verifiedPrice.toFixed(2)}
            </span>
            <span className="text-xs font-normal text-neutral-500">
              {receipt.currency}
            </span>
          </div>

          {/* Savings pill */}
          {savings > 0 && (
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-[10px] font-medium sm:ml-auto">
              <TrendingDown className="w-3 h-3" />
              <span>
                Saved ${savings.toFixed(2)} ({savingsPercent}%) under ceiling
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Budget Cap Utilization Visual Progress */}
      <div className="space-y-1.5 px-0.5">
        <div className="flex justify-between text-[11px] text-neutral-500">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-neutral-400" />
            <span>Budget Ceiling Limit:</span>
            <span className="font-semibold text-neutral-700 dark:text-neutral-300">
              ${receipt.budgetCeiling.toFixed(2)} {receipt.currency}
            </span>
          </span>
          <span className="font-medium text-neutral-600 dark:text-neutral-400">
            {budgetUsagePercent}% utilized
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              budgetUsagePercent > 95
                ? "bg-amber-500"
                : "bg-emerald-500 dark:bg-emerald-400"
            }`}
            style={{ width: `${budgetUsagePercent}%` }}
          />
        </div>
      </div>

      {/* Secondary Details Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-[11px] pt-1 border-t border-neutral-100 dark:border-neutral-800/80">
        <div>
          <span className="text-neutral-400 block text-[10px]">Payment Method</span>
          <span className="text-neutral-800 dark:text-neutral-200 font-medium truncate block">
            {receipt.paymentMethod || "PayPal Sandbox"}
          </span>
        </div>

        <div>
          <span className="text-neutral-400 block text-[10px]">Payer Email</span>
          <span className="text-neutral-800 dark:text-neutral-200 font-mono text-[10px] truncate block">
            {receipt.payerEmail || "sb-buyer@example.com"}
          </span>
        </div>

        <div>
          <span className="text-neutral-400 block text-[10px]">Auth Code</span>
          <span className="text-neutral-800 dark:text-neutral-200 font-mono text-[10px]">
            {receipt.sandboxAuthCode || "AUTH-8921"}
          </span>
        </div>
      </div>

      {/* Interactive Action Footer */}
      <div className="flex flex-wrap items-center justify-between pt-2 border-t border-neutral-200 dark:border-neutral-800 gap-2">
        <div className="text-[10px] text-neutral-400 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span>Captured: {receipt.timestamp}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Export Receipt Button */}
          <button
            type="button"
            onClick={handleDownloadReceipt}
            className="h-7 px-2.5 rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-[11px] font-medium flex items-center gap-1.5 transition-colors"
            title="Download formatted audit receipt proof"
          >
            {downloadSuccess ? (
              <>
                <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                <span className="text-emerald-600 dark:text-emerald-400">Downloaded</span>
              </>
            ) : (
              <>
                <Download className="w-3 h-3" />
                <span>Export Proof</span>
              </>
            )}
          </button>

          {/* Full Details Modal Trigger */}
          <button
            type="button"
            onClick={() => onViewReceipt(receipt)}
            className="h-7 px-3 rounded-md bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 text-[11px] font-medium flex items-center gap-1.5 hover:opacity-90 transition-opacity shadow-xs"
          >
            <FileText className="w-3 h-3" />
            <span>View Full Details</span>
          </button>
        </div>
      </div>
    </div>
  );
}
