import { courseReportApi } from "@/api/features/demo/course-report.api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TablePagination } from "@/pages/management/demo/analytics/components/TablePagination";
import { TableSearchBox } from "@/pages/management/demo/analytics/components/TableSearchBox";
import type { LearningHoursGroup, LearningHoursRow } from "@/types";
import { useQuery } from "@tanstack/react-query";
import {
    Building2,
    CalendarDays,
    Clock3,
    GraduationCap,
    Users,
} from "lucide-react";
import { useMemo, useState } from "react";

const formatDate = (value?: string | null) => {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-US");
};

const formatHours = (value?: number | null) => {
    if (value === null || value === undefined) return "—";
    if (value === 0) return "0h";
    if (value < 1) return `${Math.round(value * 60)}min`;
    return `${value.toFixed(1)}h`;
};

const formatNumber = (value?: number | null) =>
    value === null || value === undefined ? "—" : value.toLocaleString("en-US");

/**
 * Bảng "Learning hours analytics".
 *
 * <p>Mỗi dòng là một lượt đăng ký (enrollment) của một học viên vào một khóa học,
 * hiển thị 4 cấp giờ học:
 * <ul>
 *   <li>Student hours - giờ học của riêng khóa học đó</li>
 *   <li>Department hours - tổng giờ học của phòng ban</li>
 *   <li>Course hours - tổng giờ học của khóa học</li>
 *   <li>Enrollment date - ngày đăng ký để đối chiếu với thời gian học</li>
 * </ul>
 */
export function LearningHoursAnalytics() {
    const { data, isLoading, isError, error, refetch } = useQuery({
        queryKey: ["learning-hours-report"],
        queryFn: courseReportApi.getLearningHoursReport,
    });

    const [search, setSearch] = useState("");
    const [departmentFilter, setDepartmentFilter] = useState("all");
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(10);

    const filteredRows = useMemo(() => {
        const list = data?.rows ?? [];
        const term = search.trim().toLowerCase();
        return list.filter((row) => {
            if (departmentFilter !== "all" && (row.departmentName ?? "Unassigned") !== departmentFilter) {
                return false;
            }
            if (!term) return true;
            return [row.studentName, row.studentEmail, row.courseName, row.departmentName]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(term));
        });
    }, [data?.rows, search, departmentFilter]);

    // Phân trang phía client (10 bản ghi mỗi trang mặc định).
    const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
    const currentPage = Math.min(page, totalPages - 1);
    const rows = useMemo(
        () => filteredRows.slice(currentPage * pageSize, currentPage * pageSize + pageSize),
        [filteredRows, currentPage, pageSize],
    );

    const handleFilterChange = <T,>(setter: React.Dispatch<React.SetStateAction<T>>, value: T) => {
        setter(value);
        setPage(0);
    };

    const departmentOptions = useMemo(() => {
        const names = new Set<string>();
        for (const row of data?.rows ?? []) {
            names.add(row.departmentName ?? "Unassigned");
        }
        return Array.from(names).sort((a, b) => a.localeCompare(b));
    }, [data?.rows]);

    if (isLoading) {
        return (
            <p role="status" className="rounded-xl border p-4 text-center text-sm text-muted-foreground">
                Loading learning hours analytics...
            </p>
        );
    }

    if (isError) {
        return (
            <div role="alert" className="space-y-3 rounded-xl border border-destructive/30 p-4">
                <p className="text-sm text-destructive">
                    Could not load learning hours: {error instanceof Error ? error.message : "Unknown error"}
                </p>
                <Button variant="outline" onClick={() => void refetch()}>
                    Try again
                </Button>
            </div>
        );
    }

    const totals = data?.totals;

    return (
        <div className="space-y-3">
            <p className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                Scope: total learning hours aggregated by enrollment, learner, department and
                across all courses. For study time within a single course, use Management →
                Analytics → Study Time.
            </p>
            <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-4">
                <SummaryCard
                    label="Total learning hours"
                    value={formatHours(totals?.totalHours)}
                    icon={Clock3}
                />
                <SummaryCard
                    label="Enrolled learners"
                    value={formatNumber(totals?.studentCount)}
                    icon={Users}
                />
                <SummaryCard
                    label="Courses tracked"
                    value={formatNumber(totals?.courseCount)}
                    icon={GraduationCap}
                />
                <SummaryCard
                    label="Avg hours per learner"
                    value={formatHours(totals?.averageHoursPerStudent)}
                    icon={CalendarDays}
                />
            </div>

            <Tabs defaultValue="enrollments">
                <TabsList variant="line">
                    <TabsTrigger value="enrollments">By enrollment</TabsTrigger>
                    <TabsTrigger value="departments">By department</TabsTrigger>
                    <TabsTrigger value="courses">By course</TabsTrigger>
                    <TabsTrigger value="students">By student</TabsTrigger>
                </TabsList>

                <TabsContent value="enrollments" className="mt-3 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <TableSearchBox
                            value={search}
                            onSearch={(term) => handleFilterChange(setSearch, term)}
                            placeholder="Search learner, course or department..."
                        />
                        <Select
                            value={departmentFilter}
                            onValueChange={(value) => handleFilterChange(setDepartmentFilter, value)}
                        >
                            <SelectTrigger className="h-8 w-44 text-xs">
                                <SelectValue placeholder="All departments" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All departments</SelectItem>
                                {departmentOptions.map((name) => (
                                    <SelectItem key={name} value={name}>
                                        {name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <span className="ml-auto text-xs text-muted-foreground">
                            {formatNumber(filteredRows.length)} of {formatNumber(data?.rows.length ?? 0)} enrollments
                        </span>
                    </div>

                    <div className="rounded-lg border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Department</TableHead>
                                    <TableHead>Student</TableHead>
                                    <TableHead>Course</TableHead>
                                    <TableHead>Enrollment date</TableHead>
                                    <TableHead className="text-right">Student hours</TableHead>
                                    <TableHead className="text-right">Department hours</TableHead>
                                    <TableHead className="text-right">Course hours</TableHead>
                                    <TableHead className="text-right">Progress</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rows.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="py-6 text-center text-muted-foreground">
                                            No enrollment matches the current filters.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    rows.map((row) => (
                                        <LearningHoursTableRow key={row.enrollmentId} row={row} />
                                    ))
                                )}
                            </TableBody>
                        </Table>

                        {/* Pagination */}
                        <TablePagination
                            totalItems={filteredRows.length}
                            page={page}
                            pageSize={pageSize}
                            totalPages={totalPages}
                            onPageChange={setPage}
                            onPageSizeChange={(size) => {
                                setPageSize(size);
                                setPage(0);
                            }}
                        />
                    </div>
                </TabsContent>

                <TabsContent value="departments" className="mt-3">
                    <GroupTable
                        groups={data?.departments ?? []}
                        idHeader="Department"
                        nameHeader="Department name"
                    />
                </TabsContent>

                <TabsContent value="courses" className="mt-3">
                    <GroupTable groups={data?.courses ?? []} idHeader="Course ID" nameHeader="Course name" />
                </TabsContent>

                <TabsContent value="students" className="mt-3">
                    <GroupTable
                        groups={data?.students ?? []}
                        idHeader="Learner ID"
                        nameHeader="Learner"
                        showCourses
                        showLearners={false}
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}

function LearningHoursTableRow({ row }: { row: LearningHoursRow }) {
    return (
        <TableRow>
            <TableCell>
                <span className="inline-flex items-center gap-1.5">
                    <Building2 className="size-3.5 text-muted-foreground" />
                    {row.departmentName ?? "Unassigned"}
                </span>
            </TableCell>
            <TableCell>
                <div className="leading-tight">
                    <p className="font-medium">{row.studentName ?? "Unknown learner"}</p>
                    {row.studentEmail && <p className="text-xs text-muted-foreground">{row.studentEmail}</p>}
                </div>
            </TableCell>
            <TableCell className="max-w-[220px] truncate">{row.courseName}</TableCell>
            <TableCell>
                <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="size-3.5 text-muted-foreground" />
                    {formatDate(row.enrolledAt)}
                </span>
            </TableCell>
            <TableCell className="text-right">
                <span className="font-medium">{formatHours(row.enrollmentHours)}</span>
                <p className="text-xs text-muted-foreground">
                    total {formatHours(row.studentHours)}
                </p>
            </TableCell>
            <TableCell className="text-right">{formatHours(row.departmentHours)}</TableCell>
            <TableCell className="text-right">{formatHours(row.courseHours)}</TableCell>
            <TableCell className="text-right">
                <Badge variant={row.completionRate >= 100 ? "secondary" : "outline"}>
                    {row.completionRate.toFixed(0)}%
                </Badge>
            </TableCell>
        </TableRow>
    );
}
function GroupTable({
    groups,
    idHeader,
    nameHeader,
    showCourses = false,
    showLearners = true,
}: {
    groups: LearningHoursGroup[];
    idHeader: string;
    nameHeader: string;
    /** Hiển thị thêm cột "Courses" (dành cho nhóm học viên). */
    showCourses?: boolean;
    /** Hiển thị cột "Learners" (mặc định có, bỏ qua với nhóm học viên). */
    showLearners?: boolean;
}) {
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(10);

    const totalPages = Math.max(1, Math.ceil(groups.length / pageSize));
    const currentPage = Math.min(page, totalPages - 1);
    const rows = groups.slice(currentPage * pageSize, currentPage * pageSize + pageSize);

    if (groups.length === 0) {
        return (
            <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
                No learning time recorded yet.
            </div>
        );
    }

    return (
        <div className="rounded-lg border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>{idHeader}</TableHead>
                        <TableHead>{nameHeader}</TableHead>
                        <TableHead className="text-right">Total hours</TableHead>
                        {showLearners && <TableHead className="text-right">Learners</TableHead>}
                        <TableHead className="text-right">Enrollments</TableHead>
                        {showCourses && <TableHead className="text-right">Courses</TableHead>}
                        <TableHead className="text-right">Avg hours / learner</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.map((group) => (
                        <TableRow key={group.id ?? group.name}>
                            <TableCell className="text-muted-foreground">
                                {group.id ?? "-"}
                            </TableCell>
                            <TableCell className="font-medium">{group.name}</TableCell>
                            <TableCell className="text-right font-medium">
                                {formatHours(group.totalHours)}
                            </TableCell>
                            {showLearners && (
                                <TableCell className="text-right">{formatNumber(group.learnerCount)}</TableCell>
                            )}
                            <TableCell className="text-right">{formatNumber(group.enrollmentCount)}</TableCell>
                            {showCourses && (
                                <TableCell className="text-right">
                                    {formatNumber(group.courseCount ?? 0)}
                                </TableCell>
                            )}
                            <TableCell className="text-right">{formatHours(group.averageHours)}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>

            {/* Pagination */}
            <TablePagination
                totalItems={groups.length}
                page={page}
                pageSize={pageSize}
                totalPages={totalPages}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                    setPageSize(size);
                    setPage(0);
                }}
            />
        </div>
    );
}

function SummaryCard({
    label,
    value,
    icon: Icon,
}: {
    label: string;
    value: string;
    icon: typeof Clock3;
}) {
    return (
        <div className="rounded-xl border bg-card px-4 py-2">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{label}</span>
                <Icon className="size-4" />
            </div>
            <p className="mt-1 text-2xl font-semibold">{value}</p>
        </div>
    );
}
