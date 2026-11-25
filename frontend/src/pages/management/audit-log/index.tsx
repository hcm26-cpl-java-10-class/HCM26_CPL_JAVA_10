import { useEffect, useMemo, useState, type ReactNode } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import ExcelJS from "exceljs";
import { MainLayout } from "@/components/layout/MainLayout";
import { AnimatePresence, motion } from "framer-motion";
import { SearchInput } from "@/components/datatable/toolbar/SearchInput";
import { FilterPopover } from "@/components/datatable/toolbar/filter/FilterPopover";
import { Pagination } from "@/components/datatable/table/Pagination";
import { EntityHistoryDialog } from "@/components/audit/EntityHistoryDialog";
import {
    getActionBadgeClass,
    getActionDotClass,
    getActionLabel,
    KNOWN_ACTIONS,
} from "@/components/audit/auditActions";
import { AuditStatsDashboard } from "./AuditStatsDashboard";
import type { FieldSchema } from "@/types";
import {
    auditLogApi,
    type AuditLogDTO,
    type AuditLogFilter,
} from "@/api";



const PAGE_SIZE = 20;

function useDebouncedValue<T>(value: T, delay = 400): T {
    const [debounced, setDebounced] = useState(value);

    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);

    return debounced;
}

type Period = "7days" | "30days" | "thisMonth" | "all" | "custom";

function getDateRange(period: Period) {
    if (period === "all" || period === "custom") {
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

function ActionBadge({ action }: { action: string }) {
    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${getActionBadgeClass(
                action,
            )}`}
        >
            <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 rounded-full ${getActionDotClass(action)}`}
            />
            {getActionLabel(action)}
        </span>
    );
}

function ResultBadge({ result }: { result: string | null }) {
    const normalized = result?.trim().toUpperCase();

    const isSuccess = normalized === "SUCCESS";
    const isFailed = ["FAIL", "FAILED", "FAILURE"].includes(normalized ?? "");

    const label = isSuccess
        ? "Success"
        : isFailed
            ? "Failure"
            : "Unknown";

    const className = isSuccess
        ? "bg-green-500/15 text-green-700 dark:text-green-400"
        : isFailed
            ? "bg-red-500/15 text-red-700 dark:text-red-400"
            : "bg-muted text-muted-foreground";

    return (
        <span
            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${className}`}
        >
            {label}
        </span>
    );
}

type AuditView = "all" | "failures" | "auth";

type ChangeRow = { key: string; before: string; after: string };

function parseObject(value: string | null): Record<string, unknown> | null {
    if (!value) return null;

    try {
        const parsed: unknown = JSON.parse(value);

        return parsed && typeof parsed === "object" && !Array.isArray(parsed)
            ? (parsed as Record<string, unknown>)
            : null;
    } catch {
        return null;
    }
}

function displayValue(value: unknown): string {
    if (value === undefined) return "—";
    if (typeof value === "string") return value;

    return JSON.stringify(value);
}

/** Top-level fields whose value differs between the old and the new snapshot. */
function computeChanges(
    oldValue: string | null,
    newValue: string | null,
): ChangeRow[] | null {
    const before = parseObject(oldValue);
    const after = parseObject(newValue);

    if (!before && !after) return null;

    const keys = new Set([
        ...Object.keys(before ?? {}),
        ...Object.keys(after ?? {}),
    ]);

    const rows: ChangeRow[] = [];

    keys.forEach((key) => {
        const previous = before?.[key];
        const next = after?.[key];

        if (JSON.stringify(previous) !== JSON.stringify(next)) {
            rows.push({
                key,
                before: displayValue(previous),
                after: displayValue(next),
            });
        }
    });

    return rows;
}

function LogKpi({
                    label,
                    value,
                    hint,
                    tone = "text-foreground",
                }: {
    label: string;
    value: string;
    hint?: string;
    tone?: string;
}) {
    return (
        <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {label}
            </p>
            <p className={`mt-1 text-2xl font-semibold ${tone}`}>{value}</p>
            {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
        </div>
    );
}

function initialsOf(email: string | null | undefined) {
    const name = (email ?? "")
        .split("@")[0]
        .replace(/[^a-zA-Z0-9]/g, " ")
        .trim();

    if (!name) return "?";

    const parts = name.split(/\s+/);

    return (
        parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2)
    ).toUpperCase();
}

function Avatar({ email }: { email: string | null | undefined }) {
    return (
        <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-500/15 text-xs font-semibold text-indigo-600 dark:text-indigo-300"
        >
            {initialsOf(email)}
        </span>
    );
}

function InspectorSection({
                              title,
                              children,
                          }: {
    title: string;
    children: ReactNode;
}) {
    return (
        <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {title}
            </h3>
            {children}
        </section>
    );
}

/** Details of one audit event: who, what, when, and what changed. */
function AuditLogInspector({
                               log,
                               onViewHistory,
                           }: {
    log: AuditLogDTO;
    onViewHistory: () => void;
}) {
    const [copied, setCopied] = useState(false);
    const changes = computeChanges(log.oldValue, log.newValue);

    const copyCorrelationId = async () => {
        if (!log.correlationId) return;

        try {
            await navigator.clipboard.writeText(log.correlationId);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
        } catch {
            // clipboard is not available (e.g. insecure context): nothing to do
        }
    };

    return (
        <div className="space-y-5 py-5">
            <div className="flex flex-wrap items-center gap-2">
                <ActionBadge action={log.action} />
                <ResultBadge result={log.result} />
                <span className="ml-auto text-xs text-muted-foreground">
                    Log #{log.id}
                </span>
            </div>

            <InspectorSection title="Actor">
                <div className="flex items-center gap-3">
                    <Avatar email={log.actorEmail} />
                    <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-foreground">
                            {log.actorEmail || "Unknown actor"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                            ID: {log.actorId ?? "-"}
                        </div>
                    </div>
                </div>
            </InspectorSection>

            <InspectorSection title="Object">
                <div className="text-sm font-medium text-foreground">
                    {log.entityType || "Unknown object"}
                    {log.entityId ? ` #${log.entityId}` : ""}
                </div>

                {log.entityId && log.entityType !== "AUTH" && (
                    <button
                        type="button"
                        onClick={onViewHistory}
                        className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                        View history
                    </button>
                )}
            </InspectorSection>

            <InspectorSection title="Trace">
                <dl className="space-y-2 text-sm">
                    <div className="flex items-start justify-between gap-3">
                        <dt className="text-muted-foreground">Time</dt>
                        <dd className="text-right text-foreground">
                            {formatDate(log.createdAt)}
                        </dd>
                    </div>

                    <div className="flex items-start justify-between gap-3">
                        <dt className="shrink-0 text-muted-foreground">
                            Correlation ID
                        </dt>
                        <dd className="min-w-0 text-right">
                            {log.correlationId ? (
                                <button
                                    type="button"
                                    onClick={copyCorrelationId}
                                    title="Copy correlation ID"
                                    className="max-w-full break-all text-right font-mono text-xs text-foreground hover:text-indigo-600 dark:hover:text-indigo-400"
                                >
                                    {copied ? "Copied" : log.correlationId}
                                </button>
                            ) : (
                                <span className="text-foreground">N/A</span>
                            )}
                        </dd>
                    </div>
                </dl>
            </InspectorSection>

            {changes && (
                <InspectorSection title={`Changes (${changes.length})`}>
                    {changes.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            No field changes.
                        </p>
                    ) : (
                        <ul className="divide-y divide-border rounded-md border border-border text-xs">
                            {changes.map((change) => (
                                <li key={change.key} className="space-y-1 p-2.5">
                                    <div className="font-semibold text-foreground">
                                        {change.key}
                                    </div>
                                    <div className="break-words font-mono text-red-600 dark:text-red-400">
                                        − {change.before}
                                    </div>
                                    <div className="break-words font-mono text-emerald-600 dark:text-emerald-400">
                                        + {change.after}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </InspectorSection>
            )}

            <InspectorSection title="Old value">
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-xs leading-5 text-foreground/80">
                    {formatValue(log.oldValue)}
                </pre>
            </InspectorSection>

            <InspectorSection title="New value">
                <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-xs leading-5 text-foreground/80">
                    {formatValue(log.newValue)}
                </pre>
            </InspectorSection>
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
    const [view, setView] = useState<"logs" | "stats">("logs");
    const [exporting, setExporting] = useState(false);

    const [period, setPeriod] = useState<Period>("30days");
    const [customFrom, setCustomFrom] = useState("");
    const [customTo, setCustomTo] = useState("");


    const [page, setPage] = useState(0);
    const [size, setSize] = useState(20);
    const [search, setSearch] = useState("");
    const [filters, setFilters] = useState<Record<string, unknown>>({});
    const [selectedLog, setSelectedLog] = useState<AuditLogDTO | null>(null)
    const [historyTarget, setHistoryTarget] = useState<{
        entityType: string;
        entityId: string;
    } | null>(null);

    const metaQuery = useQuery({
        queryKey: ["audit-log-filter-options"],
        queryFn: () => auditLogApi.getFilterOptions(),
        staleTime: 60_000,
    });

    const actionOptions = useMemo(() => {
        const values = metaQuery.data?.actions?.length
            ? metaQuery.data.actions
            : KNOWN_ACTIONS;

        return values.map((value) => ({
            label: getActionLabel(value),
            value,
        }));
    }, [metaQuery.data]);

    const entityTypeOptions = useMemo(
        () =>
            (metaQuery.data?.entityTypes ?? []).map((value) => ({
                label: value,
                value,
            })),
        [metaQuery.data],
    );

    const auditSchema = useMemo(
        () => ({
            fields: [
                {
                    name: "action",
                    label: "Action",
                    type: "select",
                    filterable: true,
                    filterOptions: actionOptions,
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
                    type: "select",
                    filterable: true,
                    filterOptions: entityTypeOptions,
                },
                {
                    name: "result",
                    label: "Result",
                    type: "select",
                    filterable: true,
                    filterOptions: [
                        { label: "Success", value: "SUCCESS" },
                        { label: "Failure", value: "FAILURE" },
                    ],
                },
            ] as FieldSchema[],
        }),
        [actionOptions, entityTypeOptions],
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
        ...getDateRange("30days"),
    }));

    // One date range shared by the Logs and Statistics tabs
    const dateRange = useMemo(
        () =>
            period === "custom"
                ? {
                    fromDate: customFrom || undefined,
                    toDate:
                        customTo && (!customFrom || customTo >= customFrom)
                            ? customTo
                            : undefined,
                }
                : getDateRange(period),
        [period, customFrom, customTo],
    );

    // Text inputs are debounced so that typing does not fire a request per keystroke
    const debouncedSearch = useDebouncedValue(search);
    const debouncedActorName = useDebouncedValue(String(filters.actorName ?? ""));

    useEffect(() => {
        setPage(0);

        setAppliedFilters({
            ...dateRange,
            keyword: debouncedSearch.trim() || undefined,
            actorName: debouncedActorName.trim() || undefined,
            action: String(filters.action ?? "") || undefined,
            entityType: String(filters.entityType ?? "") || undefined,
            result: String(filters.result ?? "") || undefined,
        });
    }, [
        dateRange,
        debouncedSearch,
        debouncedActorName,
        filters.action,
        filters.entityType,
        filters.result,
    ]);


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
        // keep the table (and the pagination bar) mounted while the next page loads
        placeholderData: keepPreviousData,
    });

    const logs = auditQuery.data?.content ?? [];
    const totalElements = auditQuery.data?.totalElements ?? 0;

    // Search is done by the server (keyword), so the page is shown as returned
    const filteredLogs = logs;

    // Counts for the quick views (whole selected period, independent of the other filters)
    const viewCountsQuery = useQuery({
        queryKey: [
            "audit-log-view-counts",
            dateRange.fromDate ?? null,
            dateRange.toDate ?? null,
        ],
        queryFn: () =>
            auditLogApi.getStats({
                fromDate: dateRange.fromDate,
                toDate: dateRange.toDate,
            }),
        staleTime: 30_000,
    });

    const viewCounts = viewCountsQuery.data;

    const viewOptions: { key: AuditView; label: string; count?: number }[] = [
        { key: "all", label: "All records", count: viewCounts?.total },
        {
            key: "failures",
            label: "Failures & denials",
            count: viewCounts?.failures,
        },
        { key: "auth", label: "Auth & session" },
    ];

    const activeView: AuditView | null =
        !filters.result && !filters.entityType
            ? "all"
            : filters.result === "FAILURE" && !filters.entityType
                ? "failures"
                : filters.entityType === "AUTH" && !filters.result
                    ? "auth"
                    : null;

    const applyView = (key: AuditView) => {
        setFilters((previous) => {
            const next = { ...previous };

            delete next.result;
            delete next.entityType;

            if (key === "failures") next.result = "FAILURE";
            if (key === "auth") next.entityType = "AUTH";

            return next;
        });
        setPage(0);
    };

    const totalEvents = viewCounts?.total ?? 0;
    const failedEvents = viewCounts?.failures ?? 0;
    const failureShare =
        totalEvents > 0 ? ((failedEvents / totalEvents) * 100).toFixed(1) : "0.0";
    const successRate =
        totalEvents > 0
            ? `${(((totalEvents - failedEvents) / totalEvents) * 100).toFixed(1)}%`
            : "-";

    const rangeStart = totalElements === 0 ? 0 : page * size + 1;
    const rangeEnd = Math.min((page + 1) * size, totalElements);

    const openHistory = (log: AuditLogDTO) =>
        setHistoryTarget({
            entityType: log.entityType,
            entityId: String(log.entityId),
        });

    const removeFilter = (name: string) =>
        setFilters((previous) => {
            const next = { ...previous };
            delete next[name];
            return next;
        });

    const clearAll = () => {
        setFilters({});
        setSearch("");
        setPeriod("30days");
        setCustomFrom("");
        setCustomTo("");
        setPage(0);
    };

    const activeChips: { key: string; label: string; onRemove: () => void }[] = [];

    if (search.trim()) {
        activeChips.push({
            key: "search",
            label: `Search: ${search.trim()}`,
            onRemove: () => {
                setSearch("");
                setPage(0);
            },
        });
    }
    if (filters.action) {
        activeChips.push({
            key: "action",
            label: `Action: ${getActionLabel(String(filters.action))}`,
            onRemove: () => removeFilter("action"),
        });
    }
    if (filters.entityType) {
        activeChips.push({
            key: "entityType",
            label: `Entity: ${String(filters.entityType)}`,
            onRemove: () => removeFilter("entityType"),
        });
    }
    if (filters.actorName) {
        activeChips.push({
            key: "actorName",
            label: `Actor: ${String(filters.actorName)}`,
            onRemove: () => removeFilter("actorName"),
        });
    }
    if (filters.result) {
        activeChips.push({
            key: "result",
            label: `Result: ${filters.result === "SUCCESS" ? "Success" : "Failure"}`,
            onRemove: () => removeFilter("result"),
        });
    }

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
            <div className="min-h-full bg-muted/50 dark:bg-transparent px-4 py-4 md:px-6 lg:px-7">
                <div className="mx-auto max-w-none space-y-4">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                        <div>
                            <h1 className="text-xl font-semibold text-foreground">
                                Audit Log Records
                            </h1>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Who did what, and when, across the system.
                            </p>
                        </div>

                        <div
                            role="tablist"
                            aria-label="Audit log view"
                            className="inline-flex rounded-lg border border-border bg-card p-1 shadow-sm"
                        >
                            {([
                                { key: "logs", label: "Logs feed" },
                                { key: "stats", label: "Statistics" },
                            ] as const).map((tab) => (
                                <button
                                    key={tab.key}
                                    type="button"
                                    role="tab"
                                    aria-selected={view === tab.key}
                                    onClick={() => setView(tab.key)}
                                    className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                                        view === tab.key
                                            ? "bg-indigo-600 text-white shadow-sm"
                                            : "text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    {tab.label}
                                    {tab.key === "logs" && viewCounts && (
                                        <span
                                            className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                                                view === "logs"
                                                    ? "bg-white/20"
                                                    : "bg-muted text-foreground/70"
                                            }`}
                                        >
                                            {viewCounts.total}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Date range shared by Logs and Statistics */}
                    <div className="flex flex-wrap items-center gap-3">
                        <select
                            value={period}
                            onChange={(event) => {
                                setPeriod(event.target.value as Period);
                                setPage(0);
                            }}
                            className="h-9 min-w-[150px] rounded-lg border border-border bg-card px-3 text-sm text-foreground/80 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
                            aria-label="Filter by period"
                        >
                            <option value="7days">Last 7 days</option>
                            <option value="30days">Last 30 days</option>
                            <option value="thisMonth">This month</option>
                            <option value="all">All time</option>
                            <option value="custom">Custom range</option>
                        </select>

                        {period === "custom" && (
                            <div className="flex items-center gap-2">
                                <input
                                    type="date"
                                    value={customFrom}
                                    max={customTo || undefined}
                                    onChange={(event) => {
                                        setCustomFrom(event.target.value);
                                        setPage(0);
                                    }}
                                    className="h-9 rounded-lg border border-border bg-card px-2 text-sm text-foreground/80 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
                                    aria-label="From date"
                                />
                                <span className="text-muted-foreground">–</span>
                                <input
                                    type="date"
                                    value={customTo}
                                    min={customFrom || undefined}
                                    onChange={(event) => {
                                        setCustomTo(event.target.value);
                                        setPage(0);
                                    }}
                                    className="h-9 rounded-lg border border-border bg-card px-2 text-sm text-foreground/80 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
                                    aria-label="To date"
                                />
                            </div>
                        )}
                    </div>

                    {view === "stats" && (
                        <AuditStatsDashboard
                            fromDate={dateRange.fromDate}
                            toDate={dateRange.toDate}
                        />
                    )}

                    {view === "logs" && viewCounts && (
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <LogKpi
                                label="Total events"
                                value={totalEvents.toLocaleString("en-US")}
                                hint="in the selected period"
                            />
                            <LogKpi
                                label="Failures & denials"
                                value={failedEvents.toLocaleString("en-US")}
                                hint={`${failureShare}% of total`}
                                tone="text-red-600 dark:text-red-400"
                            />
                            <LogKpi
                                label="Success rate"
                                value={successRate}
                                hint={`${(totalEvents - failedEvents).toLocaleString("en-US")} of ${totalEvents.toLocaleString("en-US")} events`}
                                tone="text-emerald-600 dark:text-emerald-400"
                            />
                        </div>
                    )}

                    {view === "logs" && (
                        <div
                            className={
                                selectedLog
                                    ? "xl:grid xl:grid-cols-[minmax(0,1fr)_400px] xl:items-start xl:gap-4"
                                    : ""
                            }
                        >
                            <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">

                                <div className="flex flex-wrap items-center gap-3 border-b border-border p-4 md:px-5">
                                    {/* 1. Search */}
                                    <div className="w-full shrink-0 lg:w-[420px]">
                                        <SearchInput
                                            search={search}
                                            onSearchChange={(value: string) => {
                                                setSearch(value);
                                                setPage(0);
                                            }}
                                        />
                                    </div>

                                    {/* 2. Filters */}
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

                                    {/* 3. Export (same row, pushed to the right) */}
                                    <button
                                        type="button"
                                        onClick={() => setShowExportModal(true)}
                                        disabled={logs.length === 0 || auditQuery.isPending}
                                        className="ml-auto inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-semibold text-foreground/80 shadow-sm transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
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

                                <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3 md:px-5">
                                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    Views
                                </span>

                                    {viewOptions.map((option) => (
                                        <button
                                            key={option.key}
                                            type="button"
                                            onClick={() => applyView(option.key)}
                                            aria-pressed={activeView === option.key}
                                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition ${
                                                activeView === option.key
                                                    ? "border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300"
                                                    : "border-border text-muted-foreground hover:bg-muted hover:text-foreground/80"
                                            }`}
                                        >
                                            {option.label}
                                            {option.count !== undefined && (
                                                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-foreground/70">
                                                {option.count}
                                            </span>
                                            )}
                                        </button>
                                    ))}
                                </div>

                                {activeChips.length > 0 && (
                                    <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2 md:px-5">
                                        {activeChips.map((chip) => (
                                            <span
                                                key={chip.key}
                                                className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-600 dark:text-indigo-300"
                                            >
                                        {chip.label}
                                                <button
                                                    type="button"
                                                    onClick={chip.onRemove}
                                                    aria-label={`Remove ${chip.label}`}
                                                    className="ml-1 rounded-full px-1 hover:bg-indigo-500/20"
                                                >
                                            ×
                                        </button>
                                    </span>
                                        ))}
                                        <button
                                            type="button"
                                            onClick={clearAll}
                                            className="text-xs font-medium text-muted-foreground hover:text-foreground/80 hover:underline"
                                        >
                                            Clear all
                                        </button>
                                    </div>
                                )}

                                <div className="border-t border-border">
                                    <div className="flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center sm:justify-between md:px-5">
                                        <div>
                                            <h2 className="text-sm font-semibold text-foreground">
                                                Audit log feed
                                            </h2>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                Showing {rangeStart}–{rangeEnd} of {totalElements} records
                                            </p>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => auditQuery.refetch()}
                                            disabled={auditQuery.isFetching}
                                            className="inline-flex h-9 items-center justify-center gap-2 self-start rounded-lg border border-border px-3 text-sm font-medium text-muted-foreground transition hover:bg-muted disabled:opacity-50 sm:self-auto"
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
                                            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-border border-t-indigo-500" />
                                            <p className="mt-3 text-sm text-muted-foreground">
                                                Loading audit records...
                                            </p>
                                        </div>
                                    ) : auditQuery.isError ? (
                                        <div className="px-6 py-14 text-center">
                                            <h3 className="font-semibold text-red-600 dark:text-red-400">
                                                {getErrorStatus(auditQuery.error) === 403
                                                    ? "Access denied"
                                                    : "Unable to load audit log"}
                                            </h3>
                                            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                                                {getErrorStatus(auditQuery.error) === 403
                                                    ? "You do not have permission to view audit records."
                                                    : "An error occurred while retrieving the data. Check the backend connection and try again."}
                                            </p>
                                            <button
                                                type="button"
                                                onClick={() => auditQuery.refetch()}
                                                className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                                            >
                                                Try again
                                            </button>
                                        </div>
                                    ) : filteredLogs.length === 0 ? (
                                        <div className="px-6 py-16 text-center">
                                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
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
                                            <h3 className="mt-3 font-semibold text-foreground">
                                                No audit records
                                            </h3>
                                            <p className="mt-1 text-sm text-muted-foreground">
                                                No records match the selected filters.
                                            </p>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="overflow-x-auto">
                                                <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                                                    <thead className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
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

                                                    <tbody className="divide-y divide-border">
                                                    {filteredLogs.map((log) => (
                                                        <AuditLogRow
                                                            key={log.id}
                                                            log={log}
                                                            selected={selectedLog?.id === log.id}
                                                            onViewDetails={() => setSelectedLog(log)}
                                                            onViewHistory={() => openHistory(log)}
                                                        />
                                                    ))}
                                                    </tbody>
                                                </table>
                                            </div>

                                            <div className="border-t border-border px-4 py-4 md:px-5">
                                                <Pagination
                                                    table={paginationTable}
                                                    isAutoSize={false}
                                                    showSelectionSummary={false}
                                                    onPageSizeChange={(value) => {
                                                        // "Auto" is not supported on this page: fall back to the default size
                                                        const newSize =
                                                            value === "auto" ? PAGE_SIZE : Number(value);

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

                            {selectedLog && (
                                <aside
                                    aria-label="Event inspector"
                                    className="sticky top-4 hidden max-h-[calc(100vh-2rem)] overflow-y-auto rounded-xl border border-border bg-card shadow-sm xl:block"
                                >
                                    <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-5 py-3">
                                        <h2 className="text-sm font-semibold text-foreground">
                                            Event inspector
                                        </h2>

                                        <button
                                            type="button"
                                            aria-label="Close inspector"
                                            onClick={() => setSelectedLog(null)}
                                            className="rounded-md border border-border p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
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
                                                    d="M6 6l12 12M18 6L6 18"
                                                />
                                            </svg>
                                        </button>
                                    </div>

                                    <div className="px-5">
                                        <AuditLogInspector
                                            key={selectedLog.id}
                                            log={selectedLog}
                                            onViewHistory={() => openHistory(selectedLog)}
                                        />
                                    </div>
                                </aside>
                            )}
                        </div>
                    )}
                </div>
            </div>
            <AnimatePresence>
                {selectedLog && (
                    <>
                        {/* Backdrop */}
                        <motion.button
                            type="button"
                            aria-label="Close details"
                            className="fixed inset-0 z-[110] cursor-default bg-black/40 backdrop-blur-sm xl:hidden"
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
                            className="fixed inset-y-0 right-0 z-[120] flex w-full flex-col border-l border-border bg-card shadow-2xl sm:w-[560px] xl:hidden"
                            initial={{ x: "100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "100%" }}
                            transition={{
                                type: "tween",
                                duration: 0.3,
                                ease: "easeInOut",
                            }}
                        >
                            <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
                                <h2
                                    id="audit-detail-title"
                                    className="text-base font-semibold text-foreground"
                                >
                                    Detail
                                </h2>

                                <button
                                    type="button"
                                    aria-label="Close details"
                                    onClick={() => setSelectedLog(null)}
                                    className="rounded-md border border-border p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
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
                                <AuditLogInspector
                                    key={selectedLog.id}
                                    log={selectedLog}
                                    onViewHistory={() => {
                                        setSelectedLog(null);
                                        openHistory(selectedLog);
                                    }}
                                />
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
                        className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
                    >
                        <div className="flex items-start justify-between border-b border-border px-5 py-4">
                            <div>
                                <h2
                                    id="audit-export-title"
                                    className="text-base font-semibold text-foreground"
                                >
                                    Export Audit Log
                                </h2>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Choose an output format to export audit records.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => setShowExportModal(false)}
                                disabled={exporting}
                                aria-label="Close export dialog"
                                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground/80 disabled:opacity-50"
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
                            <p className="text-center text-sm font-semibold text-foreground">
                                Select Export Format
                            </p>

                            <p className="mb-4 text-center text-xs text-muted-foreground">
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
                                className="flex w-full items-center gap-3 rounded-xl border border-border p-4 text-left transition hover:border-indigo-400 hover:bg-indigo-500/10 disabled:opacity-50"
                            >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
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
                        <span className="block text-sm font-semibold text-foreground">
                            CSV
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                            Download as CSV file (.csv)
                        </span>
                    </span>

                                <span className="text-xs font-medium text-muted-foreground">
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
                                className="flex w-full items-center gap-3 rounded-xl border border-border p-4 text-left transition hover:border-emerald-400 hover:bg-emerald-500/10 disabled:opacity-50"
                            >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
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
                        <span className="block text-sm font-semibold text-foreground">
                            Excel
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                            Download as Excel file (.xlsx)
                        </span>
                    </span>

                                <span className="text-xs font-medium text-muted-foreground">
                        .xlsx
                    </span>
                            </button>

                            {exporting && (
                                <p className="pt-2 text-center text-sm text-muted-foreground">
                                    Preparing export file...
                                </p>
                            )}
                        </div>

                        <div className="flex justify-end border-t border-border bg-muted/50 px-5 py-4">
                            <button
                                type="button"
                                disabled={exporting}
                                onClick={() => setShowExportModal(false)}
                                className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground/80 shadow-sm transition hover:bg-muted disabled:opacity-50"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <EntityHistoryDialog
                open={!!historyTarget}
                entityType={historyTarget?.entityType ?? ""}
                entityId={historyTarget?.entityId ?? null}
                onClose={() => setHistoryTarget(null)}
            />
        </MainLayout>
    );
}

function AuditLogRow({
                         log,
                         selected,
                         onViewDetails,
                         onViewHistory,
                     }: {
    log: AuditLogDTO;
    selected: boolean;
    onViewDetails: () => void;
    onViewHistory: () => void;
}) {
    const objectName = log.entityType || "Unknown object";
    const objectId = log.entityId ? `#${log.entityId}` : "";

    return (
        <tr
            onClick={onViewDetails}
            aria-selected={selected}
            className={`cursor-pointer transition-colors ${
                selected ? "bg-indigo-500/10" : "hover:bg-muted/50"
            }`}
        >
            <td className="whitespace-nowrap px-5 py-3.5 text-muted-foreground">
                {formatDate(log.createdAt)}
            </td>

            <td className="px-5 py-3.5">
                <div className="flex items-center gap-3">
                    <Avatar email={log.actorEmail} />
                    <div className="min-w-0">
                        <div className="font-medium text-foreground">
                            {log.actorEmail || "Unknown actor"}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                            ID: {log.actorId ?? "-"}
                        </div>
                    </div>
                </div>
            </td>

            <td className="px-5 py-3.5">
                <ActionBadge action={log.action} />
            </td>

            <td className="px-5 py-3.5">
                <div className="font-medium text-foreground/80">
                    {objectName}
                </div>

                {objectId && (
                    <div className="mt-1 text-xs text-muted-foreground">
                        {objectId}
                    </div>
                )}

                {log.entityId && log.entityType !== "AUTH" && (
                    <button
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation();
                            onViewHistory();
                        }}
                        className="mt-1 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                        View history
                    </button>
                )}
            </td>

            <td className="px-5 py-3.5">
                <ResultBadge result={log.result} />
            </td>

            <td className="px-5 py-3.5 text-right">
                <button
                    type="button"
                    onClick={(event) => {
                        event.stopPropagation();
                        onViewDetails();
                    }}
                    title="View Details"
                    aria-label="View Details"
                    className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground transition hover:bg-muted hover:text-indigo-600 dark:hover:text-indigo-400"
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

