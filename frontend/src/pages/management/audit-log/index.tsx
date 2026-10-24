
import { useMemo, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
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

function ResultBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      Recorded
    </span>
  );
}

function AuditLogDetails({ log }: { log: AuditLogDTO }) {
  return (
    <div className="grid gap-5 border-t border-slate-200 bg-slate-50 p-5 md:grid-cols-2">
      <div>
        <h4 className="mb-2 text-sm font-semibold text-slate-800">
          Giá trị trước thay đổi
        </h4>
        <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-slate-200 bg-white p-3 text-xs leading-5 text-slate-700">
          {formatValue(log.oldValue)}
        </pre>
      </div>

      <div>
        <h4 className="mb-2 text-sm font-semibold text-slate-800">
          Giá trị sau thay đổi
        </h4>
        <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-slate-200 bg-white p-3 text-xs leading-5 text-slate-700">
          {formatValue(log.newValue)}
        </pre>
      </div>

      <div className="md:col-span-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Correlation ID
        </span>
        <p className="mt-1 break-all text-sm text-slate-700">
          {log.correlationId || "Không có"}
        </p>
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
    "Old Value",
    "New Value",
    "Correlation ID",
  ];

  const escapeCsv = (value: unknown) =>
    `"${String(value ?? "").replace(/"/g, '""')}"`;

const rows = logs.map((log) => [
    log.createdAt,
    log.actorEmail || "Unknown",
    log.actorId ?? "",
    log.action,
    log.entityType || "",
    log.entityId || "",
    log.oldValue || "",
    log.newValue || "",
    log.correlationId || "",
]);

const csv = [headers, ...rows]
    .map((row) => row.map(escapeCsv).join(","))
    .join("\r\n");

// BOM giúp Excel đọc UTF-8 và tiếng Việt chính xác hơn.
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

export default function AuditLogPage() {
    const [action, setAction] = useState("");
    const [period, setPeriod] = useState<Period>("7days");

    const [actorId, setActorId] = useState("");
    const [entityType, setEntityType] = useState("");
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [showAdvanced, setShowAdvanced] = useState(false);

    const [appliedFilters, setAppliedFilters] = useState<AuditLogFilter>(() => ({
        ...getDateRange("7days"),
    }));

    const [page, setPage] = useState(0);
    const [expandedLogId, setExpandedLogId] = useState<number | null>(null);

    const queryFilter = useMemo(
        () => ({
            ...appliedFilters,
            page,
            size: PAGE_SIZE,
        }),
        [appliedFilters, page],
    );

    const auditQuery = useQuery({
        queryKey: ["audit-logs", queryFilter],
        queryFn: () => auditLogApi.getPage(queryFilter),
    });

    const logs = auditQuery.data?.content ?? [];
    const totalPages = auditQuery.data?.totalPages ?? 0;
    const totalElements = auditQuery.data?.totalElements ?? 0;

    function applyFilters(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const parsedActorId = actorId.trim() ? Number(actorId) : undefined;

        if (
            parsedActorId !== undefined &&
            (!Number.isInteger(parsedActorId) || parsedActorId < 0)
        ) {
            window.alert("Actor ID phải là số nguyên không âm.");
            return;
        }

        if (fromDate && toDate && fromDate > toDate) {
            window.alert("Ngày bắt đầu không được lớn hơn ngày kết thúc.");
            return;
        }

        const dateRange =
            fromDate || toDate
                ? {
                    fromDate: fromDate || undefined,
                    toDate: toDate || undefined,
                }
                : getDateRange(period);

        setPage(0);
        setExpandedLogId(null);

        setAppliedFilters({
            actorId: parsedActorId,
            action: action || undefined,
            entityType: entityType.trim() || undefined,
            ...dateRange,
        });
    }

    function resetFilters() {
        setAction("");
        setPeriod("7days");
        setActorId("");
        setEntityType("");
        setFromDate("");
        setToDate("");
        setAppliedFilters(getDateRange("7days"));
        setPage(0);
        setExpandedLogId(null);
    }

    return (
        <MainLayout
            pathName={{
                admin: "Administration",
                "audit-log": "Audit log",
            }}
        >
            <div className="min-h-full bg-slate-50/70 px-4 py-6 md:px-7 lg:px-8">
                <div className="mx-auto max-w-[1440px] space-y-6">
                    {/* Page heading */}
                    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
                                <span>Administration</span>
                                <span className="text-slate-300">/</span>
                                <span className="font-semibold text-slate-800">
                  Audit log
                </span>
                            </div>

                            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                                Audit log
                            </h1>

                            <p className="mt-1.5 text-sm text-slate-500">
                                Trace permission, grade, deadline, export and configuration
                                changes.
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={() => downloadCsv(logs)}
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
                            Export audit
                        </button>
                    </header>

                    {/* Filters and audit table */}
                    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                        <form onSubmit={applyFilters} className="p-4 md:p-5">
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(180px,240px)_minmax(180px,240px)_1fr]">
                                <div>
                                    <label
                                        htmlFor="audit-action"
                                        className="mb-1.5 block text-sm font-semibold text-slate-700"
                                    >
                                        Action
                                    </label>
                                    <select
                                        id="audit-action"
                                        value={action}
                                        onChange={(event) => setAction(event.target.value)}
                                        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                                    >
                                        <option value="">All actions</option>
                                        <option value="CREATE">Create</option>
                                        <option value="UPDATE">Update</option>
                                        <option value="DELETE">Delete</option>
                                    </select>
                                </div>

                                <div>
                                    <label
                                        htmlFor="audit-period"
                                        className="mb-1.5 block text-sm font-semibold text-slate-700"
                                    >
                                        Period
                                    </label>
                                    <select
                                        id="audit-period"
                                        value={period}
                                        onChange={(event) =>
                                            setPeriod(event.target.value as Period)
                                        }
                                        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                                    >
                                        <option value="7days">Last 7 days</option>
                                        <option value="30days">Last 30 days</option>
                                        <option value="thisMonth">This month</option>
                                        <option value="all">All time</option>
                                    </select>
                                </div>

                                <div className="flex flex-wrap items-end gap-2">
                                    <button
                                        type="submit"
                                        className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-700"
                                    >
                                        Apply filters
                                    </button>

                                    <button
                                        type="button"
                                        onClick={resetFilters}
                                        className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                                    >
                                        Reset
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setShowAdvanced((current) => !current)}
                                        className="h-10 rounded-lg px-3 text-sm font-medium text-blue-700 transition hover:bg-blue-50"
                                    >
                                        {showAdvanced ? "Hide advanced" : "Advanced filters"}
                                    </button>
                                </div>
                            </div>

                            {showAdvanced && (
                                <div className="mt-5 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2 lg:grid-cols-4">
                                    <div>
                                        <label
                                            htmlFor="audit-actor"
                                            className="mb-1.5 block text-sm font-medium text-slate-700"
                                        >
                                            Actor ID
                                        </label>
                                        <input
                                            id="audit-actor"
                                            type="number"
                                            min="0"
                                            value={actorId}
                                            onChange={(event) => setActorId(event.target.value)}
                                            placeholder="Enter actor ID"
                                            className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                                        />
                                    </div>

                                    <div>
                                        <label
                                            htmlFor="audit-entity"
                                            className="mb-1.5 block text-sm font-medium text-slate-700"
                                        >
                                            Entity type
                                        </label>
                                        <input
                                            id="audit-entity"
                                            value={entityType}
                                            onChange={(event) => setEntityType(event.target.value)}
                                            placeholder="e.g. USER, ROLE"
                                            className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                                        />
                                    </div>

                                    <div>
                                        <label
                                            htmlFor="audit-from"
                                            className="mb-1.5 block text-sm font-medium text-slate-700"
                                        >
                                            From date
                                        </label>
                                        <input
                                            id="audit-from"
                                            type="date"
                                            value={fromDate}
                                            max={toDate || undefined}
                                            onChange={(event) => setFromDate(event.target.value)}
                                            className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                                        />
                                    </div>

                                    <div>
                                        <label
                                            htmlFor="audit-to"
                                            className="mb-1.5 block text-sm font-medium text-slate-700"
                                        >
                                            To date
                                        </label>
                                        <input
                                            id="audit-to"
                                            type="date"
                                            value={toDate}
                                            min={fromDate || undefined}
                                            onChange={(event) => setToDate(event.target.value)}
                                            className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                                        />
                                    </div>
                                </div>
                            )}
                        </form>

                        <div className="border-t border-slate-200">
                            <div className="flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center sm:justify-between md:px-5">
                                <div>
                                    <h2 className="text-sm font-semibold text-slate-800">
                                        Audit records
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
                            ) : logs.length === 0 ? (
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
                                        <table className="w-full min-w-[760px] text-left text-sm">
                                            <thead className="border-y border-slate-100 bg-white text-xs text-slate-500">
                                            <tr>
                                                <th className="px-5 py-3 font-medium">Time</th>
                                                <th className="px-5 py-3 font-medium">Actor</th>
                                                <th className="px-5 py-3 font-medium">Action</th>
                                                <th className="px-5 py-3 font-medium">Object</th>
                                                <th className="px-5 py-3 font-medium">Result</th>
                                                <th className="px-5 py-3 text-right font-medium">
                                                    Details
                                                </th>
                                            </tr>
                                            </thead>

                                            <tbody className="divide-y divide-slate-100">
                                            {logs.map((log) => (
                                                <AuditLogRow
                                                    key={log.id}
                                                    log={log}
                                                    expanded={expandedLogId === log.id}
                                                    onToggle={() =>
                                                        setExpandedLogId((current) =>
                                                            current === log.id ? null : log.id,
                                                        )
                                                    }
                                                />
                                            ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between md:px-5">
                                        <p className="text-sm text-slate-500">
                                            Showing {logs.length} of {totalElements} records
                                            <span className="mx-2 text-slate-300">·</span>
                                            Page {page + 1} of {Math.max(totalPages, 1)}
                                        </p>

                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                disabled={page === 0 || auditQuery.isFetching}
                                                onClick={() =>
                                                    setPage((current) => Math.max(0, current - 1))
                                                }
                                                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                                            >
                                                Previous
                                            </button>

                                            <button
                                                type="button"
                                                disabled={
                                                    page + 1 >= totalPages || auditQuery.isFetching
                                                }
                                                onClick={() => setPage((current) => current + 1)}
                                                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                                            >
                                                Next
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </section>
                </div>
            </div>
        </MainLayout>
    );
}

function AuditLogRow({
                         log,
                         expanded,
                         onToggle,
                     }: {
    log: AuditLogDTO;
    expanded: boolean;
    onToggle: () => void;
}) {
    const objectName = log.entityType || "Unknown object";
    const objectId = log.entityId ? `#${log.entityId}` : "";

    return (
        <>
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
                    <div className="font-medium text-slate-700">{objectName}</div>
                    {objectId && (
                        <div className="mt-1 text-xs text-slate-400">{objectId}</div>
                    )}
                </td>

                <td className="px-5 py-3.5">
                    <ResultBadge />
                </td>

                <td className="px-5 py-3.5 text-right">
                    <button
                        type="button"
                        onClick={onToggle}
                        aria-expanded={expanded}
                        className="rounded-md px-2.5 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-50"
                    >
                        {expanded ? "Hide details" : "View details"}
                    </button>
                </td>
            </tr>

            {expanded && (
                <tr>
                    <td colSpan={6} className="p-0">
                        <AuditLogDetails log={log} />
                    </td>
                </tr>
            )}
        </>
    );
}

function getErrorStatus(error: unknown): number | undefined {
    if (typeof error === "object" && error !== null && "response" in error) {
        const response = (error as { response?: { status?: number } }).response;
        return response?.status;
    }

    return undefined;
}
