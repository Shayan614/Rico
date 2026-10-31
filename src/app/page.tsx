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

  // Load live data from SQLite persistent store
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

  // Send message with streaming response from Gemini agent
  const handleSendMessage = async (text: string) => {
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: "user",
      text,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    const assistantMsgId = `msg-resp-${Date.now()}`;
    const initialAssistantMsg: ChatMessage = {
      id: assistantMsgId,
      sender: "assistant",
      text: "",
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      thoughtProcess: {
        summary: "Analyzing mandate...",
        steps: [],
      },
    };

    setMessages((prev) => [...prev, userMsg, initialAssistantMsg]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          strictMode,
          mandates,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Chat request failed");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulatedText = "";
      const currentSteps: { step: string; status: "done" | "running" | "waiting"; detail?: string }[] = [];

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));

            if (event.type === "token" && event.text) {
              accumulatedText += event.text;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? { ...m, text: accumulatedText }
                    : m
                )
              );
            } else if (event.type === "step" && event.step) {
              const existingIdx = currentSteps.findIndex(
                (s) => s.step === event.step.step
              );
              if (existingIdx >= 0) {
                currentSteps[existingIdx] = event.step;
              } else {
                currentSteps.push(event.step);
              }

              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? {
                        ...m,
                        thoughtProcess: {
                          summary: `Autonomous Reasoning (${currentSteps.length} steps)`,
                          steps: [...currentSteps],
                        },
                      }
                    : m
                )
              );
            } else if (event.type === "thought" && event.thought) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? {
                        ...m,
                        thoughtProcess: event.thought,
                      }
                    : m
                )
              );
            } else if (event.type === "receipt" && event.receipt) {
              const receiptData = event.receipt as ReceiptData;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? {
                        ...m,
                        receipt: receiptData,
                      }
                    : m
                )
              );

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
                receiptData: receiptData,
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
            } else if (event.type === "done" && event.text && !accumulatedText) {
              accumulatedText = event.text;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? { ...m, text: accumulatedText }
                    : m
                )
              );
            }
          } catch (parseErr) {
            console.warn("SSE parse error:", parseErr);
          }
        }
      }

      // Check if strict mode approval is required
      if (strictMode && accumulatedText.includes("Strict Approval Mode is ENABLED")) {
        setApprovalRequest({
          id: `req-${Date.now()}`,
          service: text.toLowerCase().includes("netflix")
            ? "Netflix Standard HD"
            : text.toLowerCase().includes("spotify")
            ? "Spotify Premium"
            : "Merchant Service",
          detectedPrice: 15.49,
          budgetCeiling: 20.0,
          reason: "Strict Approval Mode is active. Please confirm before completing PayPal charge.",
          currency: "USD",
        });
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Error streaming response";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? {
                ...m,
                text: `Agent Error: ${errorMsg}`,
              }
            : m
        )
      );
    }
  };

  const handleTriggerMandate = (id: string) => {
    const target = mandates.find((m) => m.id === id);
    if (!target) return;
    handleSendMessage(`Execute mandate now for ${target.service}`);
  };

  const handleApprove = () => {
    if (!approvalRequest) return;
    const req = approvalRequest;
    setApprovalRequest(null);

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

    // Persist new mandate & log to SQLite
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
