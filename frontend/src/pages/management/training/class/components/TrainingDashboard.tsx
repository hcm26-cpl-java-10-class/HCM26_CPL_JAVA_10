import {
    AlertTriangle,
    BookOpen,
    CheckCircle2,
    ClipboardCheck,
    GraduationCap,
    RefreshCw,
    TrendingUp,
    Users,
} from "lucide-react";
import { useTrainingAnalytics } from "@/hooks/useExternalLookups";
import { MainLayout } from "@/components/layout/MainLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function KPICard({
    label,
    value,
    sub,
    icon: Icon,
    color = "text-foreground",
    bg = "bg-card",
}: {
    label: string;
    value: string | number;
    sub?: string;
    icon: typeof Users;
    color?: string;
    bg?: string;
}) {
    return (
        <div className={cn("rounded-xl border p-4 space-y-2 shadow-sm", bg)}>
            <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{label}</span>
                <Icon className={cn("size-5", color)} />
            </div>
            <p className={cn("text-3xl font-bold", color)}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
    );
}

function SimpleBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
    const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
    return (
        <div className="flex items-center gap-3 text-sm">
            <span className="w-28 truncate text-muted-foreground">{label}</span>
            <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
                <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
            </div>
            <span className="w-6 text-right font-medium">{value}</span>
        </div>
    );
}

function FillRateBar({ code, enrolled, planned, pct }: { code: string; enrolled: number; planned: number; pct: number }) {
    const over = enrolled > planned;
    return (
        <div className="flex items-center gap-3 text-sm">
            <span className="w-40 truncate font-mono text-xs">{code}</span>
            <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
                <div
                    className={cn("h-full rounded-full", over ? "bg-red-500" : pct > 80 ? "bg-green-500" : "bg-blue-500")}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                />
            </div>
            <span className={cn("w-16 text-right text-xs font-medium", over ? "text-red-600" : "text-muted-foreground")}>
                {enrolled}/{planned} ({pct}%)
            </span>
        </div>
    );
}

export function TrainingDashboard() {
    const { data: analytics, isLoading, isError, refetch, isFetching } = useTrainingAnalytics();

    if (isLoading) {
        return (
            <div className="space-y-5">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                    {Array.from({ length: 2 }, (_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
                </div>
            </div>
        );
    }

    if (isError || !analytics) {
        return (
            <div className="text-center py-16 text-muted-foreground space-y-3">
                <AlertTriangle className="size-8 mx-auto text-yellow-500" />
                <p>Không thể tải dữ liệu analytics. Mock server có thể chưa chạy.</p>
                <Button size="sm" variant="outline" onClick={() => void refetch()}>
                    <RefreshCw className="size-4 mr-1" /> Thử lại
                </Button>
            </div>
        );
    }

    const { totalClasses, activeClasses, completedClasses, totalTrainees, passRate, byStatus, bySite, bySkill, fillRate, auditStats } = analytics;

    const statusColors: Record<string, string> = {
        planning: "bg-gray-400",
        assigned: "bg-purple-400",
        active: "bg-blue-500",
        pending_close: "bg-yellow-500",
        completed: "bg-green-500",
        closed: "bg-slate-400",
        cancelled: "bg-red-400",
    };

    const siteColors = ["bg-blue-500", "bg-green-500", "bg-purple-500", "bg-orange-500", "bg-pink-500"];
    const skillColors = ["bg-indigo-500", "bg-teal-500", "bg-amber-500", "bg-rose-500", "bg-cyan-500"];

    const maxBySite = Math.max(...Object.values(bySite), 1);
    const maxBySkill = Math.max(...Object.values(bySkill), 1);

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <TrendingUp className="size-5 text-blue-600" /> Thống kê đào tạo
                    </h2>
                    <p className="text-sm text-muted-foreground">Tổng quan hệ thống quản lý đào tạo thực tế</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => void refetch()} disabled={isFetching}>
                    <RefreshCw className={cn("size-4 mr-1", isFetching && "animate-spin")} />
                    Làm mới
                </Button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KPICard
                    label="Tổng lớp học"
                    value={totalClasses}
                    sub={`${activeClasses} đang hoạt động`}
                    icon={BookOpen}
                    color="text-blue-600"
                />
                <KPICard
                    label="Lớp hoàn thành"
                    value={completedClasses}
                    sub={`${Math.round((completedClasses / (totalClasses || 1)) * 100)}% tổng số lớp`}
                    icon={CheckCircle2}
                    color="text-green-600"
                />
                <KPICard
                    label="Tổng học viên"
                    value={totalTrainees}
                    sub="Đang theo học tất cả lớp"
                    icon={Users}
                    color="text-purple-600"
                />
                <KPICard
                    label="Tỷ lệ hoàn thành"
                    value={`${passRate}%`}
                    sub={passRate >= 70 ? "✅ Đạt mục tiêu" : "⚠ Dưới mục tiêu 70%"}
                    icon={GraduationCap}
                    color={passRate >= 70 ? "text-green-600" : "text-orange-600"}
                />
            </div>

            {/* Charts row */}
            <div className="grid md:grid-cols-2 gap-4">
                {/* By Status */}
                <div className="rounded-xl border bg-card p-4 space-y-3">
                    <h3 className="font-semibold text-sm">Phân bổ theo trạng thái</h3>
                    <div className="space-y-2">
                        {Object.entries(byStatus).map(([status, count], i) => (
                            <SimpleBar
                                key={status}
                                label={status}
                                value={count}
                                max={totalClasses}
                                color={statusColors[status] ?? "bg-gray-400"}
                            />
                        ))}
                    </div>
                </div>

                {/* By Site */}
                <div className="rounded-xl border bg-card p-4 space-y-3">
                    <h3 className="font-semibold text-sm">Phân bổ theo Cơ sở (Site)</h3>
                    <div className="space-y-2">
                        {Object.entries(bySite).map(([site, count], i) => (
                            <SimpleBar
                                key={site}
                                label={site}
                                value={count}
                                max={maxBySite}
                                color={siteColors[i % siteColors.length]}
                            />
                        ))}
                    </div>
                </div>

                {/* By Skill */}
                <div className="rounded-xl border bg-card p-4 space-y-3">
                    <h3 className="font-semibold text-sm">Phân bổ theo Công nghệ (Skills)</h3>
                    <div className="space-y-2">
                        {Object.entries(bySkill).map(([skill, count], i) => (
                            <SimpleBar
                                key={skill}
                                label={skill}
                                value={count}
                                max={maxBySkill}
                                color={skillColors[i % skillColors.length]}
                            />
                        ))}
                    </div>
                </div>

                {/* Audit stats */}
                <div className="rounded-xl border bg-card p-4 space-y-3">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                        <ClipboardCheck className="size-4 text-blue-600" />
                        Kết quả kiểm tra chất lượng
                    </h3>
                    <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="rounded-lg bg-green-50 dark:bg-green-950/20 p-3">
                            <p className="text-2xl font-bold text-green-600">{auditStats.pass}</p>
                            <p className="text-xs text-green-700 dark:text-green-400">✅ Đạt</p>
                        </div>
                        <div className="rounded-lg bg-yellow-50 dark:bg-yellow-950/20 p-3">
                            <p className="text-2xl font-bold text-yellow-600">{auditStats.warning}</p>
                            <p className="text-xs text-yellow-700 dark:text-yellow-400">⚠ Cảnh báo</p>
                        </div>
                        <div className="rounded-lg bg-red-50 dark:bg-red-950/20 p-3">
                            <p className="text-2xl font-bold text-red-600">{auditStats.fail}</p>
                            <p className="text-xs text-red-700 dark:text-red-400">❌ Không đạt</p>
                        </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Tổng {auditStats.total} phiếu kiểm tra ·{" "}
                        {auditStats.total > 0
                            ? `${Math.round((auditStats.pass / auditStats.total) * 100)}% đạt chuẩn`
                            : "Chưa có phiếu kiểm tra"}
                    </p>
                </div>
            </div>

            {/* Fill rate */}
            <div className="rounded-xl border bg-card p-4 space-y-3">
                <h3 className="font-semibold text-sm">Tỷ lệ lấp đầy sĩ số từng lớp</h3>
                <div className="space-y-2">
                    {fillRate.map((f) => (
                        <FillRateBar key={f.code} {...f} />
                    ))}
                </div>
                <p className="text-xs text-muted-foreground">
                    🟢 &gt;80% · 🔵 50-80% · 🔴 Vượt sĩ số kế hoạch
                </p>
            </div>
        </div>
    );
}
