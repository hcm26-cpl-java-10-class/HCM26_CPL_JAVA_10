import { enrollmentApi } from "@/api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AuditFilterOptions, AuditLogRow, AuditSummary, PageResponse } from "@/types";
import { useQuery } from "@tanstack/react-query";
import {
    Activity,
    BookOpen,
    Building2,
    Calendar,
    ChevronLeft,
    ChevronRight,
    Download,
    Eye,
    GraduationCap,
    RotateCcw,
    Search,
    User,
    Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAdminStudentPreview } from "@/pages/student/useAdminStudentPreview";
import { DepartmentLogDetailSheet } from "./DepartmentLogDetailSheet";

const getStatusBadge = (status?: string | null) => {
    switch (status?.toUpperCase()) {
        case "ACTIVE":
        case "COMPLETED":
            return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
        case "DROPPED":
        case "REJECTED":
            return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20";
        case "UPDATE":
            return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
        default:
            return "bg-muted text-muted-foreground border-border";
    }
};

const formatDate = (value?: string | null) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "medium" });
};

export default function EnrollmentLogPage() {
    const isAdminStudentPreview = useAdminStudentPreview();
    const [activeTab, setActiveTab] = useState<"ENROLLMENT" | "DEPARTMENT">("ENROLLMENT");
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("ALL");
    const [source, setSource] = useState("ALL");
    const [departmentId, setDepartmentId] = useState("ALL");
    const [courseId, setCourseId] = useState("ALL");
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(20);
    const [selected, setSelected] = useState<AuditLogRow | null>(null);

    const isDepartmentTab = activeTab === "DEPARTMENT";

    const filterParams = useMemo(
        () => ({
            type: activeTab,
            search: search || undefined,
            status: status === "ALL" ? undefined : status,
            source: !isDepartmentTab && source !== "ALL" ? source : undefined,
            departmentId: isDepartmentTab && departmentId !== "ALL" ? Number(departmentId) : undefined,
            courseId: courseId === "ALL" ? undefined : Number(courseId),
            fromDate: fromDate || undefined,
            toDate: toDate || undefined,
        }),
        [activeTab, search, status, source, departmentId, courseId, fromDate, toDate, isDepartmentTab],
    );

    const { data, isLoading, isError } = useQuery<PageResponse<AuditLogRow>>({
        queryKey: ["audit-logs", filterParams, page, pageSize],
        queryFn: () => enrollmentApi.getAuditLogs({ ...filterParams, page, size: pageSize }),
    });

    const { data: summary } = useQuery<AuditSummary>({
        queryKey: ["audit-summary", filterParams],
        queryFn: () => enrollmentApi.getAuditSummary(filterParams),
    });

    const { data: filterOptions } = useQuery<AuditFilterOptions>({
        queryKey: ["audit-filter-options"],
        queryFn: () => enrollmentApi.getAuditFilterOptions(),
        staleTime: 60_000,
    });

    const rows = data?.content ?? [];
    const totalPages = data?.totalPages ?? 1;
    const totalElements = data?.totalElements ?? rows.length;

    const handleFilterChange = <T,>(setter: React.Dispatch<React.SetStateAction<T>>, val: T) => {
        setter(val);
        setPage(0);
    };

    const handleResetFilter = () => {
        setSearch("");
        setStatus("ALL");
        setSource("ALL");
        setDepartmentId("ALL");
        setCourseId("ALL");
        setFromDate("");
        setToDate("");
        setPage(0);
    };

    const isFiltered = Boolean(
        search ||
        status !== "ALL" ||
        (!isDepartmentTab && source !== "ALL") ||
        (isDepartmentTab && departmentId !== "ALL") ||
        courseId !== "ALL" ||
        fromDate ||
        toDate,
    );

    const colCount = 8;

    const summaryCards = [
        {
            label: isDepartmentTab ? "Department Assignments" : "Enrollment Records",
            value: (summary?.totalRecords ?? totalElements).toLocaleString(),
            icon: Activity,
            color: "text-blue-500",
        },
        {
            label: "Departments",
            value: (summary?.totalDepartments ?? 0).toLocaleString(),
            icon: Building2,
            color: "text-violet-500",
        },
        {
            label: "Students",
            value: (summary?.totalStudents ?? 0).toLocaleString(),
            icon: Users,
            color: "text-indigo-500",
        },
        {
            label: "Courses",
            value: (summary?.totalCourses ?? 0).toLocaleString(),
            icon: BookOpen,
            color: "text-emerald-500",
        },
    ];

    const handleExport = async () => {
        const result = await enrollmentApi.getAuditLogs({ ...filterParams, page: 0, size: 10_000 });
        const csvCell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
        const headers = [
            "Type",
            "Actor",
            "Actor email",
            "Target",
            "Course",
            "Department",
            "Students",
            "Source",
            "Status",
            "Progress",
            "Cancellation reason",
            "Timestamp",
            "Details",
        ];
        const lines = (result.content ?? []).map((row) =>
            [
                row.type,
                row.actorName,
                row.actorEmail,
                row.targetName,
                row.courseName,
                row.departmentName,
                row.studentCount,
                row.source,
                row.status,
                row.progressPercentage == null ? "" : `${row.progressPercentage}%`,
                row.cancellationReason,
                row.createdAt,
                row.detail,
            ]
                .map(csvCell)
                .join(","),
        );
        const blob = new Blob([[headers.map(csvCell).join(","), ...lines].join("\n")], {
            type: "text/csv;charset=utf-8",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "enrollment-logs.csv";
        link.click();
        URL.revokeObjectURL(url);
    };

    if (isAdminStudentPreview) return <Navigate to="/courses" replace />;

    return (
        <MainLayout dense pathName={{ "enrollment-logs": "Enrollment Logs" }}>
            <div className="space-y-1.5">
                {/* Header */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-primary">System Audit Trail</p>
                        <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Enrollment Logs</h1>
                    </div>
                    <Button variant="outline" className="shadow-sm" onClick={() => void handleExport()}>
                        <Download className="mr-2 size-4" /> Export CSV
                    </Button>
                </div>

                {/* KPI Cards */}
                <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
                    {summaryCards.map((card) => {
                        const Icon = card.icon;
                        return (
                            <div key={card.label} className="flex items-center justify-between rounded-xl border bg-card px-4 py-2 shadow-sm">
                                <div className="space-y-1">
                                    <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
                                    <p className="text-2xl font-bold tracking-tight text-card-foreground">{card.value}</p>
                                </div>
                                <div className={`rounded-lg bg-muted/60 p-2.5 ${card.color}`}>
                                    <Icon className="size-5" />
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Filter Container */}
                <div className="rounded-xl border bg-card px-4 py-2 shadow-sm space-y-1.5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <Tabs
                            value={activeTab}
                            onValueChange={(val) => {
                                const nextTab = val as "ENROLLMENT" | "DEPARTMENT";
                                setActiveTab(nextTab);
                                setSource("ALL");
                                setDepartmentId("ALL");
                                setPage(0);
                            }}
                            className="w-full sm:w-auto"
                        >
                            <TabsList className="grid w-full grid-cols-2 sm:w-80">
                                <TabsTrigger value="ENROLLMENT" className="flex items-center gap-2">
                                    <GraduationCap className="size-4" /> Student Enrollments
                                </TabsTrigger>
                                <TabsTrigger value="DEPARTMENT" className="flex items-center gap-2">
                                    <Building2 className="size-4" /> Department Logs
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>

                        {isFiltered && (
                            <Button variant="ghost" size="sm" onClick={handleResetFilter} className="h-8 text-xs text-muted-foreground hover:text-foreground">
                                <RotateCcw className="mr-1.5 size-3.5" /> Clear Filters
                            </Button>
                        )}
                    </div>

                    <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-8">
                        <div className="sm:col-span-2 space-y-1">
                            <span className="text-xs font-medium text-muted-foreground">Search</span>
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    value={search}
                                    onChange={(e) => handleFilterChange(setSearch, e.target.value)}
                                    placeholder={isDepartmentTab ? "Search department, course, student..." : "Search student, course, actor..."}
                                    className="h-9 pl-9 text-xs"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <span className="text-xs font-medium text-muted-foreground">Status</span>
                            <Select value={status} onValueChange={(val) => handleFilterChange(setStatus, val)}>
                                <SelectTrigger className="h-9 text-xs">
                                    <SelectValue placeholder="All" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">All Statuses</SelectItem>
                                    <SelectItem value="ACTIVE">Active</SelectItem>
                                    <SelectItem value="COMPLETED">Completed</SelectItem>
                                    <SelectItem value="DROPPED">Dropped</SelectItem>
                                    <SelectItem value="REJECTED">Rejected</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Chỉ hiển thị Department filter ở tab Department Logs */}
                        {isDepartmentTab && (
                            <div className="space-y-1">
                                <span className="text-xs font-medium text-muted-foreground">Department</span>
                                <Select value={departmentId} onValueChange={(val) => handleFilterChange(setDepartmentId, val)}>
                                    <SelectTrigger className="h-9 text-xs">
                                        <SelectValue placeholder="All" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ALL">All Departments</SelectItem>
                                        {(filterOptions?.departments ?? []).map((d) => (
                                            <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        <div className="space-y-1">
                            <span className="text-xs font-medium text-muted-foreground">Course</span>
                            <Select value={courseId} onValueChange={(val) => handleFilterChange(setCourseId, val)}>
                                <SelectTrigger className="h-9 text-xs">
                                    <SelectValue placeholder="All" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">All Courses</SelectItem>
                                    {(filterOptions?.courses ?? []).map((c) => (
                                        <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {!isDepartmentTab && (
                            <div className="space-y-1">
                                <span className="text-xs font-medium text-muted-foreground">Source</span>
                                <Select value={source} onValueChange={(val) => handleFilterChange(setSource, val)}>
                                    <SelectTrigger className="h-9 text-xs">
                                        <SelectValue placeholder="All" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ALL">All Sources</SelectItem>
                                        <SelectItem value="SELF_ENROLLED">Self Enrolled</SelectItem>
                                        <SelectItem value="MANUAL">Manual</SelectItem>
                                        <SelectItem value="API">API System</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        <div className="space-y-1">
                            <span className="text-xs font-medium text-muted-foreground">From Date</span>
                            <Input
                                type="date"
                                value={fromDate}
                                onChange={(e) => handleFilterChange(setFromDate, e.target.value)}
                                className="h-9 text-xs"
                            />
                        </div>

                        <div className="space-y-1">
                            <span className="text-xs font-medium text-muted-foreground">To Date</span>
                            <Input
                                type="date"
                                value={toDate}
                                onChange={(e) => handleFilterChange(setToDate, e.target.value)}
                                className="h-9 text-xs"
                            />
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                    <div className="max-h-[calc(100vh-20rem)] min-h-60 overflow-auto">
                        <table className="min-w-full text-left text-sm">
                            <thead className="sticky top-0 z-10 border-b bg-muted text-xs uppercase tracking-wider text-muted-foreground shadow-[0_1px_0_0_var(--border)]">
                            <tr>
                                <th className="px-4 py-2 font-semibold">Type</th>
                                <th className="px-4 py-2 font-semibold">Actor</th>
                                <th className="px-4 py-2 font-semibold">{isDepartmentTab ? "Department" : "Student"}</th>
                                <th className="px-4 py-2 font-semibold">Course</th>
                                {isDepartmentTab ? (
                                    <th className="px-4 py-2 text-right font-semibold">Students</th>
                                ) : (
                                    <th className="px-4 py-2 font-semibold">Source</th>
                                )}
                                <th className="px-4 py-2 font-semibold">Timestamp</th>
                                <th className="px-4 py-2 font-semibold">Status</th>
                                <th className="px-4 py-2 text-right font-semibold">Action</th>
                            </tr>
                            </thead>

                            <tbody className="divide-y divide-border/60">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={colCount} className="px-4 py-4 text-center text-muted-foreground">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <div className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                                            <span>Loading logs...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : isError ? (
                                <tr>
                                    <td colSpan={colCount} className="px-4 py-4 text-center text-destructive">
                                        Failed to fetch logs.
                                    </td>
                                </tr>
                            ) : rows.length === 0 ? (
                                <tr>
                                    <td colSpan={colCount} className="px-4 py-4 text-center text-muted-foreground">
                                        No logs match current query.
                                    </td>
                                </tr>
                            ) : (
                                rows.map((row) => (
                                    <tr key={row.id} className="transition-colors hover:bg-muted/30">
                                        <td className="px-4 py-2 align-middle">
                                            <Badge variant="outline" className={`font-mono text-[11px] ${
                                                row.type === "ENROLLMENT"
                                                    ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                                                    : "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20"
                                            }`}>
                                                {row.type}
                                            </Badge>
                                        </td>

                                        <td className="px-4 py-2 align-middle">
                                            <div className="flex items-center gap-2">
                                                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                                                    {(row.actorName?.[0] ?? "S").toUpperCase()}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="font-medium text-foreground truncate">{row.actorName ?? "System"}</div>
                                                    <div className="text-xs text-muted-foreground truncate">{row.actorEmail ?? "-"}</div>
                                                </div>
                                            </div>
                                        </td>

                                        <td className="px-4 py-2 align-middle">
                                            <div className="font-medium text-foreground">
                                                {isDepartmentTab ? row.departmentName ?? "-" : row.targetName ?? "-"}
                                            </div>
                                            <div className="text-xs text-muted-foreground">{row.targetType ?? "-"}</div>
                                        </td>

                                        <td className="px-4 py-2 align-middle font-medium text-foreground">
                                            {row.courseName ?? "-"}
                                        </td>

                                        {isDepartmentTab ? (
                                            <td className="px-4 py-2 text-right align-middle">
                                                <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
                                                    <Users className="size-3.5 text-muted-foreground" />
                                                    {(row.studentCount ?? 0).toLocaleString()}
                                                </span>
                                            </td>
                                        ) : (
                                            <td className="px-4 py-2 align-middle text-xs font-mono text-muted-foreground">
                                                {row.source ?? "-"}
                                            </td>
                                        )}

                                        <td className="px-4 py-2 align-middle whitespace-nowrap text-xs text-muted-foreground">
                                            {formatDate(row.createdAt)}
                                        </td>

                                        <td className="px-4 py-2 align-middle">
                                            <Badge variant="outline" className={`text-[11px] ${getStatusBadge(row.status)}`}>
                                                {row.status ?? "N/A"}
                                            </Badge>
                                        </td>

                                        <td className="px-4 py-2 align-middle text-right">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setSelected(row)}
                                                className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
                                            >
                                                <Eye className="size-3.5" /> Details
                                            </Button>
                                        </td>
                                    </tr>
                                ))
                            )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="flex flex-col gap-3 border-t px-4 py-2 sm:flex-row sm:items-center sm:justify-between text-xs text-muted-foreground">
                        <div>
                            Showing <span className="font-medium text-foreground">{rows.length > 0 ? page * pageSize + 1 : 0}</span> to{" "}
                            <span className="font-medium text-foreground">{Math.min((page + 1) * pageSize, totalElements)}</span> of{" "}
                            <span className="font-medium text-foreground">{totalElements}</span> entries
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5">
                                <span>Rows per page:</span>
                                <Select
                                    value={String(pageSize)}
                                    onValueChange={(val) => {
                                        setPageSize(Number(val));
                                        setPage(0);
                                    }}
                                >
                                    <SelectTrigger className="h-8 w-16 text-xs">
                                        <SelectValue placeholder={String(pageSize)} />
                                    </SelectTrigger>
                                    <SelectContent side="top">
                                        <SelectItem value="10">10</SelectItem>
                                        <SelectItem value="20">20</SelectItem>
                                        <SelectItem value="50">50</SelectItem>
                                        <SelectItem value="100">100</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex items-center gap-1">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="size-8"
                                    onClick={() => setPage((prev) => Math.max(0, prev - 1))}
                                    disabled={page === 0 || isLoading}
                                >
                                    <ChevronLeft className="size-4" />
                                </Button>
                                <span className="px-2 text-foreground font-medium">
                                    {page + 1} / {totalPages || 1}
                                </span>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="size-8"
                                    onClick={() => setPage((prev) => Math.min(totalPages - 1, prev + 1))}
                                    disabled={page >= totalPages - 1 || isLoading}
                                >
                                    <ChevronRight className="size-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Detail: department assignment */}
            <DepartmentLogDetailSheet
                row={selected?.type === "DEPARTMENT" ? selected : null}
                onClose={() => setSelected(null)}
                formatDate={formatDate}
                statusClass={getStatusBadge}
            />

            {/* Detail: student enrollment */}
            <Sheet open={!!selected && selected.type !== "DEPARTMENT"} onOpenChange={(open) => !open && setSelected(null)}>
                <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto p-4">
                    <SheetHeader className="border-b pb-4">
                        <SheetTitle className="text-xl font-bold flex items-center justify-between">
                            <span>Log Details Inspection</span>
                            {selected && (
                                <Badge variant="outline" className={`font-mono text-xs ${getStatusBadge(selected.status)}`}>
                                    {selected.status ?? "UNKNOWN"}
                                </Badge>
                            )}
                        </SheetTitle>
                    </SheetHeader>

                    {selected && (
                        <div className="mt-3 space-y-3 text-sm">
                            <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
                                <div className="flex items-center gap-2 font-semibold text-foreground">
                                    <User className="size-4 text-primary" /> Actor Info
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div>
                                        <span className="text-muted-foreground">Actor:</span>
                                        <p className="mt-0.5 font-medium text-foreground">{selected.actorName ?? "System"}</p>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">Email:</span>
                                        <p className="mt-0.5 font-medium text-foreground">{selected.actorEmail ?? "-"}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
                                <div className="flex items-center gap-2 font-semibold text-foreground">
                                    <Activity className="size-4 text-primary" /> Target & Context
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div>
                                        <span className="text-muted-foreground">Student Name:</span>
                                        <p className="mt-0.5 font-medium text-foreground">{selected.targetName ?? "-"}</p>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">Type:</span>
                                        <p className="mt-0.5 font-medium text-foreground">{selected.targetType ?? "-"}</p>
                                    </div>
                                    <div className="col-span-2">
                                        <span className="text-muted-foreground">Course:</span>
                                        <p className="mt-0.5 font-medium text-foreground">{selected.courseName ?? "-"}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-lg border bg-muted/20 p-4 space-y-2">
                                <span className="text-xs font-semibold text-foreground">Action Narrative</span>
                                <p className="text-xs leading-relaxed text-muted-foreground">{selected.detail ?? "No detail logged."}</p>
                            </div>

                            {selected.status === "DROPPED" && (
                                <div className="rounded-lg border bg-muted/20 p-4 text-xs">
                                    <p className="font-semibold text-foreground">Cancellation details</p>
                                    <div className="mt-3 grid grid-cols-2 gap-3">
                                        <div><span className="text-muted-foreground">Progress at cancellation:</span><p className="mt-0.5 font-medium text-foreground">{selected.progressPercentage ?? 0}%</p></div>
                                        <div><span className="text-muted-foreground">Reason:</span><p className="mt-0.5 font-medium text-foreground">{selected.cancellationReason || "No reason recorded"}</p></div>
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center justify-between rounded-lg border p-3 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1.5">
                                    <Calendar className="size-3.5" /> Executed At
                                </span>
                                <span className="font-medium text-foreground">{formatDate(selected.createdAt)}</span>
                            </div>
                        </div>
                    )}
                </SheetContent>
            </Sheet>
        </MainLayout>
    );
}
