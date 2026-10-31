"use client";

import React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Mandate, Transaction, AuditLog } from "@/components/dashboard/FinancialDashboard";
import { ReceiptData } from "@/components/dashboard/ReceiptDialog";
import { WorkSurface } from "@/components/dashboard/WorkSurface";
import { Layers } from "lucide-react";

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  mandates: Mandate[];
  transactions: Transaction[];
  auditLogs: AuditLog[];
  onTriggerMandate: (id: string) => void;
  onViewReceipt: (receipt: ReceiptData) => void;
  onCreateMandateClick: () => void;
}

export function MobileDrawer({
  isOpen,
  onClose,
  mandates,
  transactions,
  auditLogs,
  onTriggerMandate,
  onViewReceipt,
  onCreateMandateClick,
}: MobileDrawerProps) {
  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        className="h-[88vh] max-h-[88vh] p-0 flex flex-col bg-white dark:bg-neutral-950 border-t border-neutral-200 dark:border-neutral-800 rounded-t-2xl overflow-hidden"
      >
        {/* Drawer Drag handle visual */}
        <div className="pt-2 pb-1 flex justify-center shrink-0">
          <div className="w-12 h-1.5 rounded-full bg-neutral-300 dark:bg-neutral-700" />
        </div>

        <SheetHeader className="px-4 py-2 border-b border-neutral-200 dark:border-neutral-800 text-left shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex items-center justify-center text-neutral-800 dark:text-neutral-200">
              <Layers className="w-3.5 h-3.5" />
            </div>
            <div>
              <SheetTitle className="text-sm font-semibold">
                Financial Command Center
              </SheetTitle>
              <SheetDescription className="text-[11px]">
                {mandates.length} Active Mandates • {transactions.length} Captured Orders
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <WorkSurface
            mandates={mandates}
            transactions={transactions}
            auditLogs={auditLogs}
            onTriggerMandate={(id) => {
              onTriggerMandate(id);
              onClose();
            }}
            onViewReceipt={onViewReceipt}
            onCreateMandateClick={() => {
              onCreateMandateClick();
              onClose();
            }}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
