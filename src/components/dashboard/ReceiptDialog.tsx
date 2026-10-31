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
import { Copy, Check } from "lucide-react";

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
}

interface ReceiptDialogProps {
  receipt: ReceiptData | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ReceiptDialog({ receipt, isOpen, onClose }: ReceiptDialogProps) {
  const [copied, setCopied] = useState(false);
  if (!receipt) return null;

  const handleCopy = () => {
    navigator.clipboard?.writeText(receipt.orderId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-neutral-900 dark:text-neutral-100">
            Order Receipt
          </DialogTitle>
          <DialogDescription className="text-xs text-neutral-500">
            Autonomous execution details
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2 text-xs">
          <div className="bg-neutral-50 dark:bg-neutral-950 p-3 rounded border border-neutral-200 dark:border-neutral-800 space-y-2">
            <div className="flex justify-between items-center text-neutral-500">
              <span>Service</span>
              <span className="font-semibold text-neutral-900 dark:text-neutral-100">{receipt.service}</span>
            </div>
            <div className="flex justify-between items-center text-neutral-500">
              <span>Plan</span>
              <span className="text-neutral-800 dark:text-neutral-200">{receipt.planName}</span>
            </div>
            <div className="flex justify-between items-center text-neutral-500">
              <span>Verified Price</span>
              <span className="text-neutral-900 dark:text-neutral-100 font-bold text-sm">
                ${receipt.verifiedPrice.toFixed(2)} {receipt.currency}
              </span>
            </div>
            <div className="flex justify-between items-center text-neutral-500">
              <span>Budget Cap</span>
              <span className="text-neutral-700 dark:text-neutral-300">
                ${receipt.budgetCeiling.toFixed(2)} {receipt.currency}
              </span>
            </div>
          </div>

          <div className="bg-neutral-50 dark:bg-neutral-950 p-3 rounded border border-neutral-200 dark:border-neutral-800 space-y-2">
            <div className="flex justify-between items-center text-neutral-500">
              <span>Order ID</span>
              <span className="font-mono text-neutral-900 dark:text-neutral-100">{receipt.orderId}</span>
            </div>
            <div className="flex justify-between items-center text-neutral-500">
              <span>Execution Time</span>
              <span className="text-neutral-700 dark:text-neutral-300">{receipt.timestamp}</span>
            </div>
            <div className="flex justify-between items-center text-neutral-500">
              <span>Status</span>
              <span className="px-2 py-0.5 rounded border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 text-[10px] font-medium text-neutral-800 dark:text-neutral-200">
                {receipt.status}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter className="sm:justify-between border-t border-neutral-200 dark:border-neutral-800 pt-3">
          <button
            type="button"
            onClick={handleCopy}
            className="h-8 px-3 rounded border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-200 text-xs flex items-center gap-1.5 transition-colors"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-neutral-900 dark:text-neutral-100" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span>{copied ? "Copied" : "Copy Order ID"}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="h-8 px-3.5 rounded bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 text-xs font-medium hover:opacity-90 transition-opacity"
          >
            Close
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
