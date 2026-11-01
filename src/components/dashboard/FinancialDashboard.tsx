"use client";

import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CreditCard,
  ShieldCheck,
  TrendingDown,
  ExternalLink,
  Plus,
  Play,
  AlertTriangle,
  FileText,
  Activity,
  Layers,
} from "lucide-react";
import { ReceiptData } from "./ReceiptDialog";

export interface Mandate {
  id: string;
  service: string;
  budgetCeiling: number;
  lastScrapedPrice: number;
  recurrence: string;
  nextRun: string;
  status: "ACTIVE" | "PAUSED" | "ANOMALY_HOLD";
  category: string;
  currency: string;
}

export interface Transaction {
  id: string;
  orderId: string;
  service: string;
  amount: number;
  currency: string;
  status: "COMPLETED" | "PENDING" | "BLOCKED";
  timestamp: string;
  receiptData?: ReceiptData;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  eventType: "PRICE_VERIFIED" | "GUARDRAIL_BLOCKED" | "PAYMENT_CAPTURED" | "MANDATE_CREATED";
  service: string;
  details: string;
  severity: "info" | "warning" | "success" | "danger";
}

interface FinancialDashboardProps {
  mandates: Mandate[];
  transactions: Transaction[];
  auditLogs: AuditLog[];
  onTriggerMandate: (id: string) => void;
  onViewReceipt: (receipt: ReceiptData) => void;
  onCreateMandateClick: () => void;
}

export function FinancialDashboard({
  mandates,
  transactions,
  auditLogs,
  onTriggerMandate,
  onViewReceipt,
  onCreateMandateClick,
}: FinancialDashboardProps) {
  const [activeTab, setActiveTab] = useState("mandates");

  const totalDisbursed = transactions
    .filter((t) => t.status === "COMPLETED")
    .reduce((acc, curr) => acc + curr.amount, 0);

  const blockedCount = auditLogs.filter(
    (l) => l.eventType === "GUARDRAIL_BLOCKED"
  ).length;

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur p-3 rounded-xl shadow">
          <div className="flex items-center justify-between text-slate-400 text-xs pb-1">
            <span>Active Mandates</span>
            <CreditCard className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="text-xl font-bold text-white">
            {mandates.filter((m) => m.status === "ACTIVE").length}
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">
            Auto-managed recurring limits
          </p>
        </Card>

        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur p-3 rounded-xl shadow">
          <div className="flex items-center justify-between text-slate-400 text-xs pb-1">
            <span>Total Captured</span>
            <TrendingDown className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-emerald-400">
            ${totalDisbursed.toFixed(2)}
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">
            Through PayPal MCP Sandbox
          </p>
        </Card>

        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur p-3 rounded-xl shadow">
          <div className="flex items-center justify-between text-slate-400 text-xs pb-1">
            <span>Guardrail Intercepts</span>
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-xl font-bold text-amber-400">
            {blockedCount}
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">
            Price spikes & anomaly halts
          </p>
        </Card>

        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur p-3 rounded-xl shadow">
          <div className="flex items-center justify-between text-slate-400 text-xs pb-1">
            <span>Avg Reasoning</span>
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-xl font-bold text-cyan-400">1.18s</div>
          <p className="text-[10px] text-slate-500 mt-0.5">
            Gemini 3.8 Flash latency
          </p>
        </Card>
      </div>

      {/* Main Interactive Table & Tabs Container */}
      <Card className="flex-1 border-slate-800 bg-slate-900/60 backdrop-blur rounded-xl flex flex-col overflow-hidden shadow-xl">
        <Tabs
          defaultValue="mandates"
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex-1 flex flex-col"
        >
          {/* Tabs Top Bar */}
          <div className="px-4 py-3 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/40">
            <TabsList className="bg-slate-950 border border-slate-800 p-1 rounded-lg">
              <TabsTrigger
                value="mandates"
                className="text-xs px-3 data-[state=active]:bg-blue-600 data-[state=active]:text-white"
              >
                Mandates ({mandates.length})
              </TabsTrigger>
              <TabsTrigger
                value="transactions"
                className="text-xs px-3 data-[state=active]:bg-blue-600 data-[state=active]:text-white"
              >
                Transactions ({transactions.length})
              </TabsTrigger>
              <TabsTrigger
                value="audit"
                className="text-xs px-3 data-[state=active]:bg-blue-600 data-[state=active]:text-white"
              >
                Audit & Guardrails ({auditLogs.length})
              </TabsTrigger>
              <TabsTrigger
                value="architecture"
                className="text-xs px-3 data-[state=active]:bg-blue-600 data-[state=active]:text-white"
              >
                Miro & Architecture
              </TabsTrigger>
            </TabsList>

            <Button
              size="sm"
              onClick={onCreateMandateClick}
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs h-8 flex items-center gap-1.5 shadow-md shadow-blue-600/30"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Mandate</span>
            </Button>
          </div>

          {/* TAB 1: MANDATES */}
          <TabsContent
            value="mandates"
            className="flex-1 p-0 m-0 overflow-y-auto"
          >
            <Table>
              <TableHeader className="bg-slate-950/80 sticky top-0 border-b border-slate-800">
                <TableRow className="border-slate-800 hover:bg-transparent">
                  <TableHead className="text-slate-400 text-xs">Merchant / Service</TableHead>
                  <TableHead className="text-slate-400 text-xs">Budget Ceiling</TableHead>
                  <TableHead className="text-slate-400 text-xs">Live Web Price</TableHead>
                  <TableHead className="text-slate-400 text-xs">Schedule</TableHead>
                  <TableHead className="text-slate-400 text-xs">Status</TableHead>
                  <TableHead className="text-slate-400 text-xs text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mandates.map((mandate) => (
                  <TableRow
                    key={mandate.id}
                    className="border-slate-800/60 hover:bg-slate-800/40 text-xs"
                  >
                    <TableCell className="font-medium text-white">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-md bg-slate-800 border border-slate-700 flex items-center justify-center text-blue-400 font-bold text-xs">
                          {mandate.service.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-100">
                            {mandate.service}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {mandate.category}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-200 font-semibold">
                      ${mandate.budgetCeiling.toFixed(2)} {mandate.currency}
                    </TableCell>
                    <TableCell>
                      <span className="text-emerald-400 font-semibold">
                        ${mandate.lastScrapedPrice.toFixed(2)}
                      </span>
                      <span className="text-[10px] text-slate-500 block">
                        via Playwright CDP
                      </span>
                    </TableCell>
                    <TableCell className="text-slate-300">
                      <div>{mandate.recurrence}</div>
                      <div className="text-[10px] text-slate-500">
                        Next: {mandate.nextRun}
                      </div>
                    </TableCell>
                    <TableCell>
                      {mandate.status === "ACTIVE" && (
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 text-[10px]">
                          Active
                        </Badge>
                      )}
                      {mandate.status === "PAUSED" && (
                        <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/40 text-[10px]">
                          Paused
                        </Badge>
                      )}
                      {mandate.status === "ANOMALY_HOLD" && (
                        <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/40 text-[10px]">
                          Anomaly Hold
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onTriggerMandate(mandate.id)}
                        className="h-7 px-2.5 border-slate-700 bg-slate-800 hover:bg-blue-600 hover:text-white text-slate-300 text-xs flex items-center gap-1 inline-flex"
                      >
                        <Play className="w-3 h-3 text-emerald-400" />
                        <span>Run Now</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          {/* TAB 2: TRANSACTIONS */}
          <TabsContent
            value="transactions"
            className="flex-1 p-0 m-0 overflow-y-auto"
          >
            <Table>
              <TableHeader className="bg-slate-950/80 sticky top-0 border-b border-slate-800">
                <TableRow className="border-slate-800 hover:bg-transparent">
                  <TableHead className="text-slate-400 text-xs">PayPal Order ID</TableHead>
                  <TableHead className="text-slate-400 text-xs">Merchant</TableHead>
                  <TableHead className="text-slate-400 text-xs">Amount</TableHead>
                  <TableHead className="text-slate-400 text-xs">Status</TableHead>
                  <TableHead className="text-slate-400 text-xs">Timestamp</TableHead>
                  <TableHead className="text-slate-400 text-xs text-right">Receipt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow
                    key={tx.id}
                    className="border-slate-800/60 hover:bg-slate-800/40 text-xs"
                  >
                    <TableCell className="font-mono text-cyan-400">
                      {tx.orderId}
                    </TableCell>
                    <TableCell className="font-medium text-white">
                      {tx.service}
                    </TableCell>
                    <TableCell className="text-emerald-400 font-bold">
                      ${tx.amount.toFixed(2)} {tx.currency}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={`text-[10px] ${
                          tx.status === "COMPLETED"
                            ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                            : "bg-rose-500/20 text-rose-400 border-rose-500/40"
                        }`}
                      >
                        {tx.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-400">
                      {tx.timestamp}
                    </TableCell>
                    <TableCell className="text-right">
                      {tx.receiptData && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onViewReceipt(tx.receiptData!)}
                          className="h-7 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-950/40"
                        >
                          <FileText className="w-3.5 h-3.5 mr-1" />
                          View
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          {/* TAB 3: AUDIT & GUARDRAILS */}
          <TabsContent
            value="audit"
            className="flex-1 p-3 m-0 overflow-y-auto space-y-2.5"
          >
            {auditLogs.map((log) => (
              <div
                key={log.id}
                className="p-3 rounded-lg border border-slate-800 bg-slate-950/60 flex items-start justify-between gap-3 text-xs"
              >
                <div className="flex items-start gap-2.5">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      log.severity === "danger"
                        ? "bg-rose-950 text-rose-400 border border-rose-800/50"
                        : log.severity === "warning"
                        ? "bg-amber-950 text-amber-400 border border-amber-800/50"
                        : "bg-emerald-950 text-emerald-400 border border-emerald-800/50"
                    }`}
                  >
                    {log.severity === "danger" || log.severity === "warning" ? (
                      <AlertTriangle className="w-4 h-4" />
                    ) : (
                      <ShieldCheck className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-100">
                        {log.service}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[10px] border-slate-700 text-slate-400"
                      >
                        {log.eventType}
                      </Badge>
                    </div>
                    <p className="text-slate-300 mt-1">{log.details}</p>
                  </div>
                </div>

                <div className="text-[10px] text-slate-500 whitespace-nowrap">
                  {log.timestamp}
                </div>
              </div>
            ))}
          </TabsContent>

          {/* TAB 4: ARCHITECTURE & MIRO */}
          <TabsContent
            value="architecture"
            className="flex-1 p-4 m-0 overflow-y-auto space-y-4 text-xs"
          >
            <div className="p-4 rounded-xl bg-gradient-to-br from-blue-950/40 via-slate-900 to-purple-950/30 border border-blue-500/20">
              <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-400" />
                Live Architecture & Miro Synchronization
              </h3>
              <p className="text-slate-300 leading-relaxed mb-3">
                Rico connects natural language mandates to real-world browser execution and official PayPal AI MCP Server payments. Telemetry, token usage, and anomaly triggers are logged directly into PostHog.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800">
                  <span className="font-semibold text-white block mb-1">
                    PayPal AI Toolkit MCP Server
                  </span>
                  <code className="text-[11px] text-cyan-400 font-mono block">
                    https://mcp.sandbox.paypal.com/sse
                  </code>
                </div>
                <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800">
                  <span className="font-semibold text-white block mb-1">
                    Canonical Miro Board
                  </span>
                  <a
                    href="https://miro.com/app/board/uXjVETEzN_g=/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-yellow-400 hover:underline flex items-center gap-1"
                  >
                    <span>View Live Flow Diagram</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
