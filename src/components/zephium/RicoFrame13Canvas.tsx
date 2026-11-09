"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  ArrowUp,
  Loader2,
  Sparkles,
  RotateCcw,
  PanelLeft,
  SquarePen,
  Plus,
  SlidersHorizontal,
  Columns2,
  User,
  Scan,
  Folder,
  ShieldCheck,
  ShieldAlert,
  Terminal,
} from "lucide-react";
import { Mandate, Transaction, AuditLog } from "@/components/dashboard/FinancialDashboard";
import { ReceiptData } from "@/components/dashboard/ReceiptDialog";
import { ApprovalRequest } from "@/components/dashboard/ApprovalDialog";
import { ChatMessage } from "@/lib/chat/use-payagent-chat";
import { ChatMessageRenderer } from "@/components/chat/ChatMessageRenderer";
import { WorkSurface } from "@/components/dashboard/WorkSurface";
import { useAuth } from "@/lib/auth/AuthContext";

/** Profile icon: opens the sign-in modal when signed out, or a small account menu when signed in. */
function ProfileButton() {
  const { user, session, isAuthenticated, isLoading, openAuthPrompt, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleClick = () => {
    if (isLoading) return;
    if (isAuthenticated) setMenuOpen((open) => !open);
    else openAuthPrompt();
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
    // Reload so no data from the previous account stays on screen.
    window.location.reload();
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleClick}
        title={isAuthenticated && user ? `Signed in as ${user.email}` : "Sign in"}
        aria-label={isAuthenticated ? "Account menu" : "Sign in"}
        className={`w-[28px] h-[28px] rounded-full border flex items-center justify-center text-xs font-semibold transition-colors ${
          isAuthenticated
            ? "bg-slate-800 border-slate-800 text-white"
            : "bg-[#BFD7F7] border-[#A7C8F5] text-slate-700 hover:bg-[#A7C8F5]"
        }`}
      >
        {isLoading ? (
          <Loader2 className="w-[12px] h-[12px] animate-spin" />
        ) : isAuthenticated && user ? (
          user.email.charAt(0).toUpperCase()
        ) : (
          <User className="w-[14px] h-[14px]" />
        )}
      </button>
      {menuOpen && isAuthenticated && user && (
        <div className="absolute left-[36px] bottom-0 z-50 w-[230px] rounded-xl border border-[#BFD7F7] bg-[#F4F9FF] p-3 shadow-lg">
          <p className="text-[11px] text-slate-500">Signed in as</p>
          <p className="text-sm font-medium text-slate-800 truncate" title={user.email}>
            {user.email}
          </p>
          {session?.isSimulated && (
            <p className="mt-1.5 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1">
              Demo session: mock payments only
            </p>
          )}
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="mt-3 w-full h-8 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loggingOut && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

export interface RicoFrame13CanvasProps {
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
  strictMode: boolean;
  onToggleStrictMode: () => void;
  approvalRequest: ApprovalRequest | null;
  onApproveApproval: (fundingSource?: "PAYPAL" | "BACKUP_CARD") => void;
  onRejectApproval: () => void;
  onDeployPlanMandate: (service: string, price: number, planName: string) => void;
  onOpenCommandPalette?: () => void;
  onRefreshData?: () => void;
}

export function RicoFrame13Canvas({
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
  strictMode,
  onToggleStrictMode,
  approvalRequest,
  onApproveApproval,
  onRejectApproval,
  onDeployPlanMandate,
  onOpenCommandPalette,
  onRefreshData,
}: RicoFrame13CanvasProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSplitView, setIsSplitView] = useState(false);
  const [activeThread, setActiveThread] = useState<string>("today-1");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll on new messages or streaming tokens
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isChatLoading]);

  // Auto-focus input on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;
    onSendMessage(chatInput.trim());
    onChatInputChange("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSelectSuggestion = (prompt: string) => {
    onSendMessage(prompt);
  };

  const sampleSuggestions = [
    {
      title: "Pay Netflix $15.99 on 5th, max $20",
      category: "Spending Rule",
      icon: "💳",
      desc: "Autonomously verify plan price & capture via PayPal MCP",
    },
    {
      title: "Spotify Premium $11.99 monthly, cap at $15",
      category: "Subscription",
      icon: "🎵",
      desc: "Live headless browser scrape & budget guardrails",
    },
    {
      title: "Verify AWS cloud bill cap at $120",
      category: "Infrastructure",
      icon: "☁️",
      desc: "Calm Pricing Lens decluttering & ceiling check",
    },
    {
      title: "Check 50% Student Discount for Notion ($4/mo)",
      category: "Credits",
      icon: "🎓",
      desc: "Intercept payment with startup/student deal matrix",
    },
  ];

  return (
    <div
      data-pencil-name="13 — Super Clean RICO Chat Page (Frame 13 Connected)"
      className="box-border w-screen h-screen flex flex-row gap-0 justify-start items-start bg-[#DCEBFE] overflow-hidden select-none font-[Inter,system-ui,sans-serif]"
    >
      {/* 1. Left Icon Rail */}
      <div
        data-pencil-name="Left Icon Rail"
        className="box-border w-[46px] shrink-0 h-full flex flex-col gap-0 p-[12px_7px] justify-between items-center bg-[#CFE3FC] border-r border-[#BFD7F7] z-20"
      >
        <div
          data-pencil-name="Rail Top"
          className="box-border w-full h-fit shrink-0 flex flex-col gap-[10px] justify-start items-center"
        >
          <button
            type="button"
            onClick={onClearChat}
            title="RICO Autonomous Agent • Click to reset chat"
            className="box-border w-[30px] h-[30px] shrink-0 flex flex-row gap-0 justify-center items-center bg-transparent hover:opacity-85 transition-opacity"
          >
            <div
              data-pencil-name="RICO Mark"
              className="box-border w-full h-full bg-[url('/brand-rico-mark-transparent.png')] bg-no-repeat bg-contain bg-center"
            />
          </button>
        </div>

        <div
          data-pencil-name="Rail Bottom"
          className="box-border w-full h-fit shrink-0 flex flex-col gap-[10px] justify-start items-center"
        >
          <button
            type="button"
            onClick={onToggleStrictMode}
            title={
              strictMode
                ? "Strict Approval Mode: Enabled (Halts on anomalies)"
                : "Autonomous Mode: Active (Auto-approves within budget)"
            }
            className={`p-1.5 rounded-lg transition-colors ${
              strictMode
                ? "bg-amber-100 text-amber-700 border border-amber-300"
                : "text-slate-600 hover:bg-[#BFD7F7]/60"
            }`}
          >
            {strictMode ? (
              <ShieldAlert className="w-[15px] h-[15px]" />
            ) : (
              <ShieldCheck className="w-[15px] h-[15px]" />
            )}
          </button>

          <ProfileButton />
        </div>
      </div>

      {/* 2. RICO Chat Threads Sidebar */}
      {isSidebarOpen && (
        <div
          data-pencil-name="RICO Chat Threads Sidebar"
          className="box-border w-[244px] shrink-0 h-full flex flex-col gap-0 p-[10px_12px_14px_12px] justify-between items-start [background-image:linear-gradient(180deg,_#D6E8FD_0%,_#EBF3FE_65%,_#DCEBFE_100%)] bg-no-repeat bg-[length:100%_100%] border-r border-[#C8DDF8] z-10 transition-all"
        >
          <div
            data-pencil-name="Sidebar Top Section"
            className="box-border w-full h-fit shrink-0 flex flex-col gap-[10px] justify-start items-start"
          >
            {/* Sidebar Utility Bar */}
            <div
              data-pencil-name="Sidebar Utility Bar"
              className="box-border w-full h-fit shrink-0 flex flex-row gap-0 p-[2px_2px_4px_2px] justify-between items-center"
            >
              <div
                data-pencil-name="Left"
                className="box-border w-fit shrink-0 h-fit flex flex-row gap-[10px] justify-start items-center"
              >
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(false)}
                  title="Collapse Sidebar"
                  className="p-1 rounded text-slate-600 hover:bg-[#C8DDF8]/60 transition-colors"
                >
                  <PanelLeft className="w-[14px] h-[14px]" />
                </button>
              </div>

              <button
                type="button"
                onClick={onClearChat}
                title="Start New Conversation"
                className="p-1 rounded text-[#0F172A] hover:bg-[#C8DDF8]/60 transition-colors"
              >
                <SquarePen className="w-[14px] h-[14px]" />
              </button>
            </div>

            {/* Ask RICO Sidebar Header */}
            <div
              data-pencil-name="Ask RICO Sidebar Header"
              className="box-border w-full h-fit shrink-0 flex flex-row gap-0 p-[0px_2px_2px_2px] justify-between items-center"
            >
              <div
                data-pencil-name="Title"
                className="text-[14px]/[normal] box-border text-[#0F172A] font-bold text-left"
              >
                Ask RICO
              </div>
              <button
                type="button"
                onClick={onClearChat}
                className="box-border w-fit shrink-0 h-fit flex flex-row gap-[4px] p-[3px_8px] justify-start items-center bg-[#D6E8FD] hover:bg-[#C6DCFA] rounded-[7px] text-[#475569] hover:text-[#0F172A] text-[10.5px] font-medium transition-colors"
                title="Start a new chat conversation"
              >
                <RotateCcw className="w-[11px] h-[11px]" />
                <span>New Chat</span>
              </button>
            </div>

            {/* Spending Rules Group */}
            <div
              data-pencil-name="Today Group"
              className="box-border w-full h-fit shrink-0 flex flex-col gap-[6px] p-[4px_0px_0px_0px] justify-start items-start"
            >
              <div className="flex items-center justify-between w-full pr-1">
                <span className="text-[10.5px] text-[#52637A] font-semibold">
                  Spending Rules
                </span>
                <button
                  type="button"
                  onClick={onCreateMandateClick}
                  className="box-border w-fit shrink-0 h-fit flex flex-row gap-[3px] p-[2.5px_7px] justify-start items-center bg-[#C6DCFA] hover:bg-[#B3D2F8] text-[#0F172A] rounded-[6px] text-[10px] font-semibold transition-all shadow-2xs hover:shadow-xs cursor-pointer active:scale-95"
                  title="Add New Spending Rule"
                >
                  <Plus className="w-[11px] h-[11px]" />
                  <span>Add Rule</span>
                </button>
              </div>

              {mandates.slice(0, 3).map((mandate, idx) => {
                const isSelected = activeThread === `mandate-${idx}`;
                return (
                  <div
                    key={mandate.id}
                    className={`box-border w-full h-fit shrink-0 flex flex-col rounded-[9px] transition-colors ${
                      isSelected
                        ? "bg-[#BBD6F8] shadow-2xs"
                        : "bg-transparent hover:bg-[#C8DDF8]/50"
                    }`}
                  >
                    {/* Selecting a rule only selects it. Paying needs Run now and a confirmation. */}
                    <button
                      type="button"
                      data-testid="sidebar-rule"
                      onClick={() => setActiveThread(`mandate-${idx}`)}
                      className="box-border w-full h-fit flex flex-col gap-[2px] p-[7px_9px] justify-start items-start text-left"
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-[11.5px] text-[#0F172A] font-semibold truncate max-w-[150px]">
                          {mandate.service}
                        </span>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      </div>
                      <div className="text-[10px] text-[#52637A] font-normal">
                        Cap: ${mandate.budgetCeiling.toFixed(2)} •{" "}
                        {mandate.recurrence}
                      </div>
                    </button>
                    {isSelected && (
                      <div className="flex justify-end px-[9px] pb-[7px]">
                        <button
                          type="button"
                          data-testid="sidebar-run-now"
                          onClick={() => onTriggerMandate(mandate.id)}
                          className="h-[22px] px-2 rounded-[6px] bg-[#0F172A] text-white text-[10px] font-semibold hover:bg-[#1E293B] active:scale-95 transition-all"
                          title={`Review and confirm a payment for ${mandate.service}`}
                        >
                          Run now
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Earlier Group */}
            <div
              data-pencil-name="Earlier Group"
              className="box-border w-full h-fit shrink-0 flex flex-col gap-[4px] p-[4px_0px_0px_0px] justify-start items-start"
            >
              <div
                data-pencil-name="Group Label"
                className="text-[10.5px]/[normal] box-border text-[#52637A] font-semibold text-left"
              >
                Quick Actions
              </div>

              <button
                type="button"
                onClick={() =>
                  onSendMessage(
                    "Inspect live pricing for Netflix Standard plan and report discrepancies"
                  )
                }
                className="box-border w-full h-fit shrink-0 flex flex-col gap-[2px] p-[7px_9px] justify-start items-start bg-transparent hover:bg-[#C8DDF8]/50 rounded-[9px] text-left transition-colors"
              >
                <div className="text-[11.5px] text-[#0F172A] font-medium truncate">
                  Inspect Netflix Live DOM
                </div>
                <div className="text-[10px] text-[#52637A]">
                  Playwright CDP Screencast
                </div>
              </button>

              <button
                type="button"
                onClick={() =>
                  onSendMessage(
                    "Scan persona savings for Notion, PostHog, and Stripe deals"
                  )
                }
                className="box-border w-full h-fit shrink-0 flex flex-col gap-[2px] p-[7px_9px] justify-start items-start bg-transparent hover:bg-[#C8DDF8]/50 rounded-[9px] text-left transition-colors"
              >
                <div className="text-[11.5px] text-[#0F172A] font-medium truncate">
                  Scan Student / Startup Credits
                </div>
                <div className="text-[10px] text-[#52637A]">
                  50% Deal Matrix Optimizer
                </div>
              </button>

              <button
                type="button"
                onClick={() =>
                  onSendMessage(
                    "Simulate price increase on Spotify to test 20% guardrail anomaly"
                  )
                }
                className="box-border w-full h-fit shrink-0 flex flex-col gap-[2px] p-[7px_9px] justify-start items-start bg-transparent hover:bg-[#C8DDF8]/50 rounded-[9px] text-left transition-colors"
              >
                <div className="text-[11.5px] text-[#0F172A] font-medium truncate">
                  Test Anomaly Guardrail
                </div>
                <div className="text-[10px] text-[#52637A]">
                  Triggers human approval modal
                </div>
              </button>
            </div>
          </div>

          {/* Sidebar Footer */}
          <div
            data-pencil-name="Sidebar Footer"
            className="box-border w-full h-fit shrink-0 flex flex-row gap-0 p-[8px] justify-between items-center bg-[#CFE3FB] rounded-[10px] border border-[#BDD6F5]"
          >
            <div
              data-pencil-name="Left"
              className="box-border w-fit shrink-0 h-fit flex flex-row gap-[7px] justify-start items-center"
            >
              <Sparkles className="w-[13px] h-[13px] text-blue-600 shrink-0" />
              <div
                data-pencil-name="Model"
                className="text-[11px] box-border text-[#0F172A] font-semibold text-left truncate"
              >
                Gemini 3.8 Flash
              </div>
            </div>

            <button
              type="button"
              onClick={onToggleStrictMode}
              title={
                strictMode
                  ? "Toggle Mode: Currently in Strict Approval Mode"
                  : "Toggle Mode: Currently in Autonomous Mode"
              }
              className="p-1 rounded hover:bg-[#BBD6F8] text-slate-700 transition-colors"
            >
              <SlidersHorizontal className="w-[12px] h-[12px]" />
            </button>
          </div>
        </div>
      )}

      {/* 3. Main Stage: Chat Viewport + Optional Split View Pane */}
      <div
        data-pencil-name="Full Chat Main Viewport"
        className="box-border flex-1 min-w-0 h-full flex flex-row gap-2 p-[8px] justify-start items-start bg-[#DCEBFE] overflow-hidden"
      >
        {/* Chat Canvas Container */}
        <div
          data-pencil-name="Clean Chat Canvas Container"
          className={`box-border h-full flex flex-col gap-0 justify-between items-center [background-image:linear-gradient(180deg,_#EBF4FE_0%,_#F6FAFF_50%,_#EAF3FE_100%)] bg-no-repeat bg-[length:100%_100%] [outline:1px_solid_#C8DDF8] [outline-offset:-0.5px] rounded-[12px] overflow-hidden shadow-xs transition-all ${
            isSplitView ? "w-1/2 min-w-[420px]" : "w-full"
          }`}
        >
          {/* Full Chat Top Header Bar */}
          <div
            data-pencil-name="Full Chat Top Header Bar"
            className="box-border w-full h-[47px] shrink-0 flex flex-row gap-0 p-[10px_16px] justify-between items-center border-b border-[#DCE9FA] bg-white/40 backdrop-blur-xs select-none"
          >
            <div
              data-pencil-name="Header Left"
              className="box-border w-fit shrink-0 h-fit flex flex-row gap-[10px] justify-start items-center"
            >
              {!isSidebarOpen && (
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(true)}
                  title="Expand Sidebar"
                  className="p-1 rounded text-slate-600 hover:bg-[#D6E8FD] transition-colors"
                >
                  <PanelLeft className="w-[15px] h-[15px]" />
                </button>
              )}

              <div
                data-pencil-name="Chat Title"
                className="text-[13.5px] box-border text-[#0F172A] font-bold text-left"
              >
                Ask RICO
              </div>

              <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200/80 text-[10px] font-medium text-emerald-700">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>PayPal MCP Server Connected</span>
              </div>
            </div>

            <div
              data-pencil-name="Header Right Controls"
              className="box-border w-fit shrink-0 h-fit flex flex-row gap-[8px] justify-start items-center"
            >
              {/* Split View Toggle Button */}
              <button
                type="button"
                onClick={() => setIsSplitView((prev) => !prev)}
                className={`box-border w-fit shrink-0 h-fit flex flex-row gap-[5px] p-[5px_10px] justify-start items-center rounded-[8px] transition-all text-[11px] font-medium shadow-2xs ${
                  isSplitView
                    ? "bg-[#2563EB] text-white [outline:1px_solid_#1D4ED8]"
                    : "bg-[#E2EEFD] text-[#334155] hover:bg-[#D4E6FC] [outline:1px_solid_#C8DDF8]"
                }`}
                title="Toggle Split Command Center View (AG Grid, Screencast & Sentinel)"
              >
                <Columns2 className="w-[12px] h-[12px]" />
                <span data-pencil-name="Split Label">
                  {isSplitView ? "Split view: On" : "Split view"}
                </span>
              </button>

              {/* Quick Command Launcher button (⌘K) */}
              {onOpenCommandPalette && (
                <button
                  type="button"
                  onClick={onOpenCommandPalette}
                  className="hidden md:flex items-center gap-1 px-2 py-1 rounded-[8px] bg-[#E2EEFD] text-[#334155] hover:bg-[#D4E6FC] border border-[#C8DDF8] text-[10.5px] font-medium transition-colors"
                  title="Open Quick Command Palette (⌘K / Ctrl+K)"
                >
                  <Terminal className="w-3 h-3" />
                  <span className="font-mono text-[9px] bg-white/70 px-1 rounded">
                    ⌘K
                  </span>
                </button>
              )}

              {/* Clear chat button */}
              <button
                type="button"
                onClick={onClearChat}
                title="Reset Conversation"
                className="p-1.5 rounded-[8px] text-[#475569] hover:text-[#0F172A] hover:bg-[#E2EEFD] transition-colors"
              >
                <RotateCcw className="w-[13px] h-[13px]" />
              </button>
            </div>
          </div>

          {/* Chat Messages Viewport */}
          <div className="flex-1 w-full min-h-0 overflow-y-auto px-4 sm:px-6 py-4 flex flex-col justify-start space-y-4">
            {messages.length === 0 ? (
              /* Frame 13 Super Clean Empty State */
              <div className="flex-1 flex flex-col items-center justify-center text-center max-w-[620px] mx-auto py-12 px-4 space-y-6">
                <div className="w-14 h-14 rounded-2xl bg-[#CFE3FC] border border-[#A7C8F5] flex items-center justify-center shadow-xs">
                  <div className="w-9 h-9 bg-[url('/brand-rico-mark-transparent.png')] bg-no-repeat bg-contain bg-center" />
                </div>

                <div className="space-y-1.5">
                  <h2 className="text-xl font-bold text-[#0F172A] tracking-tight">
                    What spending rule should Rico handle?
                  </h2>
                  <p className="text-xs text-[#52637A] leading-relaxed max-w-[460px] mx-auto">
                    Rico autonomously verifies live merchant pricing via Playwright
                    headless CDP automation, applies budget guardrails, and captures
                    payments on the PayPal Sandbox MCP server.
                  </p>
                </div>

                {/* Quick Suggestion Pills */}
                <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 text-left">
                  {sampleSuggestions.map((item, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleSelectSuggestion(item.title)}
                      className="group p-3 rounded-xl bg-white/90 hover:bg-white border border-[#C8DDF8] hover:border-[#93C5FD] shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{item.icon}</span>
                        <span className="text-[11.5px] font-semibold text-[#0F172A] group-hover:text-blue-600 transition-colors line-clamp-1">
                          {item.title}
                        </span>
                      </div>
                      <p className="text-[10px] text-[#64748B] mt-1 line-clamp-1">
                        {item.desc}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Active Message Stream */
              <div className="w-full max-w-[720px] mx-auto space-y-5">
                {messages.map((message) => (
                  <ChatMessageRenderer
                    key={message.id}
                    message={message}
                    onViewReceipt={onViewReceipt}
                    isExpandedDefault={true}
                  />
                ))}

                {isChatLoading && (
                  <div className="flex items-center gap-2 text-xs text-[#52637A] bg-white/70 backdrop-blur-xs p-3 rounded-xl border border-[#C8DDF8] max-w-[340px]">
                    <Loader2 className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
                    <span>Rico is reasoning and verifying pricing...</span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Bottom Centered Composer Row */}
          <div
            data-pencil-name="Bottom Centered Composer Row"
            className="box-border w-[640px] max-w-[calc(100%-20px)] h-fit shrink-0 flex flex-col gap-0 p-[0px_0px_12px_0px] justify-start items-start"
          >
            <form
              onSubmit={handleSubmit}
              data-pencil-name="RICO Full Chat Composer"
              className="box-border w-full h-fit shrink-0 flex flex-col gap-[8px] p-[10px_14px] justify-start items-start bg-[#FFFFFF] [outline:1.5px_solid_#C7DCF6] [outline-offset:-0.75px] rounded-[16px] shadow-sm hover:[outline-color:#93C5FD] focus-within:[outline-color:#2563EB] transition-all"
            >
              {/* Interactive Input Textarea */}
              <textarea
                ref={textareaRef}
                value={chatInput}
                onChange={(e) => onChatInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder="Ask RICO anything, set a spending rule, or verify pricing..."
                className="w-full resize-none text-[13px] text-[#0F172A] placeholder-[#64748B] outline-none border-none bg-transparent font-normal leading-relaxed min-h-[24px] max-h-[100px]"
              />

              {/* Composer Bottom Controls */}
              <div
                data-pencil-name="Composer Bottom Controls"
                className="box-border w-full h-fit shrink-0 flex flex-row gap-0 justify-between items-center pt-1"
              >
                <div
                  data-pencil-name="Left Icons"
                  className="box-border w-fit shrink-0 h-fit flex flex-row gap-[8px] justify-start items-center"
                >
                  <button
                    type="button"
                    onClick={onCreateMandateClick}
                    title="Create New Spending Rule"
                    className="p-1 rounded text-[#475569] hover:text-blue-600 hover:bg-[#E2EEFD] transition-colors cursor-pointer"
                  >
                    <Plus className="w-[15px] h-[15px]" />
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      onSendMessage(
                        "Verify merchant pricing for Netflix Standard HD plan"
                      )
                    }
                    title="Run Live Playwright CDP Element Inspection"
                    className="p-1 rounded text-[#475569] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors"
                  >
                    <Scan className="w-[15px] h-[15px]" />
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      onSendMessage(
                        "Scan active credits and discounts for developer tools"
                      )
                    }
                    title="Scan Persona Savings Deals"
                    className="p-1 rounded text-[#475569] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors"
                  >
                    <Folder className="w-[15px] h-[15px]" />
                  </button>
                </div>

                <div
                  data-pencil-name="Right Controls"
                  className="box-border w-fit shrink-0 h-fit flex flex-row gap-[8px] justify-start items-center"
                >
                  {/* Model Pill */}
                  <div
                    data-pencil-name="Model Pill"
                    className="box-border w-fit shrink-0 h-fit flex flex-row gap-[4px] p-[4px_8px_4px_7px] justify-start items-center bg-[#E2ECF8] rounded-[10px]"
                  >
                    <Sparkles className="w-[11px] h-[11px] text-[#334155]" />
                    <div
                      data-pencil-name="Model Name"
                      className="text-[10.5px] box-border text-[#1E293B] font-semibold text-left select-none"
                    >
                      Gemini 3.8 Flash
                    </div>
                  </div>

                  {/* Send Button */}
                  <button
                    type="submit"
                    disabled={!chatInput.trim() && !isChatLoading}
                    data-pencil-name="Send Button"
                    className={`box-border w-[26px] shrink-0 h-[26px] flex flex-row gap-0 justify-center items-center rounded-[13px] transition-all ${
                      chatInput.trim() && !isChatLoading
                        ? "bg-[#181A1F] text-white hover:bg-black shadow-xs cursor-pointer"
                        : "bg-[#94A3B8] text-white/80 cursor-not-allowed opacity-60"
                    }`}
                  >
                    {isChatLoading ? (
                      <Loader2 className="w-[13px] h-[13px] animate-spin text-white" />
                    ) : (
                      <ArrowUp className="w-[13px] h-[13px] text-white stroke-[2.5]" />
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>

        {/* Optional Split-Screen WorkSurface (Triggered via "Split view") */}
        {isSplitView && (
          <div className="flex-1 h-full min-w-[420px] rounded-[12px] border border-[#C8DDF8] overflow-hidden bg-white shadow-xs">
            <WorkSurface
              mandates={mandates}
              transactions={transactions}
              auditLogs={auditLogs}
              onTriggerMandate={onTriggerMandate}
              onViewReceipt={onViewReceipt}
              onCreateMandateClick={onCreateMandateClick}
              onDeployPlanMandate={onDeployPlanMandate}
              approvalRequest={approvalRequest}
              onApproveApproval={onApproveApproval}
              onRejectApproval={onRejectApproval}
              onRefreshData={onRefreshData}
            />
          </div>
        )}
      </div>
    </div>
  );
}
