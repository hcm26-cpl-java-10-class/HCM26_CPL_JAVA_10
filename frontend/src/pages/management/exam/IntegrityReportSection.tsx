// NEW (anti-cheat): bao cao vi pham cua ky thi, hien trong trang Thong ke ket qua.
// CHANGED (anti-cheat nang cao): giao dien moi (the tom tat, bieu do, bo loc, phan trang),
// co nop nhanh / noi dung trung, trang thai xem xet cua giao vien.
import { Fragment, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Download, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
    getIntegrityEvents,
    getIntegrityReport,
    reviewIntegrityAttempt,
    type IntegrityFlagReason,
    type IntegrityReportRow,
    type IntegrityReviewStatus,
} from "@/api/exam.api";
import { formatScore } from "@/utils/examScore";

const TYPE_LABEL: Record<string, string> = {
    TAB_HIDDEN: "Rời tab",
    WINDOW_BLUR: "Chuyển cửa sổ",
    FULLSCREEN_EXIT: "Thoát toàn màn hình",
    COPY: "Sao chép",
    CUT: "Cắt",
    PASTE: "Dán",
    CONTEXT_MENU: "Chuột phải",
    DEVTOOLS_KEY: "Phím DevTools",
    PRINT_ATTEMPT: "In / chụp màn hình",
    MULTI_SESSION: "Mở nhiều nơi",
};

const TYPE_COLOR: Record<string, string> = {
    TAB_HIDDEN: "bg-amber-500",
    WINDOW_BLUR: "bg-orange-500",
    FULLSCREEN_EXIT: "bg-sky-500",
    COPY: "bg-violet-500",
    CUT: "bg-violet-400",
    PASTE: "bg-fuchsia-500",
    CONTEXT_MENU: "bg-slate-500",
    DEVTOOLS_KEY: "bg-rose-500",
    PRINT_ATTEMPT: "bg-pink-500",
    MULTI_SESSION: "bg-red-600",
};

const FLAG_LABEL: Record<IntegrityFlagReason, string> = {
    MANY_VIOLATIONS: "Nhiều vi phạm",
    TOO_FAST: "Nộp quá nhanh",
    SIMILAR_CONTENT: "Nội dung trùng",
};

const FLAG_STYLE: Record<IntegrityFlagReason, string> = {
    MANY_VIOLATIONS: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
    TOO_FAST: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    SIMILAR_CONTENT: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300",
};

const REVIEW_LABEL: Record<IntegrityReviewStatus, string> = {
    NOT_REVIEWED: "Chưa xem",
    REVIEWED_NORMAL: "Đã xem - bình thường",
    REVIEWED_SUSPICIOUS: "Đã xem - nghi vấn",
};

const REVIEW_STYLE: Record<IntegrityReviewStatus, string> = {
    NOT_REVIEWED: "bg-muted text-muted-foreground",
    REVIEWED_NORMAL: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    REVIEWED_SUSPICIOUS: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

const PAGE_SIZE = 10;

const fmtDate = (v?: string | null) => (v ? new Date(v).toLocaleString() : "—");
const fmtDuration = (s?: number | null) => {
    if (s == null) return "—";
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}p` : `${m}p ${s % 60}s`;
};

function typeCounts(r: IntegrityReportRow): [string, number][] {
    return ([
        ["TAB_HIDDEN", r.tabSwitchCount],
        ["WINDOW_BLUR", r.windowBlurCount],
        ["FULLSCREEN_EXIT", r.fullscreenExitCount],
        ["COPY", r.copyPasteCount],
        ["CONTEXT_MENU", r.contextMenuCount],
        ["DEVTOOLS_KEY", r.shortcutCount],
        ["MULTI_SESSION", r.multiSessionCount],
    ] as [string, number][]).filter(([, n]) => n > 0);
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: "red" | "amber" | "green" | "default" }) {
    const accent =
        tone === "red" ? "border-l-red-500"
            : tone === "amber" ? "border-l-amber-500"
                : tone === "green" ? "border-l-emerald-500"
                    : "border-l-primary/40";
    return (
        <div className={`rounded-lg border border-l-4 bg-card p-3 ${accent}`}>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
        </div>
    );
}

function BarRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
    const pct = max > 0 ? Math.round((value / max) * 100) : 0;
    return (
        <div className="grid grid-cols-[9rem_1fr_2.5rem] items-center gap-2 text-sm">
            <span className="truncate text-muted-foreground">{label}</span>
            <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-right tabular-nums">{value}</span>
        </div>
    );
}

function EventList({ examId, attemptId }: { examId: number; attemptId: number }) {
    const q = useQuery({
        queryKey: ["integrity-events", examId, attemptId],
        queryFn: () => getIntegrityEvents(examId, attemptId),
    });
    if (q.isLoading) return <p className="text-sm text-muted-foreground">Đang tải sự kiện...</p>;
    if (!q.data?.length) return <p className="text-sm text-muted-foreground">Không có sự kiện vi phạm nào.</p>;
    return (
        <div className="max-h-64 overflow-auto rounded-md border">
            <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/80 text-left text-muted-foreground">
                    <tr>
                        <th className="px-3 py-1.5">Thời điểm</th>
                        <th className="px-3 py-1.5">Loại</th>
                        <th className="px-3 py-1.5">Rời (giây)</th>
                        <th className="px-3 py-1.5">IP</th>
                        <th className="px-3 py-1.5">Trình duyệt</th>
                        <th className="px-3 py-1.5">Chi tiết</th>
                    </tr>
                </thead>
                <tbody>
                    {q.data.map((e) => (
                        <tr key={e.id} className="border-t">
                            <td className="whitespace-nowrap px-3 py-1.5">{fmtDate(e.occurredAt)}</td>
                            <td className="px-3 py-1.5">
                                <span className="inline-flex items-center gap-1.5">
                                    <span className={`size-2 rounded-full ${TYPE_COLOR[e.type] ?? "bg-slate-400"}`} />
                                    {TYPE_LABEL[e.type] ?? e.type}
                                </span>
                            </td>
                            <td className="px-3 py-1.5">{e.durationSeconds ?? "—"}</td>
                            <td className="px-3 py-1.5">{e.ipAddress ?? "—"}</td>
                            <td className="max-w-[16rem] truncate px-3 py-1.5" title={e.userAgent ?? ""}>{e.userAgent ?? "—"}</td>
                            <td className="px-3 py-1.5">{e.detail ?? ""}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function ReviewForm({ examId, row, onSaved }: { examId: number; row: IntegrityReportRow; onSaved: () => void }) {
    const [status, setStatus] = useState<IntegrityReviewStatus>(row.reviewStatus);
    const [note, setNote] = useState(row.reviewNote ?? "");

    useEffect(() => {
        setStatus(row.reviewStatus);
        setNote(row.reviewNote ?? "");
    }, [row.attemptId, row.reviewStatus, row.reviewNote]);

    const mutation = useMutation({
        mutationFn: () => reviewIntegrityAttempt(examId, row.attemptId, { status, note: note.trim() || undefined }),
        onSuccess: () => {
            toast.success("Đã lưu kết quả xem xét.");
            onSaved();
        },
        onError: () => toast.error("Không lưu được kết quả xem xét."),
    });

    const options: IntegrityReviewStatus[] = ["NOT_REVIEWED", "REVIEWED_NORMAL", "REVIEWED_SUSPICIOUS"];
    return (
        <div className="rounded-md border bg-card p-3">
            <p className="text-sm font-medium">Xem xét của giáo viên</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
                Đây chỉ là nhận định sơ bộ, hệ thống không tự kết luận gian lận.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
                {options.map((o) => (
                    <button
                        key={o}
                        type="button"
                        onClick={() => setStatus(o)}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                            status === o ? `${REVIEW_STYLE[o]} border-transparent ring-2 ring-primary/40` : "hover:bg-muted"
                        }`}
                    >
                        {REVIEW_LABEL[o]}
                    </button>
                ))}
            </div>
            <textarea
                className="mt-2 min-h-[64px] w-full rounded-md border bg-background p-2 text-sm"
                placeholder="Ghi chú (ví dụ: rời tab do mất mạng, không có dấu hiệu gian lận)"
                maxLength={1000}
                value={note}
                onChange={(e) => setNote(e.target.value)}
            />
            <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                    {row.reviewedBy ? `Lần xem gần nhất: ${row.reviewedBy} · ${fmtDate(row.reviewedAt)}` : "Chưa có ai xem xét."}
                </span>
                <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
                    {mutation.isPending ? "Đang lưu..." : "Lưu"}
                </Button>
            </div>
        </div>
    );
}

type Filter = "ALL" | "FLAGGED" | "PENDING" | "REVIEWED";
type Sort = "FLAG" | "VIOLATIONS" | "NAME";

export function IntegrityReportSection({ examId }: { examId: number }) {
    const queryClient = useQueryClient();
    const [filter, setFilter] = useState<Filter>("ALL");
    const [sort, setSort] = useState<Sort>("FLAG");
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(0);
    const [expanded, setExpanded] = useState<number | null>(null);

    const query = useQuery({
        queryKey: ["exam-integrity-report", examId],
        queryFn: () => getIntegrityReport(examId),
        enabled: examId > 0,
    });
    const report = query.data;

    const rows = useMemo(() => {
        const term = search.trim().toLowerCase();
        const list = (report?.rows ?? []).filter((r) => {
            if (filter === "FLAGGED" && !r.flagged) return false;
            if (filter === "PENDING" && !(r.flagged && r.reviewStatus === "NOT_REVIEWED")) return false;
            if (filter === "REVIEWED" && r.reviewStatus === "NOT_REVIEWED") return false;
            if (!term) return true;
            return [r.studentName, r.email, r.username, r.employeeCode, r.phone]
                .some((v) => (v ?? "").toLowerCase().includes(term));
        });
        const sorted = [...list];
        if (sort === "VIOLATIONS") sorted.sort((a, b) => b.totalViolations - a.totalViolations);
        else if (sort === "NAME") sorted.sort((a, b) => a.studentName.localeCompare(b.studentName));
        else sorted.sort((a, b) => Number(b.flagged) - Number(a.flagged) || b.totalViolations - a.totalViolations);
        return sorted;
    }, [report, filter, sort, search]);

    useEffect(() => setPage(0), [filter, sort, search]);

    const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    const safePage = Math.min(page, pageCount - 1);
    const pageRows = rows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

    const typeTotals = Object.entries(report?.totalsByType ?? {}).filter(([, n]) => n > 0);
    const maxType = Math.max(1, ...typeTotals.map(([, n]) => n));
    const manyCount = (report?.rows ?? []).filter((r) => r.flagReasons.includes("MANY_VIOLATIONS")).length;
    const maxFlag = Math.max(1, manyCount, report?.tooFastCount ?? 0, report?.similarCount ?? 0);

    const refresh = () => void queryClient.invalidateQueries({ queryKey: ["exam-integrity-report", examId] });

    const exportCsv = () => {
        if (!report) return;
        const head = [
            "Họ tên", "Email", "Username", "Mã nhân viên/sinh viên", "SĐT", "Mô tả", "Khách",
            "Lượt thi", "Trạng thái", "Bắt đầu", "Nộp bài", "Thời gian làm (giây)", "Điểm", "Điểm tối đa",
            "Tổng vi phạm", "Rời tab", "Chuyển cửa sổ", "Thoát toàn màn hình", "Copy/Dán",
            "Chuột phải", "Phím tắt", "Mở nhiều nơi", "Tổng giây rời bài", "Vi phạm gần nhất",
            "Cờ", "Giống nhất (%)", "Giống với", "Trạng thái xem xét", "Người xem", "Thời điểm xem", "Ghi chú",
        ];
        const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
        const lines = [head.map(esc).join(",")];
        for (const r of report.rows) {
            lines.push([
                r.studentName, r.email, r.username, r.employeeCode, r.phone, r.description, r.guest ? "Có" : "Không",
                r.attemptNumber, r.status, fmtDate(r.startedAt), fmtDate(r.submittedAt), r.durationSeconds ?? "",
                r.finalScore ?? r.objectiveScore ?? "", r.maxScore ?? "",
                r.totalViolations, r.tabSwitchCount, r.windowBlurCount, r.fullscreenExitCount, r.copyPasteCount,
                r.contextMenuCount, r.shortcutCount, r.multiSessionCount, r.totalAwaySeconds,
                fmtDate(r.lastViolationAt),
                r.flagReasons.map((f) => FLAG_LABEL[f]).join("; "),
                r.maxSimilarityPercent ?? "", r.similarStudentName ?? "",
                REVIEW_LABEL[r.reviewStatus], r.reviewedBy ?? "", fmtDate(r.reviewedAt), r.reviewNote ?? "",
            ].map(esc).join(","));
        }
        const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `integrity-report-exam-${examId}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const filters: { key: Filter; label: string }[] = [
        { key: "ALL", label: "Tất cả" },
        { key: "FLAGGED", label: "Bị gắn cờ" },
        { key: "PENDING", label: "Chờ xem xét" },
        { key: "REVIEWED", label: "Đã xem" },
    ];

    return (
        <section className="min-w-0 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 className="text-lg font-semibold">Integrity Report (Báo cáo vi phạm)</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Vi phạm và cờ bất thường của từng lượt thi, kèm thông tin sinh viên. Chỉ ghi nhận, không tự động xử lý.
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={exportCsv} disabled={!report?.rows.length}>
                    <Download className="mr-2 h-4 w-4" /> Export CSV
                </Button>
            </div>

            {query.isLoading && <p className="mt-4 text-sm text-muted-foreground">Đang tải...</p>}
            {query.isError && <p className="mt-4 text-sm text-destructive">Không tải được báo cáo vi phạm.</p>}

            {report && !report.antiCheatEnabled && (
                <p className="mt-4 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                    Đề thi này chưa bật chống gian lận. Bật trong form sửa đề (Anti-cheating monitoring); dữ liệu cũ (nếu có) vẫn hiển thị bên dưới.
                </p>
            )}

            {report && (
                <>
                    <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                        <StatCard label="Lượt thi" value={report.totalAttempts} />
                        <StatCard label="Có vi phạm" value={report.attemptsWithViolations} tone="amber" />
                        <StatCard label="Bị gắn cờ" value={report.flaggedAttempts} tone="red" />
                        <StatCard label="Chờ xem xét" value={report.pendingReviewFlagged} tone="amber" />
                        <StatCard label="Đã xem - nghi vấn" value={report.reviewedSuspicious} tone="red" />
                        <StatCard label="Tổng vi phạm" value={report.totalViolations} />
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <div className="rounded-lg border p-4">
                            <p className="text-sm font-medium">Số vi phạm theo loại</p>
                            <div className="mt-3 space-y-2">
                                {typeTotals.length === 0 && (
                                    <p className="text-sm text-muted-foreground">Chưa ghi nhận vi phạm nào.</p>
                                )}
                                {typeTotals.map(([t, n]) => (
                                    <BarRow key={t} label={TYPE_LABEL[t] ?? t} value={n} max={maxType} color={TYPE_COLOR[t] ?? "bg-slate-400"} />
                                ))}
                            </div>
                        </div>
                        <div className="rounded-lg border p-4">
                            <p className="text-sm font-medium">Lượt thi bị gắn cờ theo lý do</p>
                            <div className="mt-3 space-y-2">
                                <BarRow label="Nhiều vi phạm" value={manyCount} max={maxFlag} color="bg-red-500" />
                                <BarRow label="Nộp quá nhanh" value={report.tooFastCount} max={maxFlag} color="bg-amber-500" />
                                <BarRow label="Nội dung trùng" value={report.similarCount} max={maxFlag} color="bg-purple-500" />
                            </div>
                            <p className="mt-3 text-xs text-muted-foreground">
                                Ngưỡng: {report.flagThreshold ? `≥ ${report.flagThreshold} vi phạm` : "vi phạm: tắt"}
                                {" · "}{report.fastSubmitPercent ? `nộp < ${report.fastSubmitPercent}% thời gian` : "nộp nhanh: tắt"}
                                {" · "}{report.similarityPercent ? `tự luận giống ≥ ${report.similarityPercent}%` : "trùng nội dung: tắt"}
                            </p>
                        </div>
                    </div>

                    <div className="mt-5 flex flex-wrap items-center gap-3">
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <input
                                className="h-9 w-64 rounded-md border bg-background pl-8 pr-3 text-sm"
                                placeholder="Tìm tên / email / mã..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <div className="inline-flex overflow-hidden rounded-md border">
                            {filters.map((f) => (
                                <button
                                    key={f.key}
                                    type="button"
                                    onClick={() => setFilter(f.key)}
                                    className={`px-3 py-1.5 text-sm transition ${
                                        filter === f.key ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                                    }`}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>
                        <select
                            className="h-9 rounded-md border bg-background px-2 text-sm"
                            value={sort}
                            onChange={(e) => setSort(e.target.value as Sort)}
                            aria-label="Sắp xếp"
                        >
                            <option value="FLAG">Sắp xếp: gắn cờ trước</option>
                            <option value="VIOLATIONS">Sắp xếp: nhiều vi phạm nhất</option>
                            <option value="NAME">Sắp xếp: theo tên</option>
                        </select>
                        <span className="text-sm text-muted-foreground">{rows.length} lượt</span>
                    </div>

                    <div className="mt-3 overflow-x-auto rounded-lg border">
                        <table className="w-full min-w-[960px] text-sm">
                            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                                <tr>
                                    <th className="w-8 px-3 py-2" />
                                    <th className="px-3 py-2">Sinh viên</th>
                                    <th className="px-3 py-2">Lượt thi</th>
                                    <th className="px-3 py-2">Vi phạm</th>
                                    <th className="px-3 py-2">Cờ</th>
                                    <th className="px-3 py-2">Xem xét</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pageRows.length === 0 && (
                                    <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">Không có dữ liệu.</td></tr>
                                )}
                                {pageRows.map((r) => {
                                    const open = expanded === r.attemptId;
                                    const counts = typeCounts(r);
                                    return (
                                        <Fragment key={r.attemptId}>
                                            <tr
                                                className={`cursor-pointer border-t align-top hover:bg-muted/40 ${r.flagged ? "bg-red-50/60 dark:bg-red-950/20" : ""}`}
                                                onClick={() => setExpanded(open ? null : r.attemptId)}
                                            >
                                                <td className="px-3 py-3 text-muted-foreground">
                                                    {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                </td>
                                                <td className="px-3 py-3">
                                                    <div className="font-medium">{r.studentName}</div>
                                                    <div className="text-xs text-muted-foreground">{r.email ?? "—"}</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {[r.username, r.employeeCode, r.phone].filter(Boolean).join(" · ") || "—"}
                                                        {r.guest && <span className="ml-1 rounded bg-muted px-1.5 py-0.5">Khách</span>}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-3">
                                                    <div>Lượt #{r.attemptNumber}</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {r.finalScore != null || r.objectiveScore != null
                                                            ? `${formatScore(r.finalScore ?? r.objectiveScore)}/${formatScore(r.maxScore ?? 10)} điểm`
                                                            : "Chưa có điểm"}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">Làm {fmtDuration(r.durationSeconds)}</div>
                                                </td>
                                                <td className="px-3 py-3">
                                                    <div className={`text-lg font-semibold tabular-nums ${r.totalViolations > 0 ? "" : "text-muted-foreground"}`}>
                                                        {r.totalViolations}
                                                    </div>
                                                    <div className="mt-1 flex max-w-[16rem] flex-wrap gap-1">
                                                        {counts.map(([t, n]) => (
                                                            <span key={t} className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs">
                                                                <span className={`size-1.5 rounded-full ${TYPE_COLOR[t] ?? "bg-slate-400"}`} />
                                                                {TYPE_LABEL[t] ?? t} {n}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-3">
                                                    {r.flagReasons.length === 0 ? (
                                                        <span className="text-xs text-muted-foreground">—</span>
                                                    ) : (
                                                        <div className="flex flex-col items-start gap-1">
                                                            {r.flagReasons.map((f) => (
                                                                <span key={f} className={`rounded-full px-2 py-0.5 text-xs font-medium ${FLAG_STYLE[f]}`}>
                                                                    {FLAG_LABEL[f]}
                                                                    {f === "SIMILAR_CONTENT" && r.maxSimilarityPercent != null ? ` ${r.maxSimilarityPercent}%` : ""}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-3 py-3">
                                                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${REVIEW_STYLE[r.reviewStatus]}`}>
                                                        {REVIEW_LABEL[r.reviewStatus]}
                                                    </span>
                                                </td>
                                            </tr>
                                            {open && (
                                                <tr className="border-t bg-muted/20">
                                                    <td colSpan={6} className="p-4">
                                                        <div className="grid gap-4 lg:grid-cols-2">
                                                            <div className="space-y-3">
                                                                <div className="grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
                                                                    <span>Bắt đầu: {fmtDate(r.startedAt)}</span>
                                                                    <span>Nộp bài: {fmtDate(r.submittedAt)}</span>
                                                                    <span>Tổng thời gian rời bài: {fmtDuration(r.totalAwaySeconds)}</span>
                                                                    <span>Vi phạm gần nhất: {fmtDate(r.lastViolationAt)}</span>
                                                                    {r.description && <span className="sm:col-span-2">Mô tả: {r.description}</span>}
                                                                </div>
                                                                {r.tooFast && (
                                                                    <p className="rounded-md bg-amber-50 p-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                                                                        Nộp bài sau {fmtDuration(r.durationSeconds)}, dưới {report.fastSubmitPercent}% thời gian cho phép.
                                                                    </p>
                                                                )}
                                                                {r.maxSimilarityPercent != null && (
                                                                    <p className="rounded-md bg-purple-50 p-2 text-sm text-purple-900 dark:bg-purple-950/40 dark:text-purple-200">
                                                                        Tự luận giống {r.maxSimilarityPercent}% với bài của{" "}
                                                                        <strong>{r.similarStudentName}</strong> (lượt #{r.similarAttemptId}). Cần đối chiếu thủ công.
                                                                    </p>
                                                                )}
                                                                <ReviewForm examId={examId} row={r} onSaved={refresh} />
                                                            </div>
                                                            <div>
                                                                <p className="mb-2 text-sm font-medium">Chi tiết sự kiện</p>
                                                                <EventList examId={examId} attemptId={r.attemptId} />
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {pageCount > 1 && (
                        <div className="mt-3 flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Trang {safePage + 1}/{pageCount}</span>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>Trước</Button>
                                <Button variant="outline" size="sm" disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)}>Sau</Button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </section>
    );
}
