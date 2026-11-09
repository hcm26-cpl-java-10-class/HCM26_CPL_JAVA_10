import { Download, Search, UserRoundPlus } from "lucide-react";
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MainLayout } from "@/components/layout/MainLayout";
import { HeaderUserControls } from "@/components/layout/HeaderUserControls";

export interface DashboardStats {
    totalStudents?: number | null;
    activeStudents?: number | null;
    reservedStudents?: number | null;
    passRate?: number | null;
}

export interface MonthlyLearnerData {
    month: string;
    count: number | null;
}

export interface DashboardTask {
    id: string | number;
    count: number | null;
    message: string;
    tone?: "orange" | "red";
    href?: string;
}

export interface DashboardProps {
    stats?: DashboardStats | null;
    monthlyData?: MonthlyLearnerData[] | null;
    pendingTasks?: DashboardTask[] | null;
}

const formatCount = (value: number | null | undefined) =>
    typeof value === "number" && Number.isFinite(value) ? value.toLocaleString("vi-VN") : "--";

const downloadDashboardReport = (
    stats: DashboardStats | null | undefined,
    monthlyData: MonthlyLearnerData[],
    pendingTasks: DashboardTask[],
) => {
    const escapeCsvValue = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const rows = [
        ["Chỉ số", "Giá trị"],
        ["Tổng học viên", formatCount(stats?.totalStudents)],
        ["Đang học", formatCount(stats?.activeStudents)],
        ["Bảo lưu", formatCount(stats?.reservedStudents)],
        ["Tỷ lệ đạt", typeof stats?.passRate === "number" ? `${stats.passRate}%` : "--"],
        ["Học viên theo tháng", ""],
        ...monthlyData.map(({ month, count }) => [month, formatCount(count)]),
        ["Công việc cần xử lý", ""],
        ...pendingTasks.map(({ message, count }) => [message, formatCount(count)]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(escapeCsvValue).join(",")).join("\r\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `fams-dashboard-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const DashboardHeader = ({
    search,
    onSearchChange,
}: {
    search: string;
    onSearchChange: (value: string) => void;
}) => (
    <div className="flex w-full items-center justify-between gap-4">
        <div className="relative w-full max-w-xl">
            <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
            />
            <Input
                type="search"
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Tìm kiếm học viên, lớp học..."
                aria-label="Tìm kiếm học viên, lớp học"
                className="h-10 rounded-lg border-slate-200 bg-slate-50 pl-9 focus-visible:border-orange-600 focus-visible:ring-orange-500"
            />
        </div>

        <HeaderUserControls />
    </div>
);

const LearnersBarChart = ({ monthlyData }: { monthlyData: MonthlyLearnerData[] }) => {
    const maxCount = Math.max(0, ...monthlyData.map(({ count }) => (typeof count === "number" ? count : 0)));

    if (monthlyData.length === 0) {
        return (
            <div className="flex h-56 items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm text-slate-500">
                Chưa có dữ liệu biểu đồ
            </div>
        );
    }

    return (
        <div
            role="img"
            aria-label="Biểu đồ cột học viên theo tháng"
            className="flex h-56 items-end justify-around gap-4 border-b border-l border-slate-200 px-4 pb-0 pt-5"
        >
            {monthlyData.map((item, index) => {
                const count = typeof item.count === "number" && Number.isFinite(item.count) && item.count > 0 ? item.count : 0;
                const height = maxCount > 0 ? (count / maxCount) * 100 : 0;

                return (
                    <div
                        key={`${item.month}-${index}`}
                        className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2"
                    >
                        <span className="text-xs font-medium text-slate-500">{formatCount(item.count)}</span>
                        <div className="flex h-full w-full items-end justify-center">
                            <div
                                className="w-full max-w-12 rounded-t-md bg-orange-600 transition-colors hover:bg-orange-700"
                                style={{ height: `${height}%` }}
                                aria-hidden="true"
                            />
                        </div>
                        <span className="translate-y-6 truncate text-xs text-slate-500">{item.month}</span>
                    </div>
                );
            })}
        </div>
    );
};

const TrainingProgressChart = ({
    passRate,
    activeStudents,
}: {
    passRate: number | null | undefined;
    activeStudents: number | null | undefined;
}) => {
    const hasPassRate =
        typeof passRate === "number" && Number.isFinite(passRate) && passRate >= 0 && passRate <= 100;
    const normalizedPassRate = hasPassRate ? passRate : null;
    const strokeDash = normalizedPassRate === null ? 0 : (normalizedPassRate / 100) * 283;
    const onTrackCount =
        normalizedPassRate !== null && typeof activeStudents === "number" && Number.isFinite(activeStudents)
            ? Math.round((activeStudents * normalizedPassRate) / 100)
            : null;

    return (
        <div className="flex flex-col items-center">
            <div
                className="relative size-52"
                role="img"
                aria-label={normalizedPassRate === null ? "Chưa có dữ liệu tiến độ đào tạo" : `Tiến độ đào tạo đạt ${normalizedPassRate}%`}
            >
                <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden="true">
                    <circle cx="60" cy="60" r="45" fill="none" stroke="#E2E8F0" strokeWidth="13" />
                    {normalizedPassRate !== null && (
                        <circle
                            cx="60"
                            cy="60"
                            r="45"
                            fill="none"
                            stroke="#EA580C"
                            strokeWidth="13"
                            strokeLinecap="round"
                            strokeDasharray={`${strokeDash} 283`}
                        />
                    )}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-4xl font-bold tracking-tight text-slate-900">
                        {normalizedPassRate === null ? "--" : `${normalizedPassRate}%`}
                    </span>
                    <span className="mt-1 text-xs text-slate-500">đúng tiến độ</span>
                </div>
            </div>
            <p className="mt-3 text-center text-sm text-slate-600">
                <span className="font-semibold text-slate-900">
                    {onTrackCount === null ? "--" : formatCount(onTrackCount)} / {formatCount(activeStudents)}
                </span>{" "}
                học viên đúng tiến độ
            </p>
            <div className="mt-4 flex items-center gap-4 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full bg-orange-600" />
                    Đúng tiến độ
                </span>
                <span className="inline-flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full bg-slate-200" />
                    Cần theo dõi
                </span>
            </div>
        </div>
    );
};

export const Dashboard: React.FC<DashboardProps> = ({ stats, monthlyData, pendingTasks }) => {
    const [search, setSearch] = useState("");
    const chartData = Array.isArray(monthlyData)
        ? monthlyData.filter(
              (item) =>
                  item &&
                  typeof item.month === "string" &&
                  (item.count === null || (Number.isFinite(item.count) && item.count >= 0)),
          )
        : [];
    const tasks = Array.isArray(pendingTasks)
        ? pendingTasks.filter(
              (task) =>
                  task &&
                  task.id !== undefined &&
                  typeof task.message === "string" &&
                  (task.count === null || (Number.isFinite(task.count) && task.count >= 0)),
          )
        : [];
    const query = search.trim().toLocaleLowerCase("vi");
    const matchingTasks = query
        ? tasks.filter((task) => task.message.toLocaleLowerCase("vi").includes(query))
        : tasks;

    return (
        <MainLayout
            headerContent={<DashboardHeader search={search} onSearchChange={setSearch} />}
        >
            <div className="-m-6 min-h-full space-y-6 bg-slate-50 p-5 sm:p-6 lg:p-8">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                    <div>
                        <nav aria-label="Breadcrumb" className="mb-2 text-sm text-slate-500">
                            <span>FAMS</span>
                            <span className="mx-2 text-slate-300">/</span>
                            <span className="font-medium text-slate-700">Tổng quan đào tạo</span>
                        </nav>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Tổng quan đào tạo</h1>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => downloadDashboardReport(stats, chartData, tasks)}
                            className="h-10 border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                        >
                            <Download className="size-4" aria-hidden="true" />
                            Tải báo cáo
                        </Button>
                        <Button
                            asChild
                            className="h-10 bg-orange-600 text-white hover:bg-orange-700"
                        >
                            <Link to="/users/create">
                                <UserRoundPlus className="size-4" aria-hidden="true" />
                                + Thêm học viên
                            </Link>
                        </Button>
                    </div>
                </div>

                <section aria-label="Thống kê học viên" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {[
                        { label: "TỔNG HỌC VIÊN", value: stats?.totalStudents },
                        { label: "ĐANG HỌC", value: stats?.activeStudents },
                        { label: "BẢO LƯU", value: stats?.reservedStudents },
                        { label: "TỶ LỆ ĐẠT", value: stats?.passRate, suffix: "%" },
                    ].map((stat) => {
                        const hasValue =
                            typeof stat.value === "number" &&
                            Number.isFinite(stat.value) &&
                            (stat.suffix !== "%" || (stat.value >= 0 && stat.value <= 100));

                        return (
                            <article
                                key={stat.label}
                                className="rounded-xl border border-slate-200 bg-white px-5 py-5 shadow-sm"
                            >
                                <h2 className="text-xs font-semibold tracking-[0.08em] text-slate-500">
                                    {stat.label}
                                </h2>
                                <p className="mt-4 text-center text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                                    {hasValue ? `${formatCount(stat.value)}${stat.suffix ?? ""}` : "--"}
                                </p>
                                {!hasValue && (
                                    <p className="mt-3 text-center text-xs font-medium text-slate-500">
                                        <span className="rounded-full bg-slate-100 px-2.5 py-1">
                                            Chưa có dữ liệu
                                        </span>
                                    </p>
                                )}
                            </article>
                        );
                    })}
                </section>

                <section aria-label="Biểu đồ đào tạo" className="grid gap-5 lg:grid-cols-3">
                    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2 sm:p-6">
                        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <h2 className="font-semibold text-slate-900">Học viên theo tháng</h2>
                                <p className="mt-1 text-sm text-slate-500">Số lượng học viên mới</p>
                            </div>
                            <label className="sr-only" htmlFor="learner-chart-period">
                                Khoảng thời gian biểu đồ
                            </label>
                            <select
                                id="learner-chart-period"
                                defaultValue="6"
                                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 outline-none focus:border-orange-600 focus:ring-2 focus:ring-orange-500/20"
                            >
                                <option value="6">6 tháng gần nhất</option>
                            </select>
                        </div>
                        <LearnersBarChart monthlyData={chartData} />
                    </article>

                    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                        <div className="mb-3">
                            <h2 className="font-semibold text-slate-900">Tiến độ đào tạo</h2>
                            <p className="mt-1 text-sm text-slate-500">Tỷ lệ học viên đúng tiến độ</p>
                        </div>
                        <TrainingProgressChart passRate={stats?.passRate} activeStudents={stats?.activeStudents} />
                    </article>
                </section>

                <section aria-labelledby="pending-tasks-heading" className="rounded-xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
                        <h2 id="pending-tasks-heading" className="font-semibold text-slate-900">
                            Công việc cần xử lý
                        </h2>
                        <Link to="/users" className="text-sm font-medium text-orange-600 hover:text-orange-700">
                            Xem tất cả →
                        </Link>
                    </div>
                    {tasks.length === 0 ? (
                        <div className="px-6 py-10 text-center">
                            <p className="font-medium text-slate-700">Chưa có công việc cần xử lý</p>
                            <p className="mt-1 text-sm text-slate-500">Các công việc sẽ hiển thị tại đây khi có dữ liệu.</p>
                        </div>
                    ) : matchingTasks.length === 0 ? (
                        <div className="px-6 py-8 text-center text-sm text-slate-500">
                            Không tìm thấy công việc phù hợp với “{search}”.
                        </div>
                    ) : (
                        <ul className="divide-y divide-slate-100">
                            {matchingTasks.map((task) => (
                                <li key={task.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:px-6">
                                    <span
                                        className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                                            task.tone === "red"
                                                ? "bg-red-100 text-red-700"
                                                : "bg-orange-100 text-orange-700"
                                        }`}
                                    >
                                        {formatCount(task.count)}
                                    </span>
                                    <p className="flex-1 text-sm leading-6 text-slate-700">{task.message}</p>
                                    <Link
                                        to={task.href || "/users"}
                                        className="shrink-0 text-sm font-semibold text-orange-600 hover:text-orange-700"
                                    >
                                        Xử lý →
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>
        </MainLayout>
    );
};
