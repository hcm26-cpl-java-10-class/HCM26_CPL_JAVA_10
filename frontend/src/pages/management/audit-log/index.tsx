import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ExcelJS from "exceljs";
import { MainLayout } from "@/components/layout/MainLayout";
import { AnimatePresence, motion } from "framer-motion";
import { SearchInput } from "@/components/datatable/toolbar/SearchInput";
import { FilterPopover } from "@/components/datatable/toolbar/filter/FilterPopover";
import { Pagination } from "@/components/datatable/table/Pagination";
import type { FieldSchema } from "@/types";
import {
  auditLogApi,
  type AuditLogDTO,
  type AuditLogFilter,
} from "@/api";



const PAGE_SIZE = 20;

type Period = "7days" | "30days" | "thisMonth" | "all";

function getDateRange(period: Period) {
  if (period === "all") {
    return { fromDate: undefined, toDate: undefined };
  }

  const now = new Date();
  const end = new Date(now);
  const start = new Date(now);

  if (period === "7days") {
    start.setDate(start.getDate() - 6);
  } else if (period === "30days") {
    start.setDate(start.getDate() - 29);
  } else {
    start.setDate(1);
  }

  const format = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  return {
    fromDate: format(start),
    toDate: format(end),
  };
}

function formatDate(value: string) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatValue(value: string | null) {
  if (!value) return "Không có dữ liệu";

  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

function getActionLabel(action: string) {
  const labels: Record<string, string> = {
    CREATE: "Create",
    UPDATE: "Update",
    DELETE: "Delete",
  };

  return labels[action?.toUpperCase()] ?? action ?? "Unknown";
}

function ActionBadge({ action }: { action: string }) {
  const normalized = action?.toUpperCase();

  const classes: Record<string, string> = {
    CREATE: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    UPDATE: "bg-blue-50 text-blue-700 ring-blue-600/20",
    DELETE: "bg-red-50 text-red-700 ring-red-600/20",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
    classes[normalized] ?? "bg-gray-100 text-gray-700 ring-gray-500/20"
}`}
    >
      {getActionLabel(action)}
    </span>
  );
}

function ResultBadge({ result }: { result: string | null }) {
    const isSuccess = result === "SUCCESS";
    const isFailed = result === "FAIL" || result === "FAILED";

    const label = isSuccess
        ? "Success"
        : isFailed
            ? "Failed"
            : "Unknown";

    const className = isSuccess
        ? "bg-green-100 text-green-700"
        : isFailed
            ? "bg-red-100 text-red-700"
            : "bg-gray-100 text-gray-700";

    return (
        <span
            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${className}`}
        >
      {label}
    </span>
    );
}

function AuditLogDetails({ log }: { log: AuditLogDTO }) {
    const fields = [
        { label: "Log ID", value: log.id },
        { label: "Created At", value: formatDate(log.createdAt) },
        { label: "Actor ID", value: log.actorId },
        { label: "Actor Email", value: log.actorEmail },
        { label: "Action", value: getActionLabel(log.action) },
        { label: "Result", value: log.result },
        { label: "Entity Type", value: log.entityType },
        { label: "Entity ID", value: log.entityId },
        { label: "Correlation ID", value: log.correlationId },
    ];

    return (
        <div className="space-y-0">
            {fields.map(({ label, value }) => (
                <div
                    key={label}
                    className="grid grid-cols-[120px_minmax(0,1fr)] gap-4 border-b border-slate-200 py-4"
                >
          <span className="text-sm font-semibold text-slate-500">
            {label}
          </span>

                    <span className="break-words text-sm text-slate-800">
            {value === null || value === undefined || value === ""
                ? "N/A"
                : value}
          </span>
                </div>
            ))}

            <div className="border-b border-slate-200 py-4">
                <h3 className="mb-3 text-sm font-semibold text-slate-500">
                    Old Value
                </h3>

                <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md bg-slate-50 p-3 text-xs leading-5 text-slate-700">
          {formatValue(log.oldValue)}
        </pre>
            </div>

            <div className="py-4">
                <h3 className="mb-3 text-sm font-semibold text-slate-500">
                    New Value
                </h3>

                <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-md bg-slate-50 p-3 text-xs leading-5 text-slate-700">
          {formatValue(log.newValue)}
        </pre>
            </div>
        </div>
    );
}


function downloadCsv(logs: AuditLogDTO[]) {
  if (logs.length === 0) return;

  const headers = [
    "Time",
    "Actor",
    "Actor ID",
    "Action",
    "Object",
    "Object ID",
    "Result",
    "Old Value",
    "New Value",
    "Correlation ID",
  ];

  const escapeCsv = (value: unknown): string =>
    `"${String(value ?? "").replace(/"/g, '""')}"`;

const rows = logs.map((log: AuditLogDTO) => [
    log.createdAt,
    log.actorEmail || "Unknown",
    log.actorId ?? "",
    log.action,
    log.entityType || "",
    log.entityId || "",
    log.result || "Unknown",
    log.oldValue || "",
    log.newValue || "",
    log.correlationId || "",
]);

const csv = [headers, ...rows]
    .map((row) => row.map(escapeCsv).join(","))
    .join("\r\n");

const blob = new Blob(["\uFEFF", csv], {
    type: "text/csv;charset=utf-8;",
});

const url = URL.createObjectURL(blob);
const link = document.createElement("a");

link.href = url;
link.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;

document.body.appendChild(link);
link.click();
link.remove();

URL.revokeObjectURL(url);
}

async function downloadExcel(logs: AuditLogDTO[]) {
    if (logs.length === 0) {
        window.alert("No audit records available to export.");
        return;
    }

    const workbook = new ExcelJS.Workbook();

    workbook.creator = "RBAC System";
    workbook.created = new Date();
    workbook.modified = new Date();

    const worksheet = workbook.addWorksheet("Audit Logs", {
        views: [{ state: "frozen", ySplit: 5 }],
        properties: {
            defaultRowHeight: 22,
        },
    });

    const borderStyle: Partial<ExcelJS.Borders> = {
        top: { style: "thin", color: { argb: "FFCBD5E1" } },
        left: { style: "thin", color: { argb: "FFCBD5E1" } },
        bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
        right: { style: "thin", color: { argb: "FFCBD5E1" } },
    };

    const headers = [
        "Time",
        "Actor",
        "Actor ID",
        "Action",
        "Object",
        "Object ID",
        "Result",
        "Old Value",
        "New Value",
        "Correlation ID",
    ];

    // Merge tiêu đề trên toàn bộ 10 cột
    worksheet.mergeCells("A1:J1");

    // Tiêu đề báo cáo


    const titleCell = worksheet.getCell("A1");
    titleCell.value = "AUDIT LOG REPORT";
    titleCell.font = {
        name: "Arial",
        size: 16,
        bold: true,
        color: { argb: "FFFFFFFF" },
    };
    titleCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1E3A5F" },
    };
    titleCell.alignment = {
        horizontal: "center",
        vertical: "middle",
    };
    worksheet.getRow(1).height = 34;

    // Thông tin báo cáo
    worksheet.mergeCells("A2:J2");
    worksheet.getCell("A2").value =
        `Exported at: ${new Date().toLocaleString("vi-VN")}`;
    worksheet.getCell("A2").font = {
        name: "Arial",
        size: 10,
        italic: true,
        color: { argb: "FF475569" },
    };
    worksheet.getCell("A2").alignment = {
        vertical: "middle",
    };
    worksheet.getRow(2).height = 23;

    worksheet.mergeCells("A3:J3");
    worksheet.getCell("A3").value =
        `Total records exported: ${logs.length}`;
    worksheet.getCell("A3").font = {
        name: "Arial",
        size: 10,
        bold: true,
        color: { argb: "FF334155" },
    };
    worksheet.getCell("A3").alignment = {
        vertical: "middle",
    };
    worksheet.getRow(3).height = 23;

    // Dòng trống tạo khoảng cách giữa thông tin và bảng
    worksheet.getRow(4).height = 8;

    // Header của bảng ở dòng 5

// Header của bảng ở dòng 5
const headerRow = worksheet.getRow(5);
headerRow.values = headers;
headerRow.height = 30;

headerRow.font = {
    name: "Arial",
    size: 10,
    bold: true,
    color: { argb: "FFFFFFFF" },
};

headerRow.alignment = {
    horizontal: "center",
    vertical: "middle",
    wrapText: true,
};

// Chỉ định dạng đúng 10 cột A:J, không tô màu cả hàng
for (let columnNumber = 1; columnNumber <= 10; columnNumber++) {
    const cell = headerRow.getCell(columnNumber);

    cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1E293B" },
    };

    cell.border = borderStyle;
}


    // Dữ liệu bắt đầu từ dòng 6
    logs.forEach((log) => {
        const row = worksheet.addRow([
            formatDate(log.createdAt),
            log.actorEmail || "Unknown",
            log.actorId ?? "",
            log.action || "Unknown",
            log.entityType || "",
            log.entityId || "",
            (log.result || "Unknown").toUpperCase(),
            log.oldValue || "",
            log.newValue || "",
            log.correlationId || "",
        ]);

        row.height = 36;

        row.eachCell((cell) => {
            cell.font = {
                name: "Arial",
                size: 10,
                color: { argb: "FF0F172A" },
            };

            cell.alignment = {
                horizontal: "center",
                vertical: "middle",
                wrapText: true,
            };

            cell.border = borderStyle;

            if (row.number % 2 === 0) {
                cell.fill = {
                    type: "pattern",
                    pattern: "solid",
                    fgColor: { argb: "FFF8FAFC" },
                };
            }
        });

        // Tô màu riêng cho trạng thái
        const resultCell = row.getCell(7);
        const normalizedResult = String(resultCell.value ?? "").toUpperCase();

        if (normalizedResult === "SUCCESS") {
            resultCell.font = {
                name: "Arial",
                size: 10,
                bold: true,
                color: { argb: "FF166534" },
            };
            resultCell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFDCFCE7" },
            };
        } else if (
            normalizedResult === "FAILED" ||
            normalizedResult === "FAIL"
        ) {
            resultCell.font = {
                name: "Arial",
                size: 10,
                bold: true,
                color: { argb: "FF991B1B" },
            };
            resultCell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFFEE2E2" },
            };
        } else {
            resultCell.font = {
                name: "Arial",
                size: 10,
                bold: true,
                color: { argb: "FF475569" },
            };
            resultCell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFF1F5F9" },
            };
        }
    });

    // Tự điều chỉnh độ rộng cột theo nội dung, giới hạn để tránh bảng quá rộng
    const minWidths = [21, 26, 12, 14, 18, 14, 14, 35, 35, 36];
    const maxWidths = [24, 32, 12, 16, 20, 16, 14, 45, 45, 40];

    worksheet.columns.forEach((column, index) => {
        let maxLength = headers[index].length;

        column.eachCell?.({ includeEmpty: false }, (cell) => {
            if ([1, 2, 3, 5].includes(Number(cell.row))) {
                return;
            }

            const value = cell.value;
            const text =
                value === null || value === undefined
                    ? ""
                    : String(value);

            maxLength = Math.max(maxLength, text.length);
        });

        column.width = Math.min(
            Math.max(maxLength + 2, minWidths[index]),
            maxWidths[index],
        );
    });

    // Dropdown lọc tại hàng header của bảng
    worksheet.autoFilter = {
        from: "A5",
        to: `J${logs.length + 5}`,
    };

    // In báo cáo theo chiều ngang
    worksheet.pageSetup = {
        orientation: "landscape",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
    };

    worksheet.pageSetup.printTitlesRow = "5:5";

    worksheet.headerFooter.oddFooter =
        "&LConfidential - RBAC System&CPage &P of &N";

    // Giới hạn vùng in trong phạm vi báo cáo
    worksheet.pageSetup.printArea = `A1:J${logs.length + 5}`;

    const buffer = await workbook.xlsx.writeBuffer();

    const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `audit-log-${new Date().toISOString().slice(0, 10)}.xlsx`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function getAllAuditLogs(
    filters: AuditLogFilter,
): Promise<AuditLogDTO[]> {
    const firstPage = await auditLogApi.getPage({
        ...filters,
        page: 0,
        size: PAGE_SIZE,
    });

    const allLogs = [...firstPage.content];

    for (let page = 1; page < firstPage.totalPages; page++) {
        const result = await auditLogApi.getPage({
            ...filters,
            page,
            size: PAGE_SIZE,
        });

        allLogs.push(...result.content);
    }

    return allLogs;
}

export default function AuditLogPage() {
    const [showExportModal, setShowExportModal] = useState(false);
    const [exporting, setExporting] = useState(false);

    const [period, setPeriod] = useState<Period>("7days");


    const [page, setPage] = useState(0);
    const [size, setSize] = useState(20);
    const [search, setSearch] = useState("");
    const [filters, setFilters] = useState<Record<string, unknown>>({});
    const [selectedLog, setSelectedLog] = useState<AuditLogDTO | null>(null)

    const auditSchema = useMemo(
        () => ({
            fields: [
                {
                    name: "dateRange",
                    label: "Date Range",
                    type: "date",
                    filterable: true,
                },
                {
                    name: "action",
                    label: "Action",
                    type: "select",
                    filterable: true,
                    filterOptions: [
                        { label: "Create", value: "CREATE" },
                        { label: "Update", value: "UPDATE" },
                        { label: "Delete", value: "DELETE" },
                    ],
                },
                {
                    name: "actorName",
                    label: "Actor Name",
                    type: "text",
                    filterable: true,
                },
                {
                    name: "entityType",
                    label: "Entity Type",
                    type: "text",
                    filterable: true,
                },
                {
                    name: "result",
                    label: "Result",
                    type: "select",
                    filterable: true,
                    filterOptions: [
                        { label: "Success", value: "SUCCESS" },
                        { label: "Failed", value: "FAILED" },
                    ],
                },
            ] as FieldSchema[],
        }),
        [],
    );


    const auditTableAdapter = {
        schema: auditSchema,
        filters,

        setFilters: (
            updater:
                | Record<string, unknown>
                | ((
                previous: Record<string, unknown>,
            ) => Record<string, unknown>),
        ) => {
            setFilters((previous) =>
                typeof updater === "function" ? updater(previous) : updater,
            );
        },

        clearFilters: () => {
            setFilters({});
            setPage(0);
        },
    };


    const [appliedFilters, setAppliedFilters] = useState<AuditLogFilter>(() => ({
        ...getDateRange("7days"),
    }));

    useEffect(() => {
        const dateRange = filters.dateRange as
            | { from?: string; to?: string }
            | undefined;

        const presetRange = getDateRange(period);

        setPage(0);

        setAppliedFilters({
            fromDate: dateRange?.from || presetRange.fromDate,
            toDate: dateRange?.to || presetRange.toDate,
            actorName: String(filters.actorName ?? "").trim() || undefined,
            action: String(filters.action ?? "") || undefined,
            entityType: String(filters.entityType ?? "").trim() || undefined,
            result: String(filters.result ?? "") || undefined,
        });
    }, [filters, period]);


    const queryFilter = useMemo(
        () => ({
            ...appliedFilters,
            page,
            size,
        }),
        [appliedFilters, page, size],
    );

    const auditQuery = useQuery({
        queryKey: ["audit-logs", queryFilter],
        queryFn: () => auditLogApi.getPage(queryFilter),
    });

    const logs = auditQuery.data?.content ?? [];
    const totalElements = auditQuery.data?.totalElements ?? 0;

    const filteredLogs = useMemo(() => {
        const keyword = search.trim().toLowerCase();

        if (!keyword) return logs;

        return logs.filter((log) =>
            [
                log.actorEmail,
                log.actorId,
                log.action,
                log.entityType,
                log.entityId,
                log.result,
                log.correlationId,
            ]
                .map((value) => String(value ?? "").toLowerCase())
                .some((value) => value.includes(keyword)),
        );
    }, [logs, search]);

    const paginationTable = {
        page,
        size,
        total: totalElements,
        data: filteredLogs,
        selected: [],
        setPage,
    };


    return (
        <MainLayout
            pathName={{
                admin: "Administration",
                "audit-log": "Audit Log",
            }}
        >
            <div className="min-h-full bg-slate-50/70 px-4 py-4 md:px-6 lg:px-7">
                <div className="mx-auto max-w-none space-y-4">
                    {/* Page heading */}
                    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
                                <span>Administration</span>
                                <span className="text-slate-300">/</span>
                                <span className="font-semibold text-slate-800">
                  Audit Log
                </span>
                            </div>

                            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                                Audit Log
                            </h1>

                            <p className="mt-1.5 text-sm text-slate-500">
                                Trace permission, grade, deadline, export and configuration
                                changes.
                            </p>
                        </div>



                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => setShowExportModal(true)}
                                disabled={logs.length === 0 || auditQuery.isPending}
                                className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.8"
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M12 3v12m0 0 4-4m-4 4-4-4M5 17v3h14v-3"
                                    />
                                </svg>
                                Export
                            </button>
                        </div>

                    </header>

                    {/* Filters and audit table */}
                    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">

                        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-4 md:px-5">
                            {/* 1. Search */}
                            <div className="min-w-[200px] flex-1">
                                <SearchInput
                                    search={search}
                                    onSearchChange={(value: string) => {
                                        setSearch(value);
                                        setPage(0);
                                    }}
                                />
                            </div>

                            {/* 2. Preset date range */}
                            <select
                                value={period}
                                onChange={(event) => {
                                    setPeriod(event.target.value as Period);
                                    setPage(0);
                                }}
                                className="h-9 min-w-[150px] rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                                aria-label="Filter by period"
                            >
                                <option value="7days">Last 7 days</option>
                                <option value="30days">Last 30 days</option>
                                <option value="thisMonth">This month</option>
                                <option value="all">All time</option>
                            </select>


                            {/* 3. Filters */}
                            <FilterPopover
                                table={auditTableAdapter}
                                hasFilters={auditSchema.fields.some(
                                    (field) => field.filterable,
                                )}
                                activeFilterCount={
                                    Object.values(filters).filter(
                                        (value) => value !== undefined && value !== "",
                                    ).length
                                }
                            />

                        </div>

                        <div className="border-t border-slate-200">
                            <div className="flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center sm:justify-between md:px-5">
                                <div>
                                    <h2 className="text-sm font-semibold text-slate-800">
                                        Audit Records
                                    </h2>
                                    <p className="mt-1 text-xs text-slate-500">
                                        {totalElements} records found
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => auditQuery.refetch()}
                                    disabled={auditQuery.isFetching}
                                    className="inline-flex h-9 items-center justify-center gap-2 self-start rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 sm:self-auto"
                                >
                                    <svg
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.8"
                                        className={`h-4 w-4 ${auditQuery.isFetching ? "animate-spin" : ""}`}
                                        aria-hidden="true"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M20 7v5h-5M4 17v-5h5m10-2a7 7 0 0 0-12-3L4 12m0 0 3 3m-3-3 3-3m10 5a7 7 0 0 1-12 3"
                                        />
                                    </svg>
                                    {auditQuery.isFetching ? "Refreshing..." : "Refresh"}
                                </button>
                            </div>

                            {auditQuery.isPending ? (
                                <div className="px-6 py-16 text-center">
                                    <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
                                    <p className="mt-3 text-sm text-slate-500">
                                        Loading audit records...
                                    </p>
                                </div>
                            ) : auditQuery.isError ? (
                                <div className="px-6 py-14 text-center">
                                    <h3 className="font-semibold text-red-700">
                                        {getErrorStatus(auditQuery.error) === 403
                                            ? "Access denied"
                                            : "Unable to load audit log"}
                                    </h3>
                                    <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                                        {getErrorStatus(auditQuery.error) === 403
                                            ? "You do not have permission to view audit records."
                                            : "An error occurred while retrieving the data. Check the backend connection and try again."}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => auditQuery.refetch()}
                                        className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
                                    >
                                        Try again
                                    </button>
                                </div>
                            ) : filteredLogs.length === 0 ? (
                                <div className="px-6 py-16 text-center">
                                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                                        <svg
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="1.7"
                                            className="h-6 w-6"
                                            aria-hidden="true"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"
                                            />
                                        </svg>
                                    </div>
                                    <h3 className="mt-3 font-semibold text-slate-800">
                                        No audit records
                                    </h3>
                                    <p className="mt-1 text-sm text-slate-500">
                                        No records match the selected filters.
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <div className="overflow-x-auto">
                                        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                                            <thead className="border-b border-slate-200 bg-white text-sm text-slate-700">
                                            <tr>
                                                <th className="whitespace-nowrap px-5 py-3 font-semibold">
                                                    Time
                                                </th>
                                                <th className="whitespace-nowrap px-5 py-3 font-semibold">
                                                    Actor
                                                </th>
                                                <th className="whitespace-nowrap px-5 py-3 font-semibold">
                                                    Action
                                                </th>
                                                <th className="whitespace-nowrap px-5 py-3 font-semibold">
                                                    Object
                                                </th>
                                                <th className="whitespace-nowrap px-5 py-3 font-semibold">
                                                    Result
                                                </th>
                                                <th className="whitespace-nowrap px-5 py-3 text-right font-semibold">
                                                    Details
                                                </th>
                                            </tr>
                                            </thead>

                                            <tbody className="divide-y divide-slate-200">
                                            {filteredLogs.map((log) => (
                                                <AuditLogRow
                                                    key={log.id}
                                                    log={log}
                                                    onViewDetails={() => setSelectedLog(log)}
                                                />
                                            ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="border-t border-slate-200 px-4 py-4 md:px-5">
                                        <Pagination
                                            table={paginationTable}
                                            onPageSizeChange={(value) => {
                                                if (value === "auto") return;

                                                const newSize = Number(value);

                                                if (Number.isInteger(newSize) && newSize > 0) {
                                                    setSize(newSize);
                                                    setPage(0);
                                                }
                                            }}
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    </section>
                </div>
            </div>
            <AnimatePresence>
                {selectedLog && (
                    <>
                        {/* Backdrop */}
                        <motion.button
                            type="button"
                            aria-label="Close details"
                            className="fixed inset-0 z-[110] cursor-default bg-black/40 backdrop-blur-sm"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            onClick={() => setSelectedLog(null)}
                        />

                        {/* Right-side detail drawer */}
                        <motion.aside
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="audit-detail-title"
                            className="fixed inset-y-0 right-0 z-[120] flex w-full flex-col border-l border-slate-200 bg-white shadow-2xl sm:w-[560px] xl:w-[640px]"
                            initial={{ x: "100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "100%" }}
                            transition={{
                                type: "tween",
                                duration: 0.3,
                                ease: "easeInOut",
                            }}
                        >
                            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4">
                                <h2
                                    id="audit-detail-title"
                                    className="text-base font-semibold text-slate-900"
                                >
                                    Detail
                                </h2>

                                <button
                                    type="button"
                                    aria-label="Close details"
                                    onClick={() => setSelectedLog(null)}
                                    className="rounded-md border border-slate-300 p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                                >
                                    <svg
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.8"
                                        className="h-5 w-5"
                                        aria-hidden="true"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M6 6l12 12M18 6L6 18"
                                        />
                                    </svg>
                                </button>
                            </div>

                            <div className="min-h-0 flex-1 overflow-y-auto px-5">
                                <AuditLogDetails log={selectedLog} />
                            </div>
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>

            {showExportModal && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget && !exporting) {
                            setShowExportModal(false);
                        }
                    }}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="audit-export-title"
                        className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
                    >
                        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
                            <div>
                                <h2
                                    id="audit-export-title"
                                    className="text-base font-semibold text-slate-900"
                                >
                                    Export Audit Log
                                </h2>
                                <p className="mt-1 text-sm text-slate-500">
                                    Choose an output format to export audit records.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => setShowExportModal(false)}
                                disabled={exporting}
                                aria-label="Close export dialog"
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                            >
                                <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.8"
                                    className="h-5 w-5"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="m18 6-12 12M6 6l12 12"
                                    />
                                </svg>
                            </button>
                        </div>

                        <div className="space-y-3 p-5">
                            <p className="text-center text-sm font-semibold text-slate-800">
                                Select Export Format
                            </p>

                            <p className="mb-4 text-center text-xs text-slate-500">
                                {totalElements} audit records found
                            </p>

                            <button
                                type="button"
                                disabled={exporting}
                                onClick={async () => {
                                    setExporting(true);

                                    try {
                                        const allLogs = await getAllAuditLogs(appliedFilters);

                                        if (allLogs.length === 0) {
                                            window.alert("No audit records available to export.");
                                            return;
                                        }

                                        downloadCsv(allLogs);
                                        setShowExportModal(false);
                                    } catch (error) {
                                        console.error("CSV export failed:", error);
                                        window.alert("Unable to export CSV file.");
                                    } finally {
                                        setExporting(false);
                                    }
                                }}
                                className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-4 text-left transition hover:border-blue-300 hover:bg-blue-50/50 disabled:opacity-50"
                            >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.7"
                            className="h-6 w-6"
                        >
                            <rect x="4" y="3" width="16" height="18" rx="2" />
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M8 8h8M8 12h8M8 16h3"
                            />
                        </svg>
                    </span>

                                <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-slate-900">
                            CSV
                        </span>
                        <span className="mt-1 block text-xs text-slate-500">
                            Download as CSV file (.csv)
                        </span>
                    </span>

                                <span className="text-xs font-medium text-slate-400">
                        .csv
                    </span>
                            </button>

                            <button
                                type="button"
                                disabled={exporting}
                                onClick={async () => {
                                    setExporting(true);

                                    try {
                                        const allLogs = await getAllAuditLogs(appliedFilters);

                                        if (allLogs.length === 0) {
                                            window.alert("No audit records available to export.");
                                            return;
                                        }

                                        await downloadExcel(allLogs);
                                        setShowExportModal(false);
                                    } catch (error) {
                                        console.error("Excel export failed:", error);
                                        window.alert("Unable to export Excel file.");
                                    } finally {
                                        setExporting(false);
                                    }
                                }}
                                className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-4 text-left transition hover:border-emerald-300 hover:bg-emerald-50/50 disabled:opacity-50"
                            >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.7"
                            className="h-6 w-6"
                        >
                            <rect x="4" y="3" width="16" height="18" rx="2" />
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M8 8h3v3H8zM13 8h3M13 11h3M8 14h3v3H8zM13 14h3M13 17h3"
                            />
                        </svg>
                    </span>

                                <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-slate-900">
                            Excel
                        </span>
                        <span className="mt-1 block text-xs text-slate-500">
                            Download as Excel file (.xlsx)
                        </span>
                    </span>

                                <span className="text-xs font-medium text-slate-400">
                        .xlsx
                    </span>
                            </button>

                            {exporting && (
                                <p className="pt-2 text-center text-sm text-slate-500">
                                    Preparing export file...
                                </p>
                            )}
                        </div>

                        <div className="flex justify-end border-t border-slate-100 bg-slate-50/70 px-5 py-4">
                            <button
                                type="button"
                                disabled={exporting}
                                onClick={() => setShowExportModal(false)}
                                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </MainLayout>
    );
}

function AuditLogRow({
                         log,
                         onViewDetails,
                     }: {
    log: AuditLogDTO;
    onViewDetails: () => void;
}) {
    const objectName = log.entityType || "Unknown object";
    const objectId = log.entityId ? `#${log.entityId}` : "";

    return (
        <tr className="transition-colors hover:bg-slate-50/80">
            <td className="whitespace-nowrap px-5 py-3.5 text-slate-600">
                {formatDate(log.createdAt)}
            </td>

            <td className="px-5 py-3.5">
                <div className="font-medium text-slate-800">
                    {log.actorEmail || "Unknown actor"}
                </div>
                <div className="mt-1 text-xs text-slate-400">
                    ID: {log.actorId ?? "-"}
                </div>
            </td>

            <td className="px-5 py-3.5">
                <ActionBadge action={log.action} />
            </td>

            <td className="px-5 py-3.5">
                <div className="font-medium text-slate-700">
                    {objectName}
                </div>

                {objectId && (
                    <div className="mt-1 text-xs text-slate-400">
                        {objectId}
                    </div>
                )}
            </td>

            <td className="px-5 py-3.5">
                <ResultBadge result={log.result} />
            </td>

            <td className="px-5 py-3.5 text-right">
                <button
                    type="button"
                    onClick={onViewDetails}
                    title="View Details"
                    aria-label="View Details"
                    className="inline-flex items-center justify-center rounded-md p-2 text-slate-500 transition hover:bg-slate-100 hover:text-blue-600"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                    >
                        <path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" />
                        <circle cx="12" cy="12" r="3" />
                    </svg>
                </button>
            </td>
        </tr>
    );
}

function getErrorStatus(error: unknown): number | undefined {
    if (typeof error === "object" && error !== null && "response" in error) {
        const response = (error as { response?: { status?: number } }).response;
        return response?.status;
    }

    return undefined;
}
