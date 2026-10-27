// NEW (anti-cheat): bao cao vi pham cua ky thi, hien trong trang Thong ke ket qua.
// Moi dong = 1 luot lam bai, kem day du thong tin sinh vien hien co.
import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    getIntegrityEvents,
    getIntegrityReport,
    type IntegrityReportRow,
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

const fmtDate = (v?: string | null) => (v ? new Date(v).toLocaleString() : "—");
const fmtAway = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}p ${s % 60}s` : `${s}s`);

function EventDetail({ examId, attemptId }: { examId: number; attemptId: number }) {
    const q = useQuery({
        queryKey: ["integrity-events", examId, attemptId],
        queryFn: () => getIntegrityEvents(examId, attemptId),
    });
    if (q.isLoading) return <p className="p-3 text-sm text-muted-foreground">Đang tải...</p>;
    if (!q.data?.length) return <p className="p-3 text-sm text-muted-foreground">Không có sự kiện.</p>;
    return (
        <table className="w-full text-xs">
            <thead>
            <tr className="text-left text-muted-foreground">
                <th className="px-3 py-1">Thời điểm</th>
                <th className="px-3 py-1">Loại</th>
                <th className="px-3 py-1">Thời gian rời (giây)</th>
                <th className="px-3 py-1">IP</th>
                <th className="px-3 py-1">Trình duyệt</th>
                <th className="px-3 py-1">Chi tiết</th>
            </tr>
            </thead>
            <tbody>
            {q.data.map((e) => (
                <tr key={e.id} className="border-t">
                    <td className="px-3 py-1 whitespace-nowrap">{fmtDate(e.occurredAt)}</td>
                    <td className="px-3 py-1">{TYPE_LABEL[e.type] ?? e.type}</td>
                    <td className="px-3 py-1">{e.durationSeconds ?? "—"}</td>
                    <td className="px-3 py-1">{e.ipAddress ?? "—"}</td>
                    <td className="max-w-xs truncate px-3 py-1" title={e.userAgent ?? ""}>{e.userAgent ?? "—"}</td>
                    <td className="px-3 py-1">{e.detail ?? ""}</td>
                </tr>
            ))}
            </tbody>
        </table>
    );
}

export function IntegrityReportSection({ examId }: { examId: number }) {
    const [onlyViolations, setOnlyViolations] = useState(false);
    const [search, setSearch] = useState("");
    const [expanded, setExpanded] = useState<number | null>(null);

    const query = useQuery({
        queryKey: ["exam-integrity-report", examId],
        queryFn: () => getIntegrityReport(examId),
        enabled: examId > 0,
    });
    const report = query.data;

    const rows = useMemo(() => {
        const term = search.trim().toLowerCase();
        return (report?.rows ?? []).filter((r) => {
            if (onlyViolations && r.totalViolations === 0) return false;
            if (!term) return true;
            return [r.studentName, r.email, r.username, r.employeeCode, r.phone]
                .some((v) => (v ?? "").toLowerCase().includes(term));
        });
    }, [report, onlyViolations, search]);

    const exportCsv = () => {
        if (!report) return;
        const head = [
            "Họ tên", "Email", "Username", "Mã nhân viên/sinh viên", "SĐT", "Mô tả", "Khách",
            "Lượt thi", "Trạng thái", "Bắt đầu", "Nộp bài", "Điểm", "Điểm tối đa",
            "Tổng vi phạm", "Rời tab", "Chuyển cửa sổ", "Thoát toàn màn hình", "Copy/Dán",
            "Chuột phải", "Phím tắt", "Mở nhiều nơi", "Tổng giây rời bài", "Vi phạm gần nhất", "Nghi vấn",
        ];
        const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
        const lines = [head.map(esc).join(",")];
        for (const r of report.rows) {
            lines.push([
                r.studentName, r.email, r.username, r.employeeCode, r.phone, r.description, r.guest ? "Có" : "Không",
                r.attemptNumber, r.status, fmtDate(r.startedAt), fmtDate(r.submittedAt),
                r.finalScore ?? r.objectiveScore ?? "", r.maxScore ?? "",
                r.totalViolations, r.tabSwitchCount, r.windowBlurCount, r.fullscreenExitCount, r.copyPasteCount,
                r.contextMenuCount, r.shortcutCount, r.multiSessionCount, r.totalAwaySeconds,
                fmtDate(r.lastViolationAt), r.flagged ? "Có" : "Không",
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

    const num = (n: number, warn = false) => (
        <span className={n > 0 ? (warn ? "font-semibold text-red-600" : "font-medium") : "text-muted-foreground"}>{n}</span>
    );

    return (
        <section className="min-w-0 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 className="text-lg font-semibold">Integrity Report (Báo cáo vi phạm)</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Số lần vi phạm của từng lượt thi, kèm thông tin sinh viên. Chỉ ghi nhận, không tự động xử lý.
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
                    <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                        {[
                            ["Lượt thi", report.totalAttempts],
                            ["Lượt có vi phạm", report.attemptsWithViolations],
                            ["Lượt nghi vấn", report.flaggedAttempts],
                            ["Tổng vi phạm", report.totalViolations],
                        ].map(([label, value]) => (
                            <div key={String(label)} className="rounded-lg border p-3">
                                <p className="text-xs text-muted-foreground">{label}</p>
                                <p className="mt-1 text-xl font-semibold">{value}</p>
                            </div>
                        ))}
                    </div>
                    {report.flagThreshold ? (
                        <p className="mt-2 text-xs text-muted-foreground">
                            Đánh dấu nghi vấn khi từ {report.flagThreshold} vi phạm trở lên.
                        </p>
                    ) : null}

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                        <input
                            className="h-9 w-64 rounded-md border bg-background px-3 text-sm"
                            placeholder="Tìm tên / email / mã..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        <label className="flex items-center gap-2 text-sm">
                            <input type="checkbox" className="size-4 accent-primary" checked={onlyViolations} onChange={(e) => setOnlyViolations(e.target.checked)} />
                            Chỉ hiện lượt có vi phạm
                        </label>
                    </div>

                    <div className="mt-3 overflow-x-auto rounded-lg border">
                        <table className="w-full min-w-[1100px] text-sm">
                            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                            <tr>
                                <th className="px-3 py-2">Sinh viên</th>
                                <th className="px-3 py-2">Email</th>
                                <th className="px-3 py-2">Username / Mã</th>
                                <th className="px-3 py-2">SĐT</th>
                                <th className="px-3 py-2">Lượt</th>
                                <th className="px-3 py-2">Điểm</th>
                                <th className="px-3 py-2">Rời tab</th>
                                <th className="px-3 py-2">Chuyển cửa sổ</th>
                                <th className="px-3 py-2">Toàn màn hình</th>
                                <th className="px-3 py-2">Copy/Dán</th>
                                <th className="px-3 py-2">Chuột phải</th>
                                <th className="px-3 py-2">Phím tắt</th>
                                <th className="px-3 py-2">Nhiều nơi</th>
                                <th className="px-3 py-2">Tổng</th>
                                <th className="px-3 py-2">Thời gian rời</th>
                            </tr>
                            </thead>
                            <tbody>
                            {rows.length === 0 && (
                                <tr><td colSpan={15} className="px-3 py-6 text-center text-muted-foreground">Không có dữ liệu.</td></tr>
                            )}
                            {rows.map((r: IntegrityReportRow) => (
                                <Fragment key={r.attemptId}>
                                    <tr
                                        className={`cursor-pointer border-t hover:bg-muted/40 ${r.flagged ? "bg-red-50" : ""}`}
                                        onClick={() => setExpanded(expanded === r.attemptId ? null : r.attemptId)}
                                    >
                                        <td className="px-3 py-2">
                                            <div className="font-medium">{r.studentName}</div>
                                            <div className="text-xs text-muted-foreground">
                                                {r.guest ? "Khách (ẩn danh)" : "Tài khoản"}
                                                {r.flagged && <span className="ml-2 font-semibold text-red-600">Nghi vấn</span>}
                                            </div>
                                        </td>
                                        <td className="px-3 py-2">{r.email ?? "—"}</td>
                                        <td className="px-3 py-2">{[r.username, r.employeeCode].filter(Boolean).join(" / ") || "—"}</td>
                                        <td className="px-3 py-2">{r.phone ?? "—"}</td>
                                        <td className="px-3 py-2">#{r.attemptNumber}</td>
                                        <td className="px-3 py-2">
                                            {r.finalScore != null || r.objectiveScore != null
                                                ? `${formatScore(r.finalScore ?? r.objectiveScore)}/${formatScore(r.maxScore ?? 10)}`
                                                : "—"}
                                        </td>
                                        <td className="px-3 py-2">{num(r.tabSwitchCount)}</td>
                                        <td className="px-3 py-2">{num(r.windowBlurCount)}</td>
                                        <td className="px-3 py-2">{num(r.fullscreenExitCount)}</td>
                                        <td className="px-3 py-2">{num(r.copyPasteCount)}</td>
                                        <td className="px-3 py-2">{num(r.contextMenuCount)}</td>
                                        <td className="px-3 py-2">{num(r.shortcutCount)}</td>
                                        <td className="px-3 py-2">{num(r.multiSessionCount, true)}</td>
                                        <td className="px-3 py-2">{num(r.totalViolations, r.flagged)}</td>
                                        <td className="px-3 py-2">{r.totalAwaySeconds ? fmtAway(r.totalAwaySeconds) : "—"}</td>
                                    </tr>
                                    {expanded === r.attemptId && (
                                        <tr className="border-t bg-muted/20">
                                            <td colSpan={15} className="p-3">
                                                <div className="mb-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-3">
                                                    <span>Bắt đầu: {fmtDate(r.startedAt)}</span>
                                                    <span>Nộp bài: {fmtDate(r.submittedAt)}</span>
                                                    <span>Vi phạm gần nhất: {fmtDate(r.lastViolationAt)}</span>
                                                    {r.description && <span className="sm:col-span-3">Mô tả: {r.description}</span>}
                                                </div>
                                                <EventDetail examId={examId} attemptId={r.attemptId} />
                                            </td>
                                        </tr>
                                    )}
                                </Fragment>
                            ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </section>
    );
}
