import { courseReportApi } from "@/api/features/demo/course-report.api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Search, Users } from "lucide-react";
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

    const { data = [] } = useQuery({
        queryKey: ["course-report"],
        queryFn: courseReportApi.getCourseEnrollmentReport,
    });

    const filteredRows = useMemo(() => {
        const keyword = query.trim().toLowerCase();

        return data.filter((row) => {
            const matchesStatus = status === "ALL" || row.courseStatus === status;
            const matchesSearch =
                !keyword ||
                row.courseName?.toLowerCase().includes(keyword) ||
                row.instructor?.toLowerCase().includes(keyword) ||
                row.students?.some((student) => student.toLowerCase().includes(keyword));

            return matchesStatus && matchesSearch;
        });
    }, [data, query, status]);

    const totalCourses = filteredRows.length;
    const totalLearners = filteredRows.reduce(
        (sum, row) => sum + (row.studentCount ?? 0),
        0,
    );

    const publishedCourses = filteredRows.filter(
        (row) => row.courseStatus === "PUBLISHED",
    ).length;

    return (
        <MainLayout pathName={{ "course-report": "Course Report" }}>
            <section className="space-y-6">
                <div>
                    <p className="text-sm font-medium text-blue-700">COURSE OVERVIEW</p>
                    <h1 className="mt-1 text-3xl font-bold tracking-tight">
                        Course Report
                    </h1>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-xl border bg-background p-4 shadow-sm">
                        <div className="flex items-center justify-between text-muted-foreground">
                            <span className="text-sm">Total courses</span>
                            <BookOpen className="size-4" />
                        </div>
                        <div className="mt-3 text-3xl font-semibold">{totalCourses}</div>
                    </div>

                    <div className="rounded-xl border bg-background p-4 shadow-sm">
                        <div className="flex items-center justify-between text-muted-foreground">
                            <span className="text-sm">Published</span>
                            <BookOpen className="size-4" />
                        </div>
                        <div className="mt-3 text-3xl font-semibold">{publishedCourses}</div>
                    </div>

                    <div className="rounded-xl border bg-background p-4 shadow-sm">
                        <div className="flex items-center justify-between text-muted-foreground">
                            <span className="text-sm">Total learners</span>
                            <Users className="size-4" />
                        </div>
                        <div className="mt-3 text-3xl font-semibold">{totalLearners}</div>
                    </div>
                </div>

                <div className="rounded-xl border bg-background p-4 shadow-sm">
                    <div className="flex flex-col gap-3 md:flex-row">
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

                <div className="overflow-hidden rounded-xl border bg-background">
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-sm">
                            <thead className="bg-muted/60 text-muted-foreground">
                            <tr>
                                <th className="px-4 py-3 font-medium">Course</th>
                                <th className="px-4 py-3 font-medium">Instructor</th>
                                <th className="px-4 py-3 font-medium">Status</th>
                                <th className="px-4 py-3 font-medium">Students</th>
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
                                filteredRows.map((row) => (
                                    <tr key={row.courseId} className="border-t">
                                        <td className="px-4 py-3 align-top">
                                            <div className="font-medium">{row.courseName}</div>
                                        </td>

                                        <td className="px-4 py-3 align-top">
                                            {row.instructor || "-"}
                                        </td>

                                        <td className="px-4 py-3 align-top">
                        <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium uppercase">
                          {row.courseStatus || "DRAFT"}
                        </span>
                                        </td>

                                        <td className="px-4 py-3 align-top">
                                            <div className="space-y-1">
                                                <div className="font-medium text-blue-700">
                                                    {row.studentCount ?? 0} learners
                                                </div>

                                                {row.students && row.students.length > 0 ? (
                                                    row.students.map((student) => (
                                                        <div key={student} className="text-muted-foreground">
                                                            • {student}
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="text-muted-foreground">No learners</div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>
        </MainLayout>
    );
}
