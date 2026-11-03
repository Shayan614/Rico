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
import { Mandate } from "./FinancialDashboard";
import {
  Play,
  Search,
  ShieldCheck,
  AlertTriangle,
  Pause,
  Clock,
  Download,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

// Register community modules once
ModuleRegistry.registerModules([AllCommunityModule]);

interface AgGridMandatesTableProps {
  mandates: Mandate[];
  onTriggerMandate: (id: string) => void;
  isDarkMode?: boolean;
}

export function AgGridMandatesTable({
  mandates,
  onTriggerMandate,
  isDarkMode = false,
}: AgGridMandatesTableProps) {
  const [quickFilterText, setQuickFilterText] = useState("");
  const gridRef = useRef<AgGridReact<Mandate>>(null);

  // Custom Service & Category Cell Renderer
  const ServiceCellRenderer = useCallback((params: ICellRendererParams<Mandate>) => {
    if (!params.data) return null;
    const { service, category } = params.data;

    return (
      <div className="flex items-center gap-2 h-full py-1">
        <div className="w-7 h-7 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center font-bold text-xs shrink-0 text-neutral-800 dark:text-neutral-200">
          {service.charAt(0)}
        </div>
        <div className="flex flex-col justify-center min-w-0">
          <span className="font-semibold text-xs text-neutral-900 dark:text-neutral-100 truncate">
            {service}
          </span>
          <span className="text-[10px] text-neutral-500 font-medium">
            {category || "Subscription"}
          </span>
        </div>
      </div>
    );
  }, []);

  // Custom Ceiling Amount & Live Scraped Price Cell Renderer
  const PriceCellRenderer = useCallback((params: ICellRendererParams<Mandate>) => {
    if (!params.data) return null;
    const { budgetCeiling, lastScrapedPrice, currency } = params.data;
    const isExceeded = lastScrapedPrice > budgetCeiling;

    return (
      <div className="flex items-center gap-2 h-full py-1">
        <div>
          <span className="font-bold text-xs text-neutral-900 dark:text-neutral-100">
            ${budgetCeiling.toFixed(2)}
          </span>
          <span className="text-[10px] text-neutral-500 ml-1 font-mono">
            {currency} max
          </span>
          <div className="text-[10px] flex items-center gap-1">
            <span className="text-neutral-400">Live:</span>
            <span
              className={`font-semibold ${
                isExceeded
                  ? "text-red-500 dark:text-red-400"
                  : "text-emerald-600 dark:text-emerald-400"
              }`}
            >
              ${lastScrapedPrice.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    );
  }, []);

  // Custom Recurrence / Schedule Cell Renderer
  const ScheduleCellRenderer = useCallback((params: ICellRendererParams<Mandate>) => {
    if (!params.data) return null;
    const { recurrence, nextRun } = params.data;

    return (
      <div className="flex flex-col justify-center h-full py-1">
        <div className="flex items-center gap-1 text-xs text-neutral-800 dark:text-neutral-200 font-medium">
          <Clock className="w-3 h-3 text-neutral-400 shrink-0" />
          <span>{recurrence}</span>
        </div>
        <span className="text-[10px] text-neutral-500">
          Next: {nextRun}
        </span>
      </div>
    );
  }, []);

  // Custom Status Cell Renderer
  const StatusCellRenderer = useCallback((params: ICellRendererParams<Mandate>) => {
    if (!params.data) return null;
    const { status } = params.data;

    if (status === "ACTIVE") {
      return (
        <div className="flex items-center h-full">
          <Badge
            variant="outline"
            className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-medium px-2 py-0.5 flex items-center gap-1"
          >
            <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            <span>ACTIVE</span>
          </Badge>
        </div>
      );
    }

    if (status === "ANOMALY_HOLD") {
      return (
        <div className="flex items-center h-full">
          <Badge
            variant="outline"
            className="border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400 text-[10px] font-medium px-2 py-0.5 flex items-center gap-1"
          >
            <AlertTriangle className="w-3 h-3 text-red-600 dark:text-red-400" />
            <span>HOLD</span>
          </Badge>
        </div>
      );
    }

    return (
      <div className="flex items-center h-full">
        <Badge
          variant="outline"
          className="border-neutral-400 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 text-[10px] font-medium px-2 py-0.5 flex items-center gap-1"
        >
          <Pause className="w-3 h-3 text-neutral-500" />
          <span>PAUSED</span>
        </Badge>
      </div>
    );
  }, []);

  // Custom Actions Cell Renderer
  const ActionsCellRenderer = useCallback(
    (params: ICellRendererParams<Mandate>) => {
      if (!params.data) return null;
      const id = params.data.id;

      return (
        <div className="flex items-center justify-end gap-1.5 h-full">
          <button
            type="button"
            onClick={() => onTriggerMandate(id)}
            className="h-7 px-2.5 rounded-md bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 hover:opacity-90 transition-opacity text-[11px] font-medium flex items-center gap-1 shadow-xs"
            title="Execute autonomous price check & PayPal payment"
          >
            <Play className="w-3 h-3 fill-current" />
            <span>Execute</span>
          </button>
        </div>
      );
    },
    [onTriggerMandate]
  );

  // AG Grid Column Definitions
  const columnDefs = useMemo<ColDef<Mandate>[]>(() => {
    return [
      {
        field: "service",
        headerName: "Mandate Service",
        cellRenderer: ServiceCellRenderer,
        flex: 2,
        minWidth: 190,
        filter: "agTextColumnFilter",
        sortable: true,
      },
      {
        field: "budgetCeiling",
        headerName: "Ceiling Limit",
        cellRenderer: PriceCellRenderer,
        flex: 1.5,
        minWidth: 140,
        sortable: true,
        comparator: (a, b) => a - b,
      },
      {
        field: "recurrence",
        headerName: "Schedule & Next Run",
        cellRenderer: ScheduleCellRenderer,
        flex: 1.8,
        minWidth: 160,
        sortable: true,
      },
      {
        field: "status",
        headerName: "Safety Status",
        cellRenderer: StatusCellRenderer,
        flex: 1.2,
        minWidth: 110,
        sortable: true,
      },
      {
        headerName: "Autonomous Action",
        cellRenderer: ActionsCellRenderer,
        flex: 1.2,
        minWidth: 110,
        sortable: false,
        filter: false,
        cellClass: "flex items-center justify-end",
      },
    ];
  }, [
    ServiceCellRenderer,
    PriceCellRenderer,
    ScheduleCellRenderer,
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
      fileName: `Rico-Mandates-${new Date().toISOString().slice(0, 10)}.csv`,
    });
  };

  // AG Grid theme configuration for seamless Light & Dark mode support
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
      rowHeight: 52,
      headerHeight: 36,
    });
  }, [isDarkMode]);

  return (
    <div className="flex flex-col h-full space-y-2">
      {/* Table Toolbar */}
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="relative flex-1 max-w-xs">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <Input
            value={quickFilterText}
            onChange={(e) => setQuickFilterText(e.target.value)}
            placeholder="Quick search spending rules..."
            className="h-8 pl-8 text-xs bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 rounded-lg focus-visible:ring-neutral-400"
          />
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="text-[10px] text-neutral-500 font-mono py-0.5 border-neutral-200 dark:border-neutral-800"
          >
            {mandates.length} records
          </Badge>

          <button
            type="button"
            onClick={handleExportCsv}
            className="h-8 px-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-medium flex items-center gap-1.5 transition-colors"
            title="Export mandates to CSV"
          >
            <Download className="w-3 h-3" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        </div>
      </div>

      {/* AG Grid Container */}
      <div className="flex-1 w-full rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-800 shadow-xs">
        <AgGridReact<Mandate>
          ref={gridRef}
          rowData={mandates}
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
