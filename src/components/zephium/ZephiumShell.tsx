"use client";

import React, { useState, useEffect } from "react";
import {
  Bot,
  X,
  RotateCcw,
} from "lucide-react";
import { ZephiumSidebar, ZephiumTab } from "./ZephiumSidebar";
import { ZephiumAddressBar } from "./ZephiumAddressBar";
import { ZephiumWorkCanvas } from "./ZephiumWorkCanvas";
import { ZephiumTasksModal } from "./ZephiumTasksModal";
import { ZephiumNotesModal } from "./ZephiumNotesModal";
import { LiveBrowserViewport } from "@/components/dashboard/LiveBrowserViewport";
import { ClaudeChat } from "@/components/chat/ClaudeChat";
import { Mandate, Transaction, AuditLog } from "@/components/dashboard/FinancialDashboard";
import { ReceiptDialog, ReceiptData } from "@/components/dashboard/ReceiptDialog";
import { ApprovalDialog, ApprovalRequest } from "@/components/dashboard/ApprovalDialog";
import { CreateMandateDialog } from "@/components/dashboard/CreateMandateDialog";
import { QuickCommandLauncher } from "@/components/dashboard/QuickCommandLauncher";
import { TakeoverChallengeModal } from "@/components/dashboard/TakeoverChallengeModal";
import { ChatMessage } from "@/lib/chat/use-payagent-chat";

interface ZephiumShellProps {
  mandates: Mandate[];
  transactions: Transaction[];
  auditLogs: AuditLog[];
  messages: ChatMessage[];
  chatInput: string;
  onChatInputChange: (val: string) => void;
  onSendMessage: (val: string) => void;
  onClearChat: () => void;
  isChatLoading: boolean;
  onTriggerMandate: (id: string) => void;
  onViewReceipt: (receipt: ReceiptData) => void;
  onCreateMandateClick: () => void;
  isCreateOpen: boolean;
  setIsCreateOpen: (open: boolean) => void;
  mandateInitialData?: {
    service?: string;
    budgetCeiling?: string;
    recurrence?: string;
    category?: string;
  };
  strictMode: boolean;
  onToggleStrictMode: () => void;
  approvalRequest: ApprovalRequest | null;
  onApproveApproval: (fundingSource?: "PAYPAL" | "BACKUP_CARD") => void;
  onRejectApproval: () => void;
  selectedReceipt: ReceiptData | null;
  setSelectedReceipt: (receipt: ReceiptData | null) => void;
  onDeployPlanMandate: (service: string, price: number, planName: string) => void;
  onCreateMandateSubmit: (mandate: Omit<Mandate, "id" | "lastScrapedPrice">) => void;
}

const DEFAULT_TABS: ZephiumTab[] = [
  {
    id: "tab-netflix",
    title: "Netflix — Plans & Pricing",
    url: "https://www.netflix.com/signup/planform",
    active: true,
    isStreaming: true,
    category: "Entertainment",
  },
  {
    id: "tab-spotify",
    title: "Spotify — Premium Individual",
    url: "https://www.spotify.com/us/premium/",
    active: false,
    category: "Audio",
  },
  {
    id: "tab-aws",
    title: "AWS Cloud — Billing & Cost",
    url: "https://aws.amazon.com/pricing/",
    active: false,
    category: "Infrastructure",
  },
  {
    id: "tab-stripe",
    title: "Stripe — Payments & Vault",
    url: "https://stripe.com/pricing",
    active: false,
    category: "SaaS",
  },
  {
    id: "tab-github",
    title: "GitHub — Copilot & Actions",
    url: "https://github.com/pricing",
    active: false,
    category: "Dev Tools",
  },
];

export function ZephiumShell({
  mandates,
  transactions,
  auditLogs,
  messages,
  chatInput,
  onChatInputChange,
  onSendMessage,
  onClearChat,
  isChatLoading,
  onTriggerMandate,
  onViewReceipt,
  onCreateMandateClick,
  isCreateOpen,
  setIsCreateOpen,
  mandateInitialData,
  strictMode,
  onToggleStrictMode,
  approvalRequest,
  onApproveApproval,
  onRejectApproval,
  selectedReceipt,
  setSelectedReceipt,
  onDeployPlanMandate,
  onCreateMandateSubmit,
}: ZephiumShellProps) {
  const [mode, setMode] = useState<"browse" | "work">("work");
  const [tabs, setTabs] = useState<ZephiumTab[]>(DEFAULT_TABS);
  const [activeTabId, setActiveTabId] = useState<string>("tab-netflix");
  const [isAskOpen, setIsAskOpen] = useState(true);
  const [isCalmActive, setIsCalmActive] = useState(false);
  const [isTakeoverOpen, setIsTakeoverOpen] = useState(false);
  const [isTasksOpen, setIsTasksOpen] = useState(false);
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [isCommandOpen, setIsCommandOpen] = useState(false);

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  // Global Keyboard Shortcuts (Zephium standard: ⌘E for Ask, ⌘K for Launcher)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "e") {
        e.preventDefault();
        setIsAskOpen((prev) => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsCommandOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSelectTab = (id: string) => {
    setActiveTabId(id);
    setTabs((prev) =>
      prev.map((t) => ({
        ...t,
        active: t.id === id,
      }))
    );
  };

  const handleCloseTab = (id: string) => {
    if (tabs.length <= 1) return;
    const nextTabs = tabs.filter((t) => t.id !== id);
    setTabs(nextTabs);
    if (activeTabId === id) {
      setActiveTabId(nextTabs[0].id);
    }
  };

  const handleNewTab = () => {
    const newId = `tab-${Date.now()}`;
    const newTab: ZephiumTab = {
      id: newId,
      title: "New Merchant Tab",
      url: "https://www.netflix.com/signup/planform",
      active: true,
    };
    setTabs((prev) => [...prev.map((t) => ({ ...t, active: false })), newTab]);
    setActiveTabId(newId);
  };

  const handleSwitchToBrowseWithUrl = (url: string) => {
    setMode("browse");
    setTabs((prev) =>
      prev.map((t) => {
        if (t.id === activeTabId) {
          return { ...t, url, isStreaming: true };
        }
        return t;
      })
    );
  };

  return (
    <div className="h-screen w-screen flex bg-neutral-950 text-neutral-100 overflow-hidden font-sans select-none">
      {/* 1. Zephium Left Vertical Sidebar */}
      <ZephiumSidebar
        mode={mode}
        onModeChange={(newMode) => setMode(newMode)}
        tabs={tabs}
        activeTabId={activeTabId}
        onSelectTab={handleSelectTab}
        onCloseTab={handleCloseTab}
        onNewTab={handleNewTab}
        strictMode={strictMode}
        onToggleStrictMode={onToggleStrictMode}
        isAskOpen={isAskOpen}
        onToggleAsk={() => setIsAskOpen((prev) => !prev)}
        onOpenTasks={() => setIsTasksOpen(true)}
        onOpenTime={() => setIsNotesOpen(true)}
        onOpenNotes={() => setIsNotesOpen(true)}
        activeTasksCount={mandates.length}
      />

      {/* 2. Main Stage (Browse vs Work Canvas) */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
        {/* Zephium Omnibar / Address bar */}
        <ZephiumAddressBar
          url={activeTab.url}
          onRefresh={() => {}}
          isCalmActive={isCalmActive}
          onToggleCalm={() => setIsCalmActive((prev) => !prev)}
          onManualTakeover={() => setIsTakeoverOpen(true)}
          isStreamingLive={Boolean(activeTab.isStreaming)}
          onOpenCommand={() => setIsCommandOpen(true)}
          isAskOpen={isAskOpen}
          onToggleAsk={() => setIsAskOpen((prev) => !prev)}
        />

        {/* Center Stage Workspace */}
        <div className="flex-1 flex min-h-0 overflow-hidden relative">
          {/* Main Content Area */}
          <main className="flex-1 h-full min-w-0 overflow-hidden relative">
            {mode === "browse" ? (
              <div className="h-full w-full bg-neutral-900 p-2 overflow-hidden flex flex-col">
                <LiveBrowserViewport
                  onPlanSelected={onDeployPlanMandate}
                />
              </div>
            ) : (
              <ZephiumWorkCanvas
                mandates={mandates}
                transactions={transactions}
                auditLogs={auditLogs}
                onTriggerMandate={onTriggerMandate}
                onViewReceipt={onViewReceipt}
                onCreateMandateClick={onCreateMandateClick}
                onDeployPlanMandate={onDeployPlanMandate}
                onSwitchToBrowseWithUrl={handleSwitchToBrowseWithUrl}
              />
            )}
          </main>

          {/* 3. "Ask Zephium / Ask Rico" Collapsible Assistant Sidebar (⌘E) */}
          {isAskOpen && (
            <aside className="w-96 h-full border-l border-neutral-800 bg-neutral-950 flex flex-col shrink-0 z-20 shadow-2xl transition-all">
              <div className="h-10 px-3.5 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/60">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-blue-400" />
                  <span className="font-semibold text-xs text-white">
                    Ask Zephium • Rico
                  </span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-neutral-800 text-neutral-400 font-mono">
                    ⌘E
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={onClearChat}
                    className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
                    title="Reset Conversation"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAskOpen(false)}
                    className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
                    title="Close Sidebar (⌘E)"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Chat Viewport */}
              <div className="flex-1 min-h-0">
                <ClaudeChat
                  messages={messages}
                  input={chatInput}
                  onInputChange={onChatInputChange}
                  onSendMessage={onSendMessage}
                  onClearChat={onClearChat}
                  onViewReceipt={onViewReceipt}
                  strictMode={strictMode}
                  onToggleStrictMode={onToggleStrictMode}
                  isLoading={isChatLoading}
                />
              </div>
            </aside>
          )}
        </div>
      </div>

      {/* Built-in Zephium Modals */}
      <ZephiumTasksModal
        isOpen={isTasksOpen}
        onClose={() => setIsTasksOpen(false)}
        mandates={mandates}
        onTriggerMandate={onTriggerMandate}
        onCreateMandate={() => {
          setIsTasksOpen(false);
          setIsCreateOpen(true);
        }}
      />

      <ZephiumNotesModal
        isOpen={isNotesOpen}
        onClose={() => setIsNotesOpen(false)}
        auditLogs={auditLogs}
      />

      {isTakeoverOpen && (
        <TakeoverChallengeModal
          challengeType="RECAPTCHA"
          serviceName="Netflix Checkout Verification"
          onSolved={() => setIsTakeoverOpen(false)}
          onCancel={() => setIsTakeoverOpen(false)}
        />
      )}

      {/* Financial System Modals */}
      <ReceiptDialog
        receipt={selectedReceipt}
        isOpen={Boolean(selectedReceipt)}
        onClose={() => setSelectedReceipt(null)}
      />

      <ApprovalDialog
        request={approvalRequest}
        isOpen={Boolean(approvalRequest)}
        onApprove={onApproveApproval}
        onReject={onRejectApproval}
      />

      <CreateMandateDialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreate={onCreateMandateSubmit}
        initialData={mandateInitialData}
      />

      <QuickCommandLauncher
        isOpen={isCommandOpen}
        onClose={() => setIsCommandOpen(false)}
        mandates={mandates}
        transactions={transactions}
        auditLogs={auditLogs}
        onSendMessage={(prompt) => {
          setIsAskOpen(true);
          onSendMessage(prompt);
        }}
        onOpenCreateMandate={() => {
          setIsCommandOpen(false);
          setIsCreateOpen(true);
        }}
        onViewReceipt={onViewReceipt}
        onToggleStrictMode={onToggleStrictMode}
        strictMode={strictMode}
      />
    </div>
  );
}
