"use client";

import React, { useState, useEffect } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { ResizableSplit } from "@/components/layout/ResizableSplit";
import { ClaudeChat, ChatMessage } from "@/components/chat/ClaudeChat";
import { WorkSurface } from "@/components/dashboard/WorkSurface";
import { Mandate, Transaction, AuditLog } from "@/components/dashboard/FinancialDashboard";
import { ReceiptDialog, ReceiptData } from "@/components/dashboard/ReceiptDialog";
import { ApprovalDialog, ApprovalRequest } from "@/components/dashboard/ApprovalDialog";
import { CreateMandateDialog } from "@/components/dashboard/CreateMandateDialog";

export default function Home() {
  const [splitMode, setSplitMode] = useState<"split" | "chat" | "dashboard">(
    "split"
  );
  const [strictMode, setStrictMode] = useState(false);
  const [darkMode, setDarkMode] = useState(false); // White by default!
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptData | null>(
    null
  );
  const [approvalRequest, setApprovalRequest] =
    useState<ApprovalRequest | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Apply dark mode class to html element
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  // Mandates
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

  // Transactions
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

  // Audit Logs
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
      details:
        "Verified Netflix standard subscription price: $15.49/mo.",
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

  // Messages
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "msg-welcome",
      sender: "assistant",
      text: "Hello. I am PayAgent, your autonomous financial mandate assistant.\n\nSet spending rules like \"Pay Netflix $15.99 on the 5th, max $20\" and I will autonomously verify pricing, check safety limits, and execute transactions.",
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
  ]);

  // Send message
  const handleSendMessage = (text: string) => {
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: "user",
      text,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setMessages((prev) => [...prev, userMsg]);

    setTimeout(() => {
      const lower = text.toLowerCase();
      const detectedService = lower.includes("netflix")
        ? "Netflix"
        : lower.includes("spotify")
        ? "Spotify"
        : lower.includes("aws")
        ? "AWS Cloud"
        : lower.includes("github")
        ? "GitHub Copilot"
        : "Merchant Service";

      if (strictMode) {
        setApprovalRequest({
          id: `req-${Date.now()}`,
          service: detectedService,
          detectedPrice: 15.99,
          budgetCeiling: 20.0,
          reason:
            "Manual Approval Mode is active. Please confirm before completing execution.",
          currency: "USD",
        });

        const holdMsg: ChatMessage = {
          id: `msg-hold-${Date.now()}`,
          sender: "assistant",
          text: `Verified pricing for ${detectedService} at $15.99 (limit: $20.00). Manual approval is required.`,
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          thoughtProcess: {
            summary: "Manual Approval Required",
            steps: [
              {
                step: `Verified ${detectedService} price: $15.99`,
                status: "done",
              },
              {
                step: "Verified $15.99 <= $20.00 cap",
                status: "done",
              },
              {
                step: "Awaiting confirmation",
                status: "running",
              },
            ],
          },
        };
        setMessages((prev) => [...prev, holdMsg]);
        return;
      }

      const orderId = `ORD-${Math.floor(10000000 + Math.random() * 90000000)}`;
      const price = lower.includes("spotify")
        ? 11.99
        : lower.includes("aws")
        ? 45.0
        : 15.99;
      const ceiling = lower.includes("spotify") ? 15.0 : 20.0;

      const newReceipt: ReceiptData = {
        orderId,
        service: detectedService,
        planName: `${detectedService} Subscription`,
        verifiedPrice: price,
        budgetCeiling: ceiling,
        currency: "USD",
        paymentMethod: "Connected Account",
        status: "COMPLETED",
        timestamp: new Date().toLocaleString(),
        payerEmail: "user@example.com",
        sandboxAuthCode: `AUTH-${Math.floor(1000 + Math.random() * 9000)}`,
      };

      const newTx: Transaction = {
        id: `tx-${Date.now()}`,
        orderId,
        service: detectedService,
        amount: price,
        currency: "USD",
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
        service: detectedService,
        details: `Autonomous execution: Scraped ${detectedService} ($${price.toFixed(
          2
        )}) verified <= $${ceiling.toFixed(2)}. Captured ${orderId}.`,
        severity: "success",
      };

      setTransactions((prev) => [newTx, ...prev]);
      setAuditLogs((prev) => [newLog, ...prev]);

      const botMsg: ChatMessage = {
        id: `msg-resp-${Date.now()}`,
        sender: "assistant",
        text: `Mandate executed for ${detectedService}. Verified price is $${price.toFixed(
          2
        )} USD, within your $${ceiling.toFixed(2)} limit.`,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        thoughtProcess: {
          summary: `Verified $${price.toFixed(2)} & Captured Order`,
          steps: [
            {
              step: `Checked ${detectedService} pricing`,
              status: "done",
            },
            {
              step: `Verified price $${price.toFixed(2)} <= limit $${ceiling.toFixed(2)}`,
              status: "done",
            },
            {
              step: `Captured order ${orderId}`,
              status: "done",
            },
          ],
        },
        receipt: newReceipt,
      };

      setMessages((prev) => [...prev, botMsg]);
    }, 500);
  };

  const handleTriggerMandate = (id: string) => {
    const target = mandates.find((m) => m.id === id);
    if (!target) return;
    handleSendMessage(`Execute mandate now for ${target.service}`);
  };

  const handleApprove = () => {
    setApprovalRequest(null);
    const approvedMsg: ChatMessage = {
      id: `msg-app-${Date.now()}`,
      sender: "assistant",
      text: "Payment approved. Order captured successfully.",
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
    setMessages((prev) => [...prev, approvedMsg]);
  };

  const handleReject = () => {
    setApprovalRequest(null);
    const rejectedMsg: ChatMessage = {
      id: `msg-rej-${Date.now()}`,
      sender: "assistant",
      text: "Payment was rejected. Funds withheld.",
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
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
  };

  return (
    <div className={`h-screen w-screen flex flex-col ${darkMode ? "dark bg-neutral-950 text-neutral-100" : "bg-white text-neutral-900"} overflow-hidden font-sans transition-colors`}>
      {/* Top Header */}
      <AppHeader
        splitMode={splitMode}
        onSplitModeChange={setSplitMode}
        strictMode={strictMode}
        onToggleStrictMode={() => setStrictMode((prev) => !prev)}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode((prev) => !prev)}
      />

      {/* Main Resizable Split (Clean Monochrome) */}
      <div className="flex-1 overflow-hidden">
        <ResizableSplit
          splitMode={splitMode}
          defaultRatio={44}
          left={
            <ClaudeChat
              messages={messages}
              onSendMessage={handleSendMessage}
              onClearChat={() => setMessages([])}
              onViewReceipt={(receipt) => setSelectedReceipt(receipt)}
              strictMode={strictMode}
              onToggleStrictMode={() => setStrictMode((prev) => !prev)}
            />
          }
          right={
            <WorkSurface
              mandates={mandates}
              transactions={transactions}
              auditLogs={auditLogs}
              onTriggerMandate={handleTriggerMandate}
              onViewReceipt={(receipt) => setSelectedReceipt(receipt)}
              onCreateMandateClick={() => setIsCreateOpen(true)}
            />
          }
        />
      </div>

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
