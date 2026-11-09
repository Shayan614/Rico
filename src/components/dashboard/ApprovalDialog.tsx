"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Check, X } from "lucide-react";

export interface ApprovalRequest {
  id: string;
  service: string;
  detectedPrice: number;
  budgetCeiling: number;
  reason: string;
  currency: string;
  baselinePrice?: number;
  spikePercentage?: number;
  fundingRail?: "PAYPAL" | "VISA" | "MASTERCARD";
  anomalyType?: "PRICE_SPIKE" | "STRICT_MODE" | "BUDGET_CEILING_EXCEEDED";
  riskLevel?: "warning" | "danger" | "critical";
  /** Server-signed confirmation for a quoted payment. Only this lets the server charge. */
  confirmToken?: string;
  mandateId?: string;
  periodLabel?: string;
}

interface ApprovalDialogProps {
  request: ApprovalRequest | null;
  isOpen: boolean;
  onApprove: (fundingSource?: "PAYPAL" | "BACKUP_CARD") => void;
  onReject: () => void;
}

export function ApprovalDialog({
  request,
  isOpen,
  onApprove,
  onReject,
}: ApprovalDialogProps) {
  if (!request) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onReject()}>
      <DialogContent className="sm:max-w-md bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-neutral-900 dark:text-neutral-100">
            {request.confirmToken ? "Confirm Payment" : "Manual Approval Required"}
          </DialogTitle>
          <DialogDescription className="text-xs text-neutral-500">
            {request.confirmToken
              ? "Review the details below. Nothing is charged until you approve."
              : "Safety guardrail paused execution for review"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2 text-xs">
          <div className="p-3 bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded text-neutral-800 dark:text-neutral-200">
            <p className="font-semibold mb-1">Reason for Hold:</p>
            <p className="text-neutral-600 dark:text-neutral-400">{request.reason}</p>
          </div>

          <div className="bg-neutral-50 dark:bg-neutral-950 p-3 rounded border border-neutral-200 dark:border-neutral-800 space-y-2">
            <div className="flex justify-between items-center text-neutral-500">
              <span>Service</span>
              <span className="font-semibold text-neutral-900 dark:text-neutral-100">{request.service}</span>
            </div>
            <div className="flex justify-between items-center text-neutral-500">
              <span>Verified Web Price</span>
              <span className="font-bold text-neutral-900 dark:text-neutral-100 text-sm">
                ${request.detectedPrice.toFixed(2)} {request.currency}
              </span>
            </div>
            <div className="flex justify-between items-center text-neutral-500">
              <span>Authorized Ceiling</span>
              <span className="text-neutral-700 dark:text-neutral-300">
                ${request.budgetCeiling.toFixed(2)} {request.currency}
              </span>
            </div>
            {request.periodLabel && (
              <div className="flex justify-between items-center text-neutral-500">
                <span>Billing Period</span>
                <span className="text-neutral-700 dark:text-neutral-300">{request.periodLabel}</span>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="sm:justify-between border-t border-neutral-200 dark:border-neutral-800 pt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onReject}
            className="h-8 px-3 rounded border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-200 text-xs flex items-center gap-1.5 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            <span>Decline &amp; Cancel</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onApprove("BACKUP_CARD")}
              className="h-8 px-3 rounded bg-blue-600 text-white hover:bg-blue-500 text-xs font-medium transition-colors flex items-center gap-1.5"
            >
              <span>Route to Visa (•••• 4242)</span>
            </button>

            <button
              type="button"
              onClick={() => onApprove("PAYPAL")}
              className="h-8 px-3.5 rounded bg-emerald-600 text-white hover:bg-emerald-500 text-xs font-medium transition-colors flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Approve (PayPal)</span>
            </button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
