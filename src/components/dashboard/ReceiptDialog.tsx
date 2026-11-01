"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Receipt,
  CheckCircle2,
  Copy,
  Check,
  Download,
} from "lucide-react";

export interface ReceiptData {
  orderId: string;
  service: string;
  planName: string;
  verifiedPrice: number;
  budgetCeiling: number;
  currency: string;
  paymentMethod: string;
  status: string;
  timestamp: string;
  payerEmail: string;
  sandboxAuthCode: string;
  fundingRail?: "PAYPAL" | "VISA" | "MASTERCARD";
  cardLastFour?: string;
  routedGateway?: string;
  isCascaded?: boolean;
}

interface ReceiptDialogProps {
  receipt: ReceiptData | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ReceiptDialog({ receipt, isOpen, onClose }: ReceiptDialogProps) {
  const [copied, setCopied] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  if (!receipt) return null;

  const handleCopy = () => {
    navigator.clipboard?.writeText(receipt.orderId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100 p-6 space-y-4">
        <DialogHeader className="space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <Receipt className="w-4 h-4" />
              </div>
              <DialogTitle className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                PayPal Sandbox Receipt
              </DialogTitle>
            </div>
            <Badge className="bg-emerald-600 text-white dark:bg-emerald-500 dark:text-neutral-950 text-[10px] font-medium px-2 py-0.5 flex items-center gap-1 border-0">
              <CheckCircle2 className="w-3 h-3 fill-current" />
              <span>Verified &amp; Captured</span>
            </Badge>
          </div>
          <DialogDescription className="text-xs text-neutral-500">
            Autonomous execution audit proof captured via PayPal MCP Server
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1 text-xs">
          {/* Service & Price */}
          <div className="bg-neutral-50 dark:bg-neutral-950 p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 space-y-2">
            <div className="flex justify-between items-center text-neutral-500">
              <span>Merchant Service</span>
              <span className="font-semibold text-neutral-900 dark:text-neutral-100 text-xs">
                {receipt.service}
              </span>
            </div>
            <div className="flex justify-between items-center text-neutral-500">
              <span>Plan Selected</span>
              <span className="text-neutral-800 dark:text-neutral-200">
                {receipt.planName}
              </span>
            </div>
            <div className="flex justify-between items-center text-neutral-500 pt-1 border-t border-neutral-200/60 dark:border-neutral-800/60">
              <span>Verified Amount</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold text-base">
                ${receipt.verifiedPrice.toFixed(2)} {receipt.currency}
              </span>
            </div>
            <div className="flex justify-between items-center text-neutral-500">
              <span>Authorized Budget Ceiling</span>
              <span className="text-neutral-700 dark:text-neutral-300">
                ${receipt.budgetCeiling.toFixed(2)} {receipt.currency}
              </span>
            </div>
            {savings > 0 && (
              <div className="flex justify-between items-center text-emerald-700 dark:text-emerald-400 font-medium pt-1 border-t border-neutral-200/60 dark:border-neutral-800/60">
                <span>Savings Enforced</span>
                <span>
                  +${savings.toFixed(2)} {receipt.currency}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center text-neutral-500 pt-1 border-t border-neutral-200/60 dark:border-neutral-800/60">
              <span>Payment Rail</span>
              <span className="font-sans font-medium flex items-center gap-1.5">
                {receipt.fundingRail === "VISA" ? (
                  <Badge variant="outline" className="border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-bold px-1.5 py-0.5">
                    VISA (•••• {receipt.cardLastFour || "4242"})
                  </Badge>
                ) : receipt.fundingRail === "MASTERCARD" ? (
                  <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold px-1.5 py-0.5">
                    MASTERCARD (•••• {receipt.cardLastFour || "4444"})
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400 text-[10px] font-bold px-1.5 py-0.5">
                    PAYPAL PRIMARY
                  </Badge>
                )}
                {receipt.isCascaded && (
                  <span className="text-[10px] text-purple-600 dark:text-purple-400 font-medium">
                    (Auto-Cascaded)
                  </span>
                )}
              </span>
            </div>
          </div>

          {/* Sandbox Meta */}
          <div className="bg-neutral-50 dark:bg-neutral-950 p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 space-y-2 font-mono text-[11px]">
            <div className="flex justify-between items-center text-neutral-500">
              <span>PayPal Order ID</span>
              <span className="text-neutral-900 dark:text-neutral-100 font-bold truncate max-w-[180px]">
                {receipt.orderId}
              </span>
            </div>
            <div className="flex justify-between items-center text-neutral-500">
              <span>Execution Time</span>
              <span className="text-neutral-700 dark:text-neutral-300 font-sans">
                {receipt.timestamp}
              </span>
            </div>
            <div className="flex justify-between items-center text-neutral-500">
              <span>Payer Account</span>
              <span className="text-neutral-700 dark:text-neutral-300 truncate max-w-[180px]">
                {receipt.payerEmail}
              </span>
            </div>
            <div className="flex justify-between items-center text-neutral-500">
              <span>Auth Code</span>
              <span className="text-neutral-900 dark:text-neutral-100">
                {receipt.sandboxAuthCode}
              </span>
            </div>
            <div className="flex justify-between items-center text-neutral-500">
              <span>MCP Endpoint</span>
              <span className="text-neutral-600 dark:text-neutral-400 font-sans text-[10px]">
                mcp.sandbox.paypal.com/sse
              </span>
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row sm:justify-between items-center gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleCopy}
              className="h-8 px-3 rounded-md border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-200 text-xs flex items-center justify-center gap-1.5 transition-colors flex-1 sm:flex-initial"
              title="Copy Order ID"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>{copied ? "Copied" : "Copy ID"}</span>
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="h-8 px-3 rounded-md border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-200 text-xs flex items-center justify-center gap-1.5 transition-colors flex-1 sm:flex-initial"
              title="Download Receipt TXT"
            >
              {downloadSuccess ? (
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>{downloadSuccess ? "Saved" : "Export"}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto h-8 px-4 rounded-md bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 text-xs font-medium hover:opacity-90 transition-opacity"
          >
            Close
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
