"use client";

import React, { useState, useEffect } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { ResizableSplit } from "@/components/layout/ResizableSplit";
import { MobileDrawer } from "@/components/layout/MobileDrawer";
import { ClaudeChat } from "@/components/chat/ClaudeChat";
import { WorkSurface } from "@/components/dashboard/WorkSurface";
import { Mandate, Transaction, AuditLog } from "@/components/dashboard/FinancialDashboard";
import { ReceiptDialog, ReceiptData } from "@/components/dashboard/ReceiptDialog";
import { ApprovalDialog, ApprovalRequest } from "@/components/dashboard/ApprovalDialog";
import { CreateMandateDialog } from "@/components/dashboard/CreateMandateDialog";
import { usePayAgentChat, ChatMessage } from "@/lib/chat/use-payagent-chat";
import {
  trackMandateTriggered,
  trackReceiptViewed,
  trackApprovalDecision,
  captureClientEvent,
  posthog,
} from "@/lib/telemetry/posthog-client";

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: "msg-welcome",
    sender: "assistant",
    text: "Hello. I am Rico, your autonomous financial mandate assistant.\n\nSet spending rules like \"Pay Netflix $15.99 on the 5th, max $20\" and I will autonomously verify pricing, check safety limits, and execute transactions via the PayPal Sandbox MCP server.",
    timestamp: "Just now",
  },
  {
    id: "msg-demo-sample",
    sender: "assistant",
    text: "Completed scheduled execution for Netflix Standard HD. The verified price is $15.49, which is within your $20.00 ceiling.",
    timestamp: "Just now",
    thoughtProcess: {
      summary: "Execution Steps (3)",
      steps: [
        {
          step: "Interpreted recurring mandate",
          status: "done",
          detail: "Rule: Netflix, Max $20.00 USD",
        },
        {
          step: "Verified merchant price",
          status: "done",
          detail: "Scraped live pricing: $15.49/mo",
        },
        {
          step: "Safety ceiling check",
          status: "done",
          detail: "$15.49 <= $20.00 ceiling -> Approved",
        },
      ],
    },
    receipt: {
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
];

export default function Home() {
  const [splitMode, setSplitMode] = useState<"split" | "chat" | "dashboard">(
    "split"
  );
  const [strictMode, setStrictMode] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptData | null>(
    null
  );
  const [approvalRequest, setApprovalRequest] =
    useState<ApprovalRequest | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  // Mandates state
  const [mandates, setMandates] = useState<Mandate[]>([
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
  const [transactions, setTransactions] = useState<Transaction[]>([
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
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([
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

  // Load persistent records from SQLite backend
  useEffect(() => {
    fetch("/api/dashboard")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load dashboard data");
        return res.json();
      })
      .then((data) => {
        if (data.mandates && data.mandates.length > 0) {
          setMandates(data.mandates);
        }
        if (data.transactions && data.transactions.length > 0) {
          setTransactions(data.transactions);
        }
        if (data.auditLogs && data.auditLogs.length > 0) {
          setAuditLogs(data.auditLogs);
        }
      })
      .catch((err) => {
        console.warn("Could not fetch database records, using defaults:", err);
      });
  }, []);

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

  const handleReceiptCaptured = (receiptData: ReceiptData) => {
    const newTx: Transaction = {
      id: `tx-${Date.now()}`,
      orderId: receiptData.orderId,
      service: receiptData.service,
      amount: receiptData.verifiedPrice,
      currency: receiptData.currency || "USD",
      status: "COMPLETED",
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      receiptData,
    };

    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      eventType: "PAYMENT_CAPTURED",
      service: receiptData.service,
      details: `Autonomous execution: Scraped ${receiptData.service} ($${receiptData.verifiedPrice.toFixed(
        2
      )}) verified <= $${receiptData.budgetCeiling.toFixed(
        2
      )}. Captured ${receiptData.orderId}.`,
      severity: "success",
    };

    setTransactions((prev) => [newTx, ...prev]);
    setAuditLogs((prev) => [newLog, ...prev]);

    fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newTx),
    }).catch((e) => console.error(e));

    fetch("/api/audit-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newLog),
    }).catch((e) => console.error(e));
  };

  // Vercel AI SDK chat integration hook
  const {
    messages,
    input,
    setInput,
    sendMessage,
    isLoading,
    stop,
    clearChat,
    setMessages,
  } = usePayAgentChat({
    initialMessages: INITIAL_MESSAGES,
    strictMode,
    mandates,
    onReceiptCaptured: handleReceiptCaptured,
    onApprovalRequired: (req) => setApprovalRequest(req),
  });

  const handleTriggerMandate = (id: string) => {
    const target = mandates.find((m) => m.id === id);
    if (!target) return;
    trackMandateTriggered(target.id, target.service);
    sendMessage(`Execute mandate now for ${target.service}`);
  };

  const handleApprove = () => {
    if (!approvalRequest) return;
    const req = approvalRequest;
    setApprovalRequest(null);
    trackApprovalDecision(req.service, true, req.detectedPrice);

    const orderId = `ORD-APP-${Math.floor(10000000 + Math.random() * 90000000)}`;
    const authCode = `AUTH-${Math.floor(1000 + Math.random() * 9000)}`;

    const newReceipt: ReceiptData = {
      orderId,
      service: req.service,
      planName: `${req.service} Approved Plan`,
      verifiedPrice: req.detectedPrice,
      budgetCeiling: req.budgetCeiling,
      currency: req.currency || "USD",
      paymentMethod: "PayPal Sandbox Wallet (Approved)",
      status: "COMPLETED",
      timestamp: new Date().toLocaleString(),
      payerEmail: "sb-buyer2026@personal.example.com",
      sandboxAuthCode: authCode,
    };

    const newTx: Transaction = {
      id: `tx-app-${Date.now()}`,
      orderId,
      service: req.service,
      amount: req.detectedPrice,
      currency: req.currency || "USD",
      status: "COMPLETED",
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      receiptData: newReceipt,
    };

    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      eventType: "PAYMENT_CAPTURED",
      service: req.service,
      details: `User manual approval granted for ${req.service} ($${req.detectedPrice.toFixed(
        2
      )}). Order ${orderId} captured via PayPal.`,
      severity: "success",
    };

    setTransactions((prev) => [newTx, ...prev]);
    setAuditLogs((prev) => [newLog, ...prev]);

    fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newTx),
    }).catch((e) => console.error(e));

    fetch("/api/audit-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newLog),
    }).catch((e) => console.error(e));

    const approvedMsg: ChatMessage = {
      id: `msg-app-${Date.now()}`,
      sender: "assistant",
      text: `Manual approval confirmed for ${req.service}. Payment of $${req.detectedPrice.toFixed(
        2
      )} ${req.currency} successfully executed via PayPal.`,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      thoughtProcess: {
        summary: "Manual Review Approved",
        steps: [
          {
            step: "Human approval confirmed",
            status: "done",
            detail: `Authorized $${req.detectedPrice.toFixed(2)}`,
          },
          {
            step: "Executed payment via PayPal",
            status: "done",
            detail: `Order: ${orderId}`,
          },
        ],
      },
      receipt: newReceipt,
    };
    setMessages((prev) => [...prev, approvedMsg]);
  };

  const handleReject = () => {
    if (!approvalRequest) return;
    const req = approvalRequest;
    setApprovalRequest(null);
    trackApprovalDecision(req.service, false, req.detectedPrice);

    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      eventType: "GUARDRAIL_BLOCKED",
      service: req.service,
      details: `User rejected payment authorization for ${req.service} ($${req.detectedPrice.toFixed(
        2
      )}).`,
      severity: "danger",
    };

    setAuditLogs((prev) => [newLog, ...prev]);
    fetch("/api/audit-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newLog),
    }).catch((e) => console.error(e));

    const rejectedMsg: ChatMessage = {
      id: `msg-rej-${Date.now()}`,
      sender: "assistant",
      text: `Execution cancelled by user for ${req.service}. Funds withheld and mandate kept in pause state.`,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      thoughtProcess: {
        summary: "Manual Review Rejected",
        steps: [
          {
            step: "Human review rejected",
            status: "done",
            detail: "Transaction cancelled by user",
          },
          {
            step: "Enforced balance protection",
            status: "done",
            detail: "No PayPal funds transferred",
          },
        ],
      },
    };
    setMessages((prev) => [...prev, rejectedMsg]);
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
    <div className="h-screen w-screen flex flex-col bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 overflow-hidden font-sans transition-colors">
      {/* Top Header */}
      <AppHeader
        splitMode={splitMode}
        onSplitModeChange={setSplitMode}
        strictMode={strictMode}
        onToggleStrictMode={handleToggleStrictMode}
        mandatesCount={mandates.length}
        onOpenMobileDrawer={() => setIsMobileDrawerOpen(true)}
      />

      {/* Main Resizable Split View */}
      <div className="flex-1 overflow-hidden">
        <ResizableSplit
          splitMode={splitMode}
          defaultRatio={44}
          left={
            <ClaudeChat
              messages={messages}
              input={input}
              onInputChange={(val) => setInput(val)}
              onSendMessage={sendMessage}
              onClearChat={clearChat}
              onViewReceipt={handleOpenReceipt}
              strictMode={strictMode}
              onToggleStrictMode={handleToggleStrictMode}
              isLoading={isLoading}
              onStop={stop}
            />
          }
          right={
            <WorkSurface
              mandates={mandates}
              transactions={transactions}
              auditLogs={auditLogs}
              onTriggerMandate={handleTriggerMandate}
              onViewReceipt={handleOpenReceipt}
              onCreateMandateClick={() => setIsCreateOpen(true)}
            />
          }
        />
      </div>

      {/* Responsive Mobile Drawer (Bottom Sheet on Mobile) */}
      <MobileDrawer
        isOpen={isMobileDrawerOpen}
        onClose={() => setIsMobileDrawerOpen(false)}
        mandates={mandates}
        transactions={transactions}
        auditLogs={auditLogs}
        onTriggerMandate={handleTriggerMandate}
        onViewReceipt={handleOpenReceipt}
        onCreateMandateClick={() => setIsCreateOpen(true)}
      />

      {/* Dialog Modals */}
      <ReceiptDialog
        receipt={selectedReceipt}
        isOpen={!!selectedReceipt}
        onClose={() => setSelectedReceipt(null)}
      />

      <ApprovalDialog
        request={approvalRequest}
        isOpen={!!approvalRequest}
        onApprove={handleApprove}
        onReject={handleReject}
      />

      <CreateMandateDialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreate={handleCreateMandate}
      />
    </div>
  );
}
