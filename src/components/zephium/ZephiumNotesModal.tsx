"use client";

import React from "react";
import { FileText } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AuditLog } from "@/components/dashboard/FinancialDashboard";

interface ZephiumNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  auditLogs: AuditLog[];
}

export function ZephiumNotesModal({
  isOpen,
  onClose,
  auditLogs,
}: ZephiumNotesModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl bg-neutral-900 border-neutral-800 text-neutral-100 p-0 overflow-hidden shadow-2xl">
        <DialogHeader className="p-4 border-b border-neutral-800 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-purple-400" />
            <DialogTitle className="text-base font-semibold text-white">
              Zephium Notes &amp; Financial Audit Log (Markdown)
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="p-4 max-h-[450px] overflow-y-auto space-y-2">
          {auditLogs.length === 0 ? (
            <div className="text-center py-10 text-neutral-500 text-xs">
              No audit records logged yet.
            </div>
          ) : (
            auditLogs.map((log) => (
              <div
                key={log.id}
                className="p-3 rounded-lg border border-neutral-800 bg-neutral-950 font-mono text-[11px] space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`font-bold ${
                      log.eventType === "PAYMENT_CAPTURED"
                        ? "text-emerald-400"
                        : log.eventType === "GUARDRAIL_BLOCKED"
                        ? "text-red-400"
                        : "text-blue-400"
                    }`}
                  >
                    [{log.eventType}]
                  </span>
                  <span className="text-neutral-500 text-[10px]">{log.timestamp}</span>
                </div>
                <div className="text-neutral-300">{log.service}</div>
                {log.details && (
                  <div className="text-neutral-400 text-[10px] bg-neutral-900/80 p-1.5 rounded">
                    {log.details}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="p-3 bg-neutral-950 border-t border-neutral-800 text-[11px] text-neutral-400 flex items-center justify-between">
          <span>Cryptographic audit proof stored locally</span>
          <span className="text-purple-400 font-mono">FOSS &amp; 0 Telemetry Leakage</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
