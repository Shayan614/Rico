"use client";

export const dynamic = "force-dynamic";

import React, { useState, useEffect, useRef } from "react";
import { ZephiumCleanHome } from "@/components/zephium/ZephiumCleanHome";
import { useAuth } from "@/lib/auth/AuthContext";
import { Mandate, Transaction, AuditLog } from "@/components/dashboard/FinancialDashboard";
import { ReceiptData } from "@/components/dashboard/ReceiptDialog";
import { ApprovalRequest } from "@/components/dashboard/ApprovalDialog";
import { usePayAgentChat, ChatMessage } from "@/lib/chat/use-payagent-chat";
import {
  trackMandateTriggered,
  trackReceiptViewed,
  trackApprovalDecision,
  captureClientEvent,
  posthog,
} from "@/lib/telemetry/posthog-client";

const INITIAL_MESSAGES: ChatMessage[] = [];

export default function Home() {
  const [strictMode, setStrictMode] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptData | null>(
    null
  );
  const [approvalRequest, setApprovalRequest] =
    useState<ApprovalRequest | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [mandateInitialData, setMandateInitialData] = useState<
    | {
        service?: string;
        budgetCeiling?: string;
        recurrence?: string;
        category?: string;
      }
    | undefined
  >(undefined);

  // Global Keyboard Shortcut: ⌘K / Ctrl+K Quick Command Launcher
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsCommandOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Mandates state
  // Sample data for signed-out visitors only. Signed-in users always see their own database rows.
  const SAMPLE_MANDATES = useRef<Mandate[]>([
    {
      id: "mandate-1",
      service: "Netflix Standard HD",
      budgetCeiling: 20.0,
      lastScrapedPrice: 15.49,
      recurrence: "Monthly on 5th",
      nextRun: "Nov 5, 2026",
      status: "ACTIVE",
      category: "Media",
      currency: "USD",
    },
    {
      id: "mandate-2",
      service: "Spotify Premium",
      budgetCeiling: 15.0,
      lastScrapedPrice: 11.99,
      recurrence: "Monthly on 1st",
      nextRun: "Nov 1, 2026",
      status: "ACTIVE",
      category: "Music",
      currency: "USD",
    },
    {
      id: "mandate-3",
      service: "GitHub Copilot",
      budgetCeiling: 25.0,
      lastScrapedPrice: 19.0,
      recurrence: "Monthly on 15th",
      nextRun: "Nov 15, 2026",
      status: "ACTIVE",
      category: "Tools",
      currency: "USD",
    },
  ]);

  // Transactions state
  const SAMPLE_TRANSACTIONS = useRef<Transaction[]>([
    {
      id: "tx-1",
      orderId: "ORD-84920491",
      service: "Netflix Standard HD",
      amount: 15.49,
      currency: "USD",
      status: "COMPLETED",
      timestamp: "Oct 31, 2026, 02:45 PM",
      receiptData: {
        orderId: "ORD-84920491",
        service: "Netflix Standard HD",
        planName: "Standard 2-Screen HD Streaming",
        verifiedPrice: 15.49,
        budgetCeiling: 20.0,
        currency: "USD",
        paymentMethod: "Connected Account",
        status: "COMPLETED",
        timestamp: "Oct 31, 2026, 02:45 PM",
        payerEmail: "user@example.com",
        sandboxAuthCode: "AUTH-8921",
      },
    },
    {
      id: "tx-2",
      orderId: "ORD-71049281",
      service: "Spotify Premium Individual",
      amount: 11.99,
      currency: "USD",
      status: "COMPLETED",
      timestamp: "Oct 28, 2026, 11:15 AM",
      receiptData: {
        orderId: "ORD-71049281",
        service: "Spotify Premium Individual",
        planName: "Individual Plan",
        verifiedPrice: 11.99,
        budgetCeiling: 15.0,
        currency: "USD",
        paymentMethod: "Connected Account",
        status: "COMPLETED",
        timestamp: "Oct 28, 2026, 11:15 AM",
        payerEmail: "user@example.com",
        sandboxAuthCode: "AUTH-3401",
      },
    },
  ]);

  // Audit Logs state
  const SAMPLE_AUDIT_LOGS = useRef<AuditLog[]>([
    {
      id: "log-1",
      timestamp: "Oct 31, 2026, 02:45 PM",
      eventType: "PAYMENT_CAPTURED",
      service: "Netflix",
      details:
        "Order ORD-84920491 captured. Scraped live price ($15.49) verified below $20.00 ceiling.",
      severity: "success",
    },
    {
      id: "log-2",
      timestamp: "Oct 31, 2026, 02:44 PM",
      eventType: "PRICE_VERIFIED",
      service: "Netflix",
      details: "Verified Netflix standard subscription price: $15.49/mo.",
      severity: "info",
    },
    {
      id: "log-3",
      timestamp: "Oct 29, 2026, 09:12 AM",
      eventType: "GUARDRAIL_BLOCKED",
      service: "Adobe Creative Cloud",
      details:
        "Execution paused: Plan price ($59.99) exceeds authorized budget ceiling ($30.00).",
      severity: "danger",
    },
  ]);

  const [mandates, setMandates] = useState<Mandate[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  const fetchDashboardData = () => {
    fetch("/api/dashboard")
      .then((res) => {
        if (res.status === 401) return null;
        if (!res.ok) throw new Error("Failed to load dashboard data");
        return res.json();
      })
      .then((data) => {
        if (data === null) {
          // Signed out: show the sample data so the page is not blank.
          setMandates(SAMPLE_MANDATES.current);
          setTransactions(SAMPLE_TRANSACTIONS.current);
          setAuditLogs(SAMPLE_AUDIT_LOGS.current);
          return;
        }
        // Signed in: the database is the only source, even when it is empty.
        setMandates(data.mandates ?? []);
        setTransactions(data.transactions ?? []);
        setAuditLogs(data.auditLogs ?? []);
      })
      .catch((err) => {
        console.warn("Could not fetch database records, using defaults:", err);
      });
  };

  // Load persistent records, and reload them when the signed-in user changes (login without a page reload).
  const { user: authUser } = useAuth();
  const authUserId = authUser?.id ?? null;
  useEffect(() => {
    fetchDashboardData();
  }, [authUserId]);

  // PostHog Feature Flag for Strict Approval Mode vs Autonomous Mode
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        posthog.onFeatureFlags(() => {
          const isStrict = posthog.isFeatureEnabled("strict-approval-mode");
          if (typeof isStrict === "boolean") {
            setStrictMode(isStrict);
          }
        });
      } catch {
        // Fallback for offline/unconfigured key
      }
    }
  }, []);

  // The server records every payment itself, so the browser only refreshes its view.
  const handleReceiptCaptured = () => {
    fetchDashboardData();
  };

  // Vercel AI SDK chat integration hook
  const {
    messages,
    input,
    setInput,
    sendMessage,
    isLoading,
    clearChat,
    setMessages,
  } = usePayAgentChat({
    initialMessages: INITIAL_MESSAGES,
    strictMode,
    mandates,
    onReceiptCaptured: handleReceiptCaptured,
    onApprovalRequired: (req) => setApprovalRequest(req),
  });

  const timeNow = () =>
    new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

  const postAssistantNote = (text: string, extra: Partial<ChatMessage> = {}) => {
    setMessages((prev) => [
      ...prev,
      { id: `msg-note-${Date.now()}`, sender: "assistant", text, timestamp: timeNow(), ...extra },
    ]);
  };

  // Run Now: the server quotes the payment and nothing is charged until the user confirms it.
  const handleTriggerMandate = async (id: string) => {
    const target = mandates.find((m) => m.id === id);
    if (!target) return;
    trackMandateTriggered(target.id, target.service);
    try {
      const res = await fetch("/api/payments/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mandateId: id }),
      });
      if (res.status === 401) return; // The sign-in prompt opens instead.
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.quote) {
        postAssistantNote(data.error || `${target.service} could not be prepared for payment. No payment was made.`);
        return;
      }
      const q = data.quote;
      setApprovalRequest({
        id: `confirm-${Date.now()}`,
        service: q.service,
        detectedPrice: q.amount,
        budgetCeiling: q.budgetCeiling,
        currency: q.currency,
        reason: "Please confirm this payment. Nothing has been charged yet.",
        confirmToken: q.confirmToken,
        mandateId: q.mandateId,
        periodLabel: q.periodLabel,
      });
    } catch {
      postAssistantNote("Could not reach the server. No payment was made.");
    }
  };

  const handleApprove = async (fundingSource: "PAYPAL" | "BACKUP_CARD" = "PAYPAL") => {
    if (!approvalRequest) return;
    const req = approvalRequest;
    // Closing first means a second click cannot submit the same confirmation again.
    setApprovalRequest(null);
    trackApprovalDecision(req.service, true, req.detectedPrice);

    if (!req.confirmToken) {
      postAssistantNote(`No payment was made for ${req.service}: this request had no server confirmation. Use Run Now on the rule.`);
      return;
    }

    try {
      const res = await fetch("/api/payments/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmToken: req.confirmToken,
          fundingRail: fundingSource === "BACKUP_CARD" ? "VISA" : "PAYPAL",
        }),
      });
      if (res.status === 401) return; // The sign-in prompt opens instead.
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        postAssistantNote(data.error || `The payment for ${req.service} did not go through.`);
        fetchDashboardData();
        return;
      }
      postAssistantNote(data.message, {
        receipt: data.receipt ?? undefined,
        thoughtProcess: {
          summary: "Payment Confirmed",
          steps: [
            { step: "You confirmed the payment", status: "done", detail: `${req.service} $${req.detectedPrice.toFixed(2)} ${req.currency}` },
            { step: "Payment recorded by the server", status: "done", detail: `Order: ${data.orderId}` },
          ],
        },
      });
      fetchDashboardData();
    } catch {
      postAssistantNote(`The payment result for ${req.service} is unknown because the server could not be reached. Check your transactions before trying again.`);
    }
  };

  const handleReject = () => {
    if (!approvalRequest) return;
    const req = approvalRequest;
    setApprovalRequest(null);
    trackApprovalDecision(req.service, false, req.detectedPrice);
    postAssistantNote(`Payment cancelled for ${req.service}. Nothing was charged.`);
  };

  const handleDeployPlanMandate = (
    service: string,
    price: number,
    planName: string
  ) => {
    const ceilingBuffer = (Math.ceil(price * 1.15 * 100) / 100).toFixed(2);
    setMandateInitialData({
      service: `${service} (${planName})`,
      budgetCeiling: ceilingBuffer,
      recurrence: "Monthly on the 1st",
      category: "Software & Cloud",
    });
    setIsCreateOpen(true);

    const planNoticeMsg: ChatMessage = {
      id: `msg-plan-${Date.now()}`,
      sender: "assistant",
      text: `Locked in ${service} — ${planName} via the Zephium Calm Pricing Lens at an honest transparent rate of $${price.toFixed(
        2
      )}/mo (dark patterns stripped).\n\nConfiguring autonomous mandate with a safe budget ceiling of $${ceilingBuffer} USD.`,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      thoughtProcess: {
        summary: "Calm Pricing Lens Plan Selected",
        steps: [
          {
            step: "DOM restyling completed",
            status: "done",
            detail: "Marketing traps & gotchas eliminated",
          },
          {
            step: "Price normalized",
            status: "done",
            detail: `$${price.toFixed(2)} / month honest rate`,
          },
          {
            step: "Mandate pre-staged",
            status: "done",
            detail: `Budget ceiling: $${ceilingBuffer} USD`,
          },
        ],
      },
    };
    setMessages((prev) => [...prev, planNoticeMsg]);
  };

  const handleCreateMandate = (
    newMandate: Omit<Mandate, "id" | "lastScrapedPrice">
  ) => {
    const created: Mandate = {
      ...newMandate,
      id: `mandate-${Date.now()}`,
      lastScrapedPrice: newMandate.budgetCeiling * 0.85,
    };
    setMandates((prev) => [...prev, created]);

    const log: AuditLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      eventType: "MANDATE_CREATED",
      service: newMandate.service,
      details: `New mandate created: Limit $${newMandate.budgetCeiling.toFixed(
        2
      )} ${newMandate.currency}, Recurrence: ${newMandate.recurrence}.`,
      severity: "info",
    };
    setAuditLogs((prev) => [log, ...prev]);

    fetch("/api/mandates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(created),
    }).catch((err) => console.error("Failed to persist mandate:", err));

    fetch("/api/audit-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(log),
    }).catch((err) => console.error("Failed to persist audit log:", err));
  };

  const handleToggleStrictMode = () => {
    setStrictMode((prev) => {
      const next = !prev;
      captureClientEvent("strict_mode_toggled", {
        new_mode: next ? "MANUAL_APPROVAL" : "AUTONOMOUS",
      });
      return next;
    });
  };

  const handleOpenReceipt = (receipt: ReceiptData) => {
    trackReceiptViewed(receipt.orderId, receipt.service);
    setSelectedReceipt(receipt);
  };

  return (
    <ZephiumCleanHome
      mandates={mandates}
      transactions={transactions}
      auditLogs={auditLogs}
      messages={messages}
      chatInput={input}
      onChatInputChange={(val) => setInput(val)}
      onSendMessage={sendMessage}
      onClearChat={clearChat}
      isChatLoading={isLoading}
      onTriggerMandate={handleTriggerMandate}
      onViewReceipt={handleOpenReceipt}
      onCreateMandateClick={() => {
        setMandateInitialData(undefined);
        setIsCreateOpen(true);
      }}
      isCreateOpen={isCreateOpen}
      setIsCreateOpen={setIsCreateOpen}
      mandateInitialData={mandateInitialData}
      strictMode={strictMode}
      onToggleStrictMode={handleToggleStrictMode}
      approvalRequest={approvalRequest}
      onApproveApproval={handleApprove}
      onRejectApproval={handleReject}
      selectedReceipt={selectedReceipt}
      setSelectedReceipt={setSelectedReceipt}
      onDeployPlanMandate={handleDeployPlanMandate}
      onCreateMandateSubmit={handleCreateMandate}
      isCommandOpen={isCommandOpen}
      setIsCommandOpen={setIsCommandOpen}
      onRefreshData={fetchDashboardData}
    />
  );
}
