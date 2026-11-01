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
  initialData?: {
    service?: string;
    budgetCeiling?: string;
    recurrence?: string;
    category?: string;
  };
}

export function CreateMandateDialog({
  isOpen,
  onClose,
  onCreate,
  initialData,
}: CreateMandateDialogProps) {
  const [service, setService] = useState(initialData?.service || "");
  const [budgetCeiling, setBudgetCeiling] = useState(initialData?.budgetCeiling || "20.00");
  const [recurrence, setRecurrence] = useState(initialData?.recurrence || "Monthly on the 5th");
  const [category, setCategory] = useState(initialData?.category || "Subscription");

  React.useEffect(() => {
    if (initialData) {
      if (initialData.service) setService(initialData.service);
      if (initialData.budgetCeiling) setBudgetCeiling(initialData.budgetCeiling);
      if (initialData.recurrence) setRecurrence(initialData.recurrence);
      if (initialData.category) setCategory(initialData.category);
    }
  }, [initialData, isOpen]);

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
                placeholder="e.g. Netflix, Spotify, AWS, GitHub, PostHog, Notion"
                className="bg-neutral-50 dark:bg-neutral-950 border-neutral-300 dark:border-neutral-800 text-xs text-neutral-900 dark:text-neutral-100"
                required
              />
              {service.toLowerCase().includes("posthog") && (
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium flex items-center gap-1">
                  💡 <strong>Startup Perk:</strong> PostHog offers $50,000 in free credits!
                </p>
              )}
              {service.toLowerCase().includes("spotify") && (
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium flex items-center gap-1">
                  🎓 <strong>Student Perk:</strong> Spotify is 50% off ($5.99/mo + free Hulu)!
                </p>
              )}
              {service.toLowerCase().includes("notion") && (
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium flex items-center gap-1">
                  💡 <strong>Startup Perk:</strong> Notion provides $1,000 - $6,000 in credits!
                </p>
              )}
              {service.toLowerCase().includes("adobe") && (
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium flex items-center gap-1">
                  🎓 <strong>Student Perk:</strong> Adobe is 64% off ($19.99/mo student rate)!
                </p>
              )}
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
