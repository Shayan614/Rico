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
import { Input } from "@/components/ui/input";
import { Mandate } from "./FinancialDashboard";

interface CreateMandateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (mandate: Omit<Mandate, "id" | "lastScrapedPrice">) => void;
}

export function CreateMandateDialog({
  isOpen,
  onClose,
  onCreate,
}: CreateMandateDialogProps) {
  const [service, setService] = useState("");
  const [budgetCeiling, setBudgetCeiling] = useState("20.00");
  const [recurrence, setRecurrence] = useState("Monthly on the 5th");
  const [category, setCategory] = useState("Subscription");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!service.trim()) return;

    onCreate({
      service,
      budgetCeiling: parseFloat(budgetCeiling) || 20.0,
      recurrence,
      nextRun: "Nov 5, 2026",
      status: "ACTIVE",
      category,
      currency: "USD",
    });

    setService("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-neutral-900 dark:text-neutral-100">
              New Mandate
            </DialogTitle>
            <DialogDescription className="text-xs text-neutral-500">
              Set a spending limit and execution schedule
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-3 text-xs">
            <div>
              <label className="block text-neutral-700 dark:text-neutral-300 font-medium mb-1">
                Service Name
              </label>
              <Input
                value={service}
                onChange={(e) => setService(e.target.value)}
                placeholder="e.g. Netflix, Spotify, AWS, GitHub"
                className="bg-neutral-50 dark:bg-neutral-950 border-neutral-300 dark:border-neutral-800 text-xs text-neutral-900 dark:text-neutral-100"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-neutral-700 dark:text-neutral-300 font-medium mb-1">
                  Budget Cap ($ USD)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={budgetCeiling}
                  onChange={(e) => setBudgetCeiling(e.target.value)}
                  className="bg-neutral-50 dark:bg-neutral-950 border-neutral-300 dark:border-neutral-800 text-xs text-neutral-900 dark:text-neutral-100"
                  required
                />
              </div>

              <div>
                <label className="block text-neutral-700 dark:text-neutral-300 font-medium mb-1">
                  Category
                </label>
                <Input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="e.g. Entertainment, Cloud"
                  className="bg-neutral-50 dark:bg-neutral-950 border-neutral-300 dark:border-neutral-800 text-xs text-neutral-900 dark:text-neutral-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-neutral-700 dark:text-neutral-300 font-medium mb-1">
                Recurrence Schedule
              </label>
              <Input
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value)}
                placeholder="e.g. Monthly on the 1st"
                className="bg-neutral-50 dark:bg-neutral-950 border-neutral-300 dark:border-neutral-800 text-xs text-neutral-900 dark:text-neutral-100"
                required
              />
            </div>
          </div>

          <DialogFooter className="border-t border-neutral-200 dark:border-neutral-800 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="h-8 px-3 rounded border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-8 px-3.5 rounded bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 text-xs font-semibold hover:opacity-90"
            >
              Save Mandate
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
