"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  Command,
  Zap,
  CreditCard,
  Receipt,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  Sparkles,
  Bot,
  Plus,
  Film,
} from "lucide-react";
import { Mandate, Transaction, AuditLog } from "./FinancialDashboard";
import { ReceiptData } from "./ReceiptDialog";

interface QuickCommandLauncherProps {
  isOpen: boolean;
  onClose: () => void;
  mandates: Mandate[];
  transactions: Transaction[];
  auditLogs: AuditLog[];
  onSendMessage: (text: string) => void;
  onOpenCreateMandate: () => void;
  onViewReceipt: (receipt: ReceiptData) => void;
  onToggleStrictMode: () => void;
  strictMode: boolean;
  onTriggerParallelComparison?: (preset: "streaming" | "devtools" | "cloud") => void;
}

interface CommandItem {
  id: string;
  category: "Actions" | "Mandates" | "Spending Rules" | "Transactions" | "Navigation";
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  badge?: string;
  badgeColor?: string;
  action: () => void;
}

export function QuickCommandLauncher({
  isOpen,
  onClose,
  mandates,
  transactions,
  auditLogs,
  onSendMessage,
  onOpenCreateMandate,
  onViewReceipt,
  onToggleStrictMode,
  strictMode,
  onTriggerParallelComparison,
}: QuickCommandLauncherProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Global Keyboard Shortcut: Cmd+K / Ctrl+K / Esc
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          // Open handled by parent or toggle
        }
      }
      if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Build command list based on query
  const buildCommandList = (): CommandItem[] => {
    const items: CommandItem[] = [];
    const q = query.trim().toLowerCase();

    // 1. Dynamic Natural Language Prompt Option (if user typed something)
    if (q.length > 0) {
      items.push({
        id: "custom-prompt",
        category: "Actions",
        title: `Execute Command: "${query.trim()}"`,
        subtitle: "Dispatch prompt directly to Rico autonomous reasoning agent",
        icon: <Zap className="w-4 h-4 text-emerald-400" />,
        badge: "Natural Language",
        badgeColor: "bg-emerald-950/80 text-emerald-300 border-emerald-500/40",
        action: () => {
          onSendMessage(query.trim());
          onClose();
        },
      });
    }

    // 2. Preset Quick Actions
    const defaultActions: CommandItem[] = [
      {
        id: "action-pay-netflix",
        category: "Actions",
        title: "Pay Netflix $15.49 Standard HD",
        subtitle: "Autonomously verify DOM price and execute PayPal capture",
        icon: <Film className="w-4 h-4 text-red-400" />,
        badge: "Autopay",
        badgeColor: "bg-red-950/80 text-red-300 border-red-500/40",
        action: () => {
          onSendMessage("Execute mandate now for Netflix Standard HD");
          onClose();
        },
      },
      {
        id: "action-compare-streaming",
        category: "Actions",
        title: "Compare Streaming (Netflix vs Spotify vs YouTube)",
        subtitle: "Launch parallel Playwright helper bots for multi-site check",
        icon: <Sparkles className="w-4 h-4 text-purple-400" />,
        badge: "Parallel Bots",
        badgeColor: "bg-purple-950/80 text-purple-300 border-purple-500/40",
        action: () => {
          if (onTriggerParallelComparison) {
            onTriggerParallelComparison("streaming");
          } else {
            onSendMessage("Compare streaming services pricing in parallel");
          }
          onClose();
        },
      },
      {
        id: "action-compare-devtools",
        category: "Actions",
        title: "Compare Dev Tools (Copilot vs ChatGPT vs AWS)",
        subtitle: "Run concurrent headless workers across SaaS pricing pages",
        icon: <Bot className="w-4 h-4 text-blue-400" />,
        badge: "DevTools",
        badgeColor: "bg-blue-950/80 text-blue-300 border-blue-500/40",
        action: () => {
          if (onTriggerParallelComparison) {
            onTriggerParallelComparison("devtools");
          } else {
            onSendMessage("Compare dev tools pricing in parallel");
          }
          onClose();
        },
      },
      {
        id: "action-new-mandate",
        category: "Actions",
        title: "Create New Spending Rule",
        subtitle: "Set spending ceiling, recurrence schedule, and safety rules",
        icon: <Plus className="w-4 h-4 text-emerald-400" />,
        badge: "Spending Rule",
        action: () => {
          onOpenCreateMandate();
          onClose();
        },
      },
      {
        id: "action-toggle-strict",
        category: "Actions",
        title: strictMode
          ? "Switch to Autonomous Mode (Auto-Execute)"
          : "Switch to Strict Approval Mode (Require Review)",
        subtitle: `Currently: ${strictMode ? "Manual Human Approval Required" : "Autonomous Mode"}`,
        icon: strictMode ? (
          <ShieldAlert className="w-4 h-4 text-amber-400" />
        ) : (
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
        ),
        badge: strictMode ? "Strict" : "Autonomous",
        badgeColor: strictMode
          ? "bg-amber-950/80 text-amber-300 border-amber-500/40"
          : "bg-emerald-950/80 text-emerald-300 border-emerald-500/40",
        action: () => {
          onToggleStrictMode();
          onClose();
        },
      },
    ];

    defaultActions.forEach((act) => {
      if (!q || act.title.toLowerCase().includes(q) || act.subtitle.toLowerCase().includes(q)) {
        items.push(act);
      }
    });

    // 3. Search Active Spending Rules
    mandates.forEach((m) => {
      if (!q || m.service.toLowerCase().includes(q) || m.category.toLowerCase().includes(q)) {
        items.push({
          id: `mandate-${m.id}`,
          category: "Spending Rules",
          title: `Run Spending Rule: ${m.service}`,
          subtitle: `Cap: $${m.budgetCeiling.toFixed(2)} ${m.currency} • ${m.recurrence} • Next: ${m.nextRun}`,
          icon: <CreditCard className="w-4 h-4 text-blue-400" />,
          badge: m.status,
          badgeColor:
            m.status === "ACTIVE"
              ? "bg-emerald-950/80 text-emerald-300 border-emerald-500/40"
              : "bg-amber-950/80 text-amber-300 border-amber-500/40",
          action: () => {
            onSendMessage(`Execute mandate now for ${m.service}`);
            onClose();
          },
        });
      }
    });

    // 4. Search Transactions & Receipts
    transactions.forEach((tx) => {
      if (
        !q ||
        tx.service.toLowerCase().includes(q) ||
        tx.orderId.toLowerCase().includes(q) ||
        tx.amount.toString().includes(q)
      ) {
        items.push({
          id: `tx-${tx.id}`,
          category: "Transactions",
          title: `View Receipt: ${tx.service} ($${tx.amount.toFixed(2)})`,
          subtitle: `Order: ${tx.orderId} • ${tx.timestamp} • Status: ${tx.status}`,
          icon: <Receipt className="w-4 h-4 text-amber-400" />,
          badge: tx.orderId,
          badgeColor: "bg-neutral-800 text-neutral-300 border-neutral-700",
          action: () => {
            if (tx.receiptData) {
              onViewReceipt(tx.receiptData);
            }
            onClose();
          },
        });
      }
    });

    // 5. Search Safety & Audit Logs
    if (q) {
      auditLogs.forEach((log) => {
        if (
          log.service.toLowerCase().includes(q) ||
          log.eventType.toLowerCase().includes(q) ||
          log.details.toLowerCase().includes(q)
        ) {
          items.push({
            id: `log-${log.id}`,
            category: "Actions",
            title: `Audit Log: ${log.service} (${log.eventType})`,
            subtitle: `${log.details} • ${log.timestamp}`,
            icon:
              log.severity === "danger" ? (
                <ShieldAlert className="w-4 h-4 text-red-400" />
              ) : (
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              ),
            badge: log.eventType,
            badgeColor:
              log.severity === "danger"
                ? "bg-red-950 text-red-300 border-red-500/40"
                : "bg-emerald-950 text-emerald-300 border-emerald-500/40",
            action: () => {
              onSendMessage(`Show audit log details for ${log.service}`);
              onClose();
            },
          });
        }
      });
    }

    return items;
  };

  const commandItems = buildCommandList();

  // Keyboard navigation inside command palette
  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, commandItems.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev <= 0 ? commandItems.length - 1 : prev - 1
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (commandItems[selectedIndex]) {
        commandItems[selectedIndex].action();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-start justify-center pt-20 px-4 animate-in fade-in duration-150 select-none">
      {/* Background click dismiss */}
      <div className="absolute inset-0 -z-10" onClick={onClose} />

      <div className="w-full max-w-2xl bg-neutral-900 border border-neutral-700/80 rounded-2xl shadow-2xl overflow-hidden font-sans flex flex-col ring-1 ring-blue-500/20 max-h-[75vh]">
        {/* Top Input Bar */}
        <div className="h-14 px-4 border-b border-neutral-800 flex items-center gap-3 shrink-0 bg-neutral-950/60">
          <Search className="w-5 h-5 text-neutral-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleInputKeyDown}
            placeholder="Type a mandate prompt or command... (e.g. 'Pay Netflix $15.49', 'Pause Spotify')"
            className="flex-1 bg-transparent text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-[10px] font-mono text-neutral-400">
            <span>ESC</span>
          </kbd>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {commandItems.length === 0 ? (
            <div className="py-12 text-center text-neutral-500 text-xs">
              <p>No commands, mandates, or transactions match &quot;{query}&quot;.</p>
              <p className="mt-1 text-[11px] text-neutral-600">
                Press Enter to send &quot;{query}&quot; as a new natural language mandate prompt.
              </p>
            </div>
          ) : (
            commandItems.map((item, idx) => {
              const isSelected = selectedIndex === idx;
              return (
                <div
                  key={item.id}
                  onClick={() => item.action()}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`px-3 py-2.5 rounded-xl cursor-pointer flex items-center justify-between gap-3 transition-colors ${
                    isSelected
                      ? "bg-blue-600/20 border border-blue-500/50 text-white"
                      : "hover:bg-neutral-800/60 text-neutral-300 border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-3 truncate">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${
                        isSelected
                          ? "bg-blue-600/30 border-blue-400 text-blue-300"
                          : "bg-neutral-800/80 border-neutral-700/60 text-neutral-400"
                      }`}
                    >
                      {item.icon}
                    </div>

                    <div className="truncate">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-white truncate">
                          {item.title}
                        </span>
                        {item.badge && (
                          <span
                            className={`text-[9px] font-mono px-1.5 py-0.2 rounded border shrink-0 ${
                              item.badgeColor ||
                              "bg-neutral-800 text-neutral-300 border-neutral-700"
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                        {item.subtitle}
                      </p>
                    </div>
                  </div>

                  <ArrowRight
                    className={`w-4 h-4 shrink-0 transition-transform ${
                      isSelected
                        ? "text-blue-400 translate-x-0.5"
                        : "text-neutral-600"
                    }`}
                  />
                </div>
              );
            })
          )}
        </div>

        {/* Bottom Footer Helper Bar */}
        <div className="h-9 px-4 bg-neutral-950 border-t border-neutral-800 flex items-center justify-between text-[11px] text-neutral-500 font-mono shrink-0">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.2 rounded bg-neutral-800 border border-neutral-700 text-[10px]">
                ↑↓
              </kbd>
              <span>Navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.2 rounded bg-neutral-800 border border-neutral-700 text-[10px]">
                ↵
              </kbd>
              <span>Execute</span>
            </span>
          </div>

          <div className="flex items-center gap-2 text-neutral-400">
            <Command className="w-3.5 h-3.5 text-blue-400" />
            <span>Rico Keyboard Superpowers</span>
          </div>
        </div>
      </div>
    </div>
  );
}
