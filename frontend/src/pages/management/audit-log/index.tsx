import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { auditLogApi, type AuditLogDTO, type AuditLogFilter } from "@/api";

const PAGE_SIZE = 20;

function formatDate(value: string) {
    if (!value) return "-";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleString("vi-VN");
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
    const normalized = action.toUpperCase();

    const classes: Record<string, string> = {
        CREATE: "bg-green-100 text-green-800",
        UPDATE: "bg-blue-100 text-blue-800",
        DELETE: "bg-red-100 text-red-800",
    };

    return (
        <span
            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                classes[normalized] ?? "bg-gray-100 text-gray-700"
            }`}
        >
      {action || "UNKNOWN"}
    </span>
    );
}

function AuditLogDetails({ log }: { log: AuditLogDTO }) {
    return (
        <div className="grid gap-4 border-t bg-gray-50 p-5 md:grid-cols-2">
            <div>
                <h4 className="mb-2 font-semibold text-gray-800">
                    Giá trị trước thay đổi
                </h4>
                <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg border bg-white p-3 text-sm">
          {formatValue(log.oldValue)}
        </pre>
            </div>

            <div>
                <h4 className="mb-2 font-semibold text-gray-800">
                    Giá trị sau thay đổi
                </h4>
                <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg border bg-white p-3 text-sm">
          {formatValue(log.newValue)}
        </pre>
            </div>

            <div className="md:col-span-2">
        <span className="text-sm font-semibold text-gray-700">
          Correlation ID:{" "}
        </span>
                <span className="break-all text-sm text-gray-600">
          {log.correlationId || "Không có"}
        </span>
            </div>
        </div>
    );
}

export default function AuditLogPage() {
    const [actorId, setActorId] = useState("");
    const [action, setAction] = useState("");
    const [entityType, setEntityType] = useState("");
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");

    const [appliedFilters, setAppliedFilters] = useState<AuditLogFilter>({});
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

    function applyFilters(event: React.FormEvent<HTMLFormElement>) {
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

        setPage(0);
        setExpandedLogId(null);

        setAppliedFilters({
            actorId: parsedActorId,
            action: action || undefined,
            entityType: entityType.trim() || undefined,
            fromDate: fromDate || undefined,
            toDate: toDate || undefined,
        });
    }

    function resetFilters() {
        setActorId("");
        setAction("");
        setEntityType("");
        setFromDate("");
        setToDate("");
        setAppliedFilters({});
        setPage(0);
        setExpandedLogId(null);
    }

    return (
        <MainLayout
            pathName={{
                admin: "Quản trị",
                "audit-log": "Audit Log",
            }}
        >
            <div className="space-y-6 p-4 md:p-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">
                            Audit Log
                        </h1>
                        <p className="mt-1 text-sm text-gray-500">
                            Theo dõi lịch sử hoạt động và thay đổi dữ liệu trong hệ thống.
                        </p>
                    </div>

                    <span className="text-sm text-gray-500">
            Tổng số bản ghi:{" "}
                        <strong className="text-gray-900">{totalElements}</strong>
          </span>
                </div>

                <section className="rounded-xl border bg-white p-4 shadow-sm md:p-5">
                    <h2 className="mb-4 text-base font-semibold text-gray-900">
                        Bộ lọc
                    </h2>

                    <form onSubmit={applyFilters} className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            <div>
                                <label
                                    htmlFor="actorId"
                                    className="mb-1.5 block text-sm font-medium text-gray-700"
                                >
                                    Actor ID
                                </label>
                                <input
                                    id="actorId"
                                    type="number"
                                    min="0"
                                    value={actorId}
                                    onChange={(event) => setActorId(event.target.value)}
                                    placeholder="Nhập ID người thực hiện"
                                    className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                />
                            </div>

                            <div>
                                <label
                                    htmlFor="action"
                                    className="mb-1.5 block text-sm font-medium text-gray-700"
                                >
                                    Hành động
                                </label>
                                <select
                                    id="action"
                                    value={action}
                                    onChange={(event) => setAction(event.target.value)}
                                    className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                >
                                    <option value="">Tất cả hành động</option>
                                    <option value="CREATE">CREATE</option>
                                    <option value="UPDATE">UPDATE</option>
                                    <option value="DELETE">DELETE</option>
                                </select>
                            </div>

                            <div>
                                <label
                                    htmlFor="entityType"
                                    className="mb-1.5 block text-sm font-medium text-gray-700"
                                >
                                    Loại đối tượng
                                </label>
                                <input
                                    id="entityType"
                                    value={entityType}
                                    onChange={(event) => setEntityType(event.target.value)}
                                    placeholder="Ví dụ: USER, ROLE"
                                    className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                />
                            </div>

                            <div>
                                <label
                                    htmlFor="fromDate"
                                    className="mb-1.5 block text-sm font-medium text-gray-700"
                                >
                                    Từ ngày
                                </label>
                                <input
                                    id="fromDate"
                                    type="date"
                                    value={fromDate}
                                    max={toDate || undefined}
                                    onChange={(event) => setFromDate(event.target.value)}
                                    className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                />
                            </div>

                            <div>
                                <label
                                    htmlFor="toDate"
                                    className="mb-1.5 block text-sm font-medium text-gray-700"
                                >
                                    Đến ngày
                                </label>
                                <input
                                    id="toDate"
                                    type="date"
                                    value={toDate}
                                    min={fromDate || undefined}
                                    onChange={(event) => setToDate(event.target.value)}
                                    className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                />
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <button
                                type="submit"
                                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                            >
                                Áp dụng bộ lọc
                            </button>

                            <button
                                type="button"
                                onClick={resetFilters}
                                className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                            >
                                Xóa bộ lọc
                            </button>
                        </div>
                    </form>
                </section>

                <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
                    <div className="flex items-center justify-between border-b px-4 py-4 md:px-5">
                        <h2 className="font-semibold text-gray-900">
                            Lịch sử hoạt động
                        </h2>
                        <button
                            type="button"
                            onClick={() => auditQuery.refetch()}
                            disabled={auditQuery.isFetching}
                            className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
                        >
                            {auditQuery.isFetching ? "Đang tải..." : "Làm mới"}
                        </button>
                    </div>

                    {auditQuery.isPending ? (
                        <div className="p-12 text-center text-sm text-gray-500">
                            Đang tải lịch sử hoạt động...
                        </div>
                    ) : auditQuery.isError ? (
                        <div className="p-8 text-center">
                            {getErrorStatus(auditQuery.error) === 403 ? (
                                <>
                                    <h3 className="font-semibold text-red-700">
                                        Không có quyền truy cập
                                    </h3>
                                    <p className="mt-1 text-sm text-gray-500">
                                        Chỉ quản trị viên được phép xem Audit Log.
                                    </p>
                                </>
                            ) : (
                                <>
                                    <h3 className="font-semibold text-red-700">
                                        Không thể tải Audit Log
                                    </h3>
                                    <p className="mt-1 text-sm text-gray-500">
                                        Đã xảy ra lỗi khi lấy dữ liệu. Kiểm tra kết nối backend
                                        hoặc thử tải lại.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => auditQuery.refetch()}
                                        className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                                    >
                                        Thử lại
                                    </button>
                                </>
                            )}
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="p-12 text-center">
                            <h3 className="font-semibold text-gray-800">
                                Không có dữ liệu
                            </h3>
                            <p className="mt-1 text-sm text-gray-500">
                                Không tìm thấy bản ghi Audit Log phù hợp với bộ lọc.
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[900px] text-left text-sm">
                                    <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                                    <tr>
                                        <th className="px-4 py-3 font-semibold">Người thực hiện</th>
                                        <th className="px-4 py-3 font-semibold">Hành động</th>
                                        <th className="px-4 py-3 font-semibold">Đối tượng</th>
                                        <th className="px-4 py-3 font-semibold">ID đối tượng</th>
                                        <th className="px-4 py-3 font-semibold">Thời gian</th>
                                        <th className="px-4 py-3 text-right font-semibold">Chi tiết</th>
                                    </tr>
                                    </thead>

                                    <tbody className="divide-y">
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

                            <div className="flex flex-col gap-3 border-t px-4 py-4 sm:flex-row sm:items-center sm:justify-between md:px-5">
                                <p className="text-sm text-gray-500">
                                    Trang {page + 1} / {Math.max(totalPages, 1)} · {totalElements} bản ghi
                                </p>

                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        disabled={page === 0 || auditQuery.isFetching}
                                        onClick={() => setPage((current) => Math.max(0, current - 1))}
                                        className="rounded-lg border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        Trang trước
                                    </button>
                                    <button
                                        type="button"
                                        disabled={
                                            page + 1 >= totalPages || auditQuery.isFetching
                                        }
                                        onClick={() => setPage((current) => current + 1)}
                                        className="rounded-lg border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        Trang sau
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </section>
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
    return (
        <>
            <tr className="hover:bg-gray-50">
                <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">
                        {log.actorEmail || "Không xác định"}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                        ID: {log.actorId ?? "-"}
                    </div>
                </td>

                <td className="px-4 py-3">
                    <ActionBadge action={log.action} />
                </td>

                <td className="px-4 py-3 text-gray-700">
                    {log.entityType || "-"}
                </td>

                <td className="px-4 py-3 text-gray-700">
                    {log.entityId || "-"}
                </td>

                <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                    {formatDate(log.createdAt)}
                </td>

                <td className="px-4 py-3 text-right">
                    <button
                        type="button"
                        onClick={onToggle}
                        className="rounded-lg border px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
                    >
                        {expanded ? "Ẩn chi tiết" : "Xem chi tiết"}
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
    if (
        typeof error === "object" &&
        error !== null &&
        "response" in error
    ) {
        const response = (error as { response?: { status?: number } }).response;
        return response?.status;
    }

    return undefined;
}