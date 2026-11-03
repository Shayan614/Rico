"use client";

import React from "react";
import { CheckSquare, Plus, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Mandate } from "@/components/dashboard/FinancialDashboard";

interface ZephiumTasksModalProps {
  isOpen: boolean;
  onClose: () => void;
  mandates: Mandate[];
  onTriggerMandate: (id: string) => void;
  onCreateMandate: () => void;
}

export function ZephiumTasksModal({
  isOpen,
  onClose,
  mandates,
  onTriggerMandate,
  onCreateMandate,
}: ZephiumTasksModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl bg-neutral-900 border-neutral-800 text-neutral-100 p-0 overflow-hidden shadow-2xl">
        <DialogHeader className="p-4 border-b border-neutral-800 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-emerald-400" />
            <DialogTitle className="text-base font-semibold text-white">
              Zephium Tasks (Autonomous Financial Mandates)
            </DialogTitle>
          </div>
          <button
            type="button"
            onClick={onCreateMandate}
            className="flex items-center gap-1 px-2.5 py-1 text-xs rounded bg-teal-500 hover:bg-teal-400 text-neutral-950 font-semibold transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Task</span>
          </button>
        </DialogHeader>

        <div className="p-4 max-h-[450px] overflow-y-auto space-y-2">
          {mandates.length === 0 ? (
            <div className="text-center py-10 text-neutral-500 text-xs">
              No tasks scheduled yet. Describe a financial mandate like &quot;Pay Netflix $15.99 on 5th&quot;.
            </div>
          ) : (
            mandates.map((m) => (
              <div
                key={m.id}
                className="p-3 rounded-lg border border-neutral-800 bg-neutral-950 flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-start gap-2.5">
                  <div className="w-4 h-4 rounded border border-neutral-700 bg-neutral-900 flex items-center justify-center text-emerald-400 mt-0.5">
                    {m.status === "ACTIVE" && <Check className="w-3 h-3" />}
                  </div>
                  <div>
                    <div className="font-semibold text-white flex items-center gap-2">
                      <span>{m.service}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-neutral-800 text-neutral-400 font-mono">
                        {m.recurrence}
                      </span>
                    </div>
                    <div className="text-neutral-400 text-[11px] mt-0.5">
                      Budget Ceiling: <span className="text-emerald-400 font-mono font-bold">${m.budgetCeiling.toFixed(2)} USD</span>
                      {m.nextRun && ` • Next Run: ${m.nextRun}`}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onTriggerMandate(m.id)}
                  className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-[11px] font-medium transition-colors"
                >
                  Run Now
                </button>
              </div>
            ))
          )}
        </div>

        <div className="p-3 bg-neutral-950 border-t border-neutral-800 text-[11px] text-neutral-400 flex items-center justify-between">
          <span>{mandates.length} linked agent tasks in SQLite memory</span>
          <span className="text-teal-400 font-mono">Zero re-typing required</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
