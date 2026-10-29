import { courseReportApi } from "@/api/features/demo/course-report.api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Input } from "@/components/ui/input";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import {
    ArrowDownNarrowWide,
    ArrowUpNarrowWide,
    BookOpen,
    Filter,
    RotateCcw,
    Search,
    Users,
} from "lucide-react";
import { useMemo, useState } from "react";

const STATUS_OPTIONS = [
    { value: "ALL", label: "Tất cả trạng thái" },
    { value: "DRAFT", label: "Draft" },
    { value: "PUBLISHED", label: "Published" },
    { value: "ARCHIVED", label: "Archived" },
];

export default function CourseReportPage() {
    const [query, setQuery] = useState("");
    const [status, setStatus] = useState("ALL");

    // Filter & Sort theo số lượng learner ở header cột Students
    const [minLearners, setMinLearners] = useState<number | undefined>(undefined);
    const [maxLearners, setMaxLearners] = useState<number | undefined>(undefined);
    const [learnerSort, setLearnerSort] = useState<"asc" | "desc">("desc");

    // Search learner trong popup từng dòng
    const [learnerSearch, setLearnerSearch] = useState<Record<string, string>>({});

    const { data = [] } = useQuery({
        queryKey: ["course-report"],
        queryFn: courseReportApi.getCourseEnrollmentReport,
    });

    const filteredRows = useMemo(() => {
        const keyword = query.trim().toLowerCase();

        const rows = data.filter((row) => {
            const matchesStatus = status === "ALL" || row.courseStatus === status;

            const matchesSearch =
                !keyword ||
                row.courseName?.toLowerCase().includes(keyword) ||
                row.instructor?.toLowerCase().includes(keyword) ||
                row.students?.some((student) => student.toLowerCase().includes(keyword));

            const count = row.studentCount ?? 0;
            const matchesMin = minLearners === undefined || count >= minLearners;
            const matchesMax = maxLearners === undefined || count <= maxLearners;

            return matchesStatus && matchesSearch && matchesMin && matchesMax;
        });

        return [...rows].sort((a, b) => {
            const aCount = a.studentCount ?? 0;
            const bCount = b.studentCount ?? 0;
            return learnerSort === "asc" ? aCount - bCount : bCount - aCount;
        });
    }, [data, query, status, minLearners, maxLearners, learnerSort]);

    const totalCourses = filteredRows.length;
    const totalLearners = filteredRows.reduce((sum, row) => sum + (row.studentCount ?? 0), 0);
    const publishedCourses = filteredRows.filter((row) => row.courseStatus === "PUBLISHED").length;
    const isLearnerFiltered = minLearners !== undefined || maxLearners !== undefined;

    return (
        <MainLayout pathName={{ "course-report": "Course Report" }}>
            <section className="space-y-6">
                <div>
                    <p className="text-sm font-medium text-blue-700 dark:text-blue-400">COURSE OVERVIEW</p>
                    <h1 className="mt-1 text-3xl font-bold tracking-tight">Course Report</h1>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-xl border bg-card p-4 text-card-foreground shadow-sm">
                        <div className="flex items-center justify-between text-muted-foreground">
                            <span className="text-sm">Total courses</span>
                            <BookOpen className="size-4" />
                        </div>
                        <div className="mt-3 text-3xl font-semibold">{totalCourses}</div>
                    </div>

                    <div className="rounded-xl border bg-card p-4 text-card-foreground shadow-sm">
                        <div className="flex items-center justify-between text-muted-foreground">
                            <span className="text-sm">Published</span>
                            <BookOpen className="size-4" />
                        </div>
                        <div className="mt-3 text-3xl font-semibold">{publishedCourses}</div>
                    </div>

                    <div className="rounded-xl border bg-card p-4 text-card-foreground shadow-sm">
                        <div className="flex items-center justify-between text-muted-foreground">
                            <span className="text-sm">Total learners</span>
                            <Users className="size-4" />
                        </div>
                        <div className="mt-3 text-3xl font-semibold">{totalLearners}</div>
                    </div>
                </div>

                {/* Thanh tìm kiếm chính & trạng thái */}
                <div className="rounded-xl border bg-card p-4 shadow-sm">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Tìm theo khóa học, giảng viên, học viên..."
                                className="pl-9"
                            />
                        </div>

                        <Select value={status} onValueChange={setStatus}>
                            <SelectTrigger className="w-full md:w-[220px]">
                                <SelectValue placeholder="Chọn trạng thái" />
                            </SelectTrigger>
                            <SelectContent>
                                {STATUS_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="overflow-hidden rounded-xl border bg-card">
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-sm">
                            <thead className="bg-muted/60 text-muted-foreground">
                            <tr>
                                <th className="px-4 py-3 font-medium">Course</th>
                                <th className="px-4 py-3 font-medium">Instructor</th>
                                <th className="px-4 py-3 font-medium">Status</th>
                                <th className="px-4 py-3 font-medium">
                                    <div className="flex items-center gap-2">
                                        <span>Students</span>

                                        {/* Nút bấm chuyển chiều Sort */}
                                        <button
                                            type="button"
                                            onClick={() => setLearnerSort((prev) => (prev === "asc" ? "desc" : "asc"))}
                                            className="inline-flex size-6 items-center justify-center rounded hover:bg-muted"
                                            title={`Sắp xếp: ${learnerSort === "asc" ? "Tăng dần" : "Giảm dần"}`}
                                        >
                                            {learnerSort === "asc" ? (
                                                <ArrowUpNarrowWide className="size-4 text-blue-600 dark:text-blue-400" />
                                            ) : (
                                                <ArrowDownNarrowWide className="size-4 text-blue-600 dark:text-blue-400" />
                                            )}
                                        </button>

                                        {/* Popover lọc dải số lượng Min - Max */}
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <button
                                                    type="button"
                                                    className={`relative inline-flex size-6 items-center justify-center rounded hover:bg-muted ${
                                                        isLearnerFiltered ? "text-blue-600 dark:text-blue-400 font-bold" : "text-muted-foreground"
                                                    }`}
                                                    title="Lọc số lượng học viên"
                                                >
                                                    <Filter className="size-3.5" />
                                                    {isLearnerFiltered && (
                                                        <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-blue-600 dark:bg-blue-400" />
                                                    )}
                                                </button>
                                            </PopoverTrigger>
                                            <PopoverContent align="start" className="w-64 space-y-3 p-3">
                                                <div className="flex items-center justify-between border-b pb-2">
                                                    <span className="text-xs font-semibold text-foreground">Số lượng học viên</span>
                                                    {isLearnerFiltered && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setMinLearners(undefined);
                                                                setMaxLearners(undefined);
                                                            }}
                                                            className="flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 hover:underline"
                                                        >
                                                            <RotateCcw className="size-3" /> Reset
                                                        </button>
                                                    )}
                                                </div>

                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <label className="text-[11px] text-muted-foreground">Tối thiểu</label>
                                                        <Input
                                                            type="number"
                                                            min={0}
                                                            placeholder="0"
                                                            className="h-8 text-xs"
                                                            value={minLearners ?? ""}
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                setMinLearners(val === "" ? undefined : Number(val));
                                                            }}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-[11px] text-muted-foreground">Tối đa</label>
                                                        <Input
                                                            type="number"
                                                            min={0}
                                                            placeholder="∞"
                                                            className="h-8 text-xs"
                                                            value={maxLearners ?? ""}
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                setMaxLearners(val === "" ? undefined : Number(val));
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                </th>
                            </tr>
                            </thead>

                            <tbody>
                            {filteredRows.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                                        No data matches your filter.
                                    </td>
                                </tr>
                            ) : (
                                filteredRows.map((row) => {
                                    const rowId = String(row.courseId ?? -1);
                                    const searchTerm = (learnerSearch[rowId] ?? "").trim().toLowerCase();
                                    const students = (row.students ?? []).filter(
                                        (student) => !searchTerm || student.toLowerCase().includes(searchTerm)
                                    );

                                    return (
                                        <tr key={row.courseId} className="border-t hover:bg-muted/30 transition-colors">
                                            <td className="px-4 py-3 align-middle font-medium">
                                                {row.courseName}
                                            </td>

                                            <td className="px-4 py-3 align-middle">{row.instructor || "-"}</td>

                                            <td className="px-4 py-3 align-middle">
                                                    <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium uppercase">
                                                        {row.courseStatus || "DRAFT"}
                                                    </span>
                                            </td>

                                            <td className="px-4 py-3 align-middle">
                                                {/* Chuyển sang Popover để floating menu nổi lên trên, không làm giật dòng bảng */}
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <button
                                                            type="button"
                                                            className="font-medium text-blue-600 dark:text-blue-400 hover:underline outline-none"
                                                        >
                                                            {row.studentCount ?? 0} learners
                                                        </button>
                                                    </PopoverTrigger>

                                                    <PopoverContent
                                                        align="start"
                                                        className="w-72 p-3 text-xs shadow-xl border border-border bg-popover text-popover-foreground"
                                                    >
                                                        <div className="relative mb-2">
                                                            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                                                            <Input
                                                                value={learnerSearch[rowId] ?? ""}
                                                                onChange={(e) =>
                                                                    setLearnerSearch((prev) => ({
                                                                        ...prev,
                                                                        [rowId]: e.target.value,
                                                                    }))
                                                                }
                                                                placeholder="Tìm kiếm learner..."
                                                                className="h-8 pl-8 text-xs bg-muted/40"
                                                            />
                                                        </div>

                                                        <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                                                            {students.length > 0 ? (
                                                                students.map((student) => (
                                                                    <div
                                                                        key={student}
                                                                        className="flex items-center gap-1.5 rounded px-2 py-1 text-popover-foreground hover:bg-muted/60"
                                                                    >
                                                                        <span className="size-1 rounded-full bg-blue-500" />
                                                                        <span>{student}</span>
                                                                    </div>
                                                                ))
                                                            ) : (
                                                                <div className="py-3 text-center text-muted-foreground">
                                                                    No learners found
                                                                </div>
                                                            )}
                                                        </div>
                                                    </PopoverContent>
                                                </Popover>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>
        </MainLayout>
    );
}