"use client";

import React, { useMemo, useState, useCallback, useRef } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  ColDef,
  ModuleRegistry,
  AllCommunityModule,
  ICellRendererParams,
  themeQuartz,
} from "ag-grid-community";
import { Transaction } from "./FinancialDashboard";
import { ReceiptData } from "./ReceiptDialog";
import {
  Search,
  CheckCircle2,
  Copy,
  Check,
  FileText,
  Download,
  AlertCircle,
  Clock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

// Ensure community modules are registered
ModuleRegistry.registerModules([AllCommunityModule]);

interface AgGridTransactionsTableProps {
  transactions: Transaction[];
  onViewReceipt: (receipt: ReceiptData) => void;
  isDarkMode?: boolean;
}

export function AgGridTransactionsTable({
  transactions,
  onViewReceipt,
  isDarkMode = false,
}: AgGridTransactionsTableProps) {
  const [quickFilterText, setQuickFilterText] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const gridRef = useRef<AgGridReact<Transaction>>(null);

  const handleCopy = (text: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedId(text);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  // Order ID Cell Renderer with 1-click copy
  const OrderIdCellRenderer = useCallback(
    (params: ICellRendererParams<Transaction>) => {
      if (!params.data) return null;
      const { orderId } = params.data;

      return (
        <div className="flex items-center gap-1.5 h-full font-mono text-xs">
          <span className="font-semibold text-neutral-900 dark:text-neutral-100 truncate max-w-[140px]">
            {orderId}
          </span>
          <button
            type="button"
            onClick={() => handleCopy(orderId)}
            className="text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors shrink-0"
            title="Copy PayPal Order ID"
          >
            {copiedId === orderId ? (
              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      );
    },
    [copiedId]
  );

  // Service Name Cell Renderer
  const ServiceCellRenderer = useCallback(
    (params: ICellRendererParams<Transaction>) => {
      if (!params.data) return null;
      const { service, receiptData } = params.data;

      return (
        <div className="flex flex-col justify-center h-full py-1">
          <span className="font-semibold text-xs text-neutral-900 dark:text-neutral-100 truncate">
            {service}
          </span>
          {receiptData?.planName && (
            <span className="text-[10px] text-neutral-500 truncate">
              {receiptData.planName}
            </span>
          )}
        </div>
      );
    },
    []
  );

  // Amount Cell Renderer
  const AmountCellRenderer = useCallback(
    (params: ICellRendererParams<Transaction>) => {
      if (!params.data) return null;
      const { amount, currency } = params.data;

      return (
        <div className="flex items-center h-full">
          <span className="font-bold text-xs text-emerald-600 dark:text-emerald-400">
            ${amount.toFixed(2)}
          </span>
          <span className="text-[10px] text-neutral-500 ml-1 font-mono">
            {currency || "USD"}
          </span>
        </div>
      );
    },
    []
  );

  // Status Cell Renderer
  const StatusCellRenderer = useCallback(
    (params: ICellRendererParams<Transaction>) => {
      if (!params.data) return null;
      const { status } = params.data;

      if (status === "COMPLETED") {
        return (
          <div className="flex items-center h-full">
            <Badge
              variant="outline"
              className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-medium px-2 py-0.5 flex items-center gap-1"
            >
              <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              <span>CAPTURED</span>
            </Badge>
          </div>
        );
      }

      if (status === "BLOCKED") {
        return (
          <div className="flex items-center h-full">
            <Badge
              variant="outline"
              className="border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400 text-[10px] font-medium px-2 py-0.5 flex items-center gap-1"
            >
              <AlertCircle className="w-3 h-3 text-red-600 dark:text-red-400" />
              <span>BLOCKED</span>
            </Badge>
          </div>
        );
      }

      return (
        <div className="flex items-center h-full">
          <Badge
            variant="outline"
            className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px] font-medium px-2 py-0.5 flex items-center gap-1"
          >
            <Clock className="w-3 h-3 text-amber-600" />
            <span>PENDING</span>
          </Badge>
        </div>
      );
    },
    []
  );

  // Actions Cell Renderer
  const ActionsCellRenderer = useCallback(
    (params: ICellRendererParams<Transaction>) => {
      if (!params.data || !params.data.receiptData) return null;
      const receipt = params.data.receiptData;

      return (
        <div className="flex items-center justify-end gap-1.5 h-full">
          <button
            type="button"
            onClick={() => onViewReceipt(receipt)}
            className="h-7 px-2.5 rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-[11px] font-medium flex items-center gap-1 transition-colors shadow-xs"
            title="View PayPal Sandbox Receipt"
          >
            <FileText className="w-3 h-3" />
            <span>Receipt</span>
          </button>
        </div>
      );
    },
    [onViewReceipt]
  );

  // AG Grid Column Definitions
  const columnDefs = useMemo<ColDef<Transaction>[]>(() => {
    return [
      {
        field: "orderId",
        headerName: "PayPal Order ID",
        cellRenderer: OrderIdCellRenderer,
        flex: 1.8,
        minWidth: 160,
        sortable: true,
      },
      {
        field: "service",
        headerName: "Merchant Service",
        cellRenderer: ServiceCellRenderer,
        flex: 2,
        minWidth: 180,
        sortable: true,
      },
      {
        field: "amount",
        headerName: "Amount Captured",
        cellRenderer: AmountCellRenderer,
        flex: 1.3,
        minWidth: 130,
        sortable: true,
        comparator: (a, b) => a - b,
      },
      {
        field: "timestamp",
        headerName: "Execution Time",
        flex: 1.5,
        minWidth: 150,
        sortable: true,
        cellClass: "text-xs text-neutral-500 font-mono flex items-center",
      },
      {
        field: "status",
        headerName: "Status",
        cellRenderer: StatusCellRenderer,
        flex: 1.2,
        minWidth: 110,
        sortable: true,
      },
      {
        headerName: "Audit Receipt",
        cellRenderer: ActionsCellRenderer,
        flex: 1.1,
        minWidth: 100,
        sortable: false,
        filter: false,
        cellClass: "flex items-center justify-end",
      },
    ];
  }, [
    OrderIdCellRenderer,
    ServiceCellRenderer,
    AmountCellRenderer,
    StatusCellRenderer,
    ActionsCellRenderer,
  ]);

  const defaultColDef = useMemo<ColDef>(() => {
    return {
      resizable: true,
      suppressMovable: true,
    };
  }, []);

  const handleExportCsv = () => {
    gridRef.current?.api.exportDataAsCsv({
      fileName: `PayAgent-Transactions-${new Date().toISOString().slice(0, 10)}.csv`,
    });
  };

  const gridTheme = useMemo(() => {
    return themeQuartz.withParams({
      backgroundColor: isDarkMode ? "#0a0a0a" : "#ffffff",
      foregroundColor: isDarkMode ? "#ededed" : "#171717",
      headerBackgroundColor: isDarkMode ? "#141414" : "#f5f5f5",
      headerTextColor: isDarkMode ? "#a3a3a3" : "#737373",
      borderColor: isDarkMode ? "#262626" : "#e5e5e5",
      rowBorder: { color: isDarkMode ? "#262626" : "#f0f0f0" },
      headerFontFamily: "var(--font-sans), sans-serif",
      fontFamily: "var(--font-sans), sans-serif",
      fontSize: 12,
      headerFontSize: 11,
      rowHeight: 48,
      headerHeight: 36,
    });
  }, [isDarkMode]);

  const totalCaptured = transactions
    .filter((t) => t.status === "COMPLETED")
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="flex flex-col h-full space-y-2">
      {/* Table Toolbar */}
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="relative flex-1 max-w-xs">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <Input
            value={quickFilterText}
            onChange={(e) => setQuickFilterText(e.target.value)}
            placeholder="Search transactions, order IDs..."
            className="h-8 pl-8 text-xs bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 rounded-lg focus-visible:ring-neutral-400"
          />
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="text-[10px] text-emerald-700 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10 font-mono py-0.5"
          >
            Total: ${totalCaptured.toFixed(2)}
          </Badge>

          <button
            type="button"
            onClick={handleExportCsv}
            className="h-8 px-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-medium flex items-center gap-1.5 transition-colors"
            title="Export transactions to CSV"
          >
            <Download className="w-3 h-3" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        </div>
      </div>

      {/* AG Grid Container */}
      <div className="flex-1 w-full rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-800 shadow-xs">
        <AgGridReact<Transaction>
          ref={gridRef}
          rowData={transactions}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          quickFilterText={quickFilterText}
          animateRows={true}
          theme={gridTheme}
          pagination={true}
          paginationPageSize={10}
          paginationPageSizeSelector={[5, 10, 20]}
          domLayout="normal"
        />
      </div>
    </div>
  );
}
