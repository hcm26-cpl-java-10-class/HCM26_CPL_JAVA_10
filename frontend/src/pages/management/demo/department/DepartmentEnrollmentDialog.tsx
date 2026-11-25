import { courseApi, enrollmentApi } from "@/api";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import type { DepartmentDTO } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, BookOpen, Building2, LoaderCircle, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface DepartmentEnrollmentDialogProps {
    department: DepartmentDTO;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function DepartmentEnrollmentDialog({
    department,
    open,
    onOpenChange,
}: DepartmentEnrollmentDialogProps) {
    const [courseId, setCourseId] = useState("");
    const [courseSearch, setCourseSearch] = useState("");
    const [coursePage, setCoursePage] = useState(0);
    const queryClient = useQueryClient();

    useEffect(() => {
        if (!open) {
            setCourseId("");
            setCourseSearch("");
            setCoursePage(0);
        }
    }, [open]);

    const coursesQuery = useQuery({
        queryKey: ["department-enrollment-courses", coursePage, courseSearch],
        enabled: open,
        queryFn: async () => {
            const response = await courseApi.getPage(
                { page: coursePage, size: 20, sort: "name,asc" },
                courseSearch.trim() || undefined,
                { ids: [], status: "PUBLISHED", isActive: true },
            );
            return { courses: response.content, totalPages: response.totalPages };
        },
    });

    const previewQuery = useQuery({
        queryKey: ["department-enrollment-preview", department.id, courseId],
        enabled: open && Boolean(department.id) && Boolean(courseId),
        queryFn: () =>
            enrollmentApi.previewDepartment({
                departmentId: department.id!,
                courseId: Number(courseId),
            }),
    });

    const enrollMutation = useMutation({
        mutationFn: () =>
            enrollmentApi.enrollDepartment({
                departmentId: department.id!,
                courseId: Number(courseId),
            }),
        onSuccess: async (result) => {
            toast.success(
                `${result.newEnrollments} student${result.newEnrollments === 1 ? "" : "s"} enrolled in ${result.courseName}.`,
            );
            await queryClient.invalidateQueries({ queryKey: ["department-overview"] });
            onOpenChange(false);
        },
        onError: (error) => {
            toast.error(error instanceof Error ? error.message : "Department enrollment failed.");
        },
    });

    const preview = previewQuery.data;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Create department enrollment</DialogTitle>
                    <DialogDescription>
                        Enroll every active student in {department.name} in the selected published course.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5">
                    <div className="space-y-2">
                        <label htmlFor="department-course" className="text-sm font-medium">Course</label>
                        {coursesQuery.isLoading ? (
                            <div role="status" className="flex h-10 items-center gap-2 text-sm text-muted-foreground">
                                <LoaderCircle className="size-4 animate-spin" /> Loading courses...
                            </div>
                        ) : coursesQuery.isError ? (
                            <p role="alert" className="text-sm text-destructive">
                                {coursesQuery.error instanceof Error ? coursesQuery.error.message : "Could not load courses."}
                            </p>
                        ) : coursesQuery.data?.courses.length ? (
                            <div className="space-y-2">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        aria-label="Search published courses"
                                        className="pl-9"
                                        placeholder="Search published courses"
                                        value={courseSearch}
                                        onChange={(event) => {
                                            setCourseSearch(event.target.value);
                                            setCoursePage(0);
                                            setCourseId("");
                                        }}
                                    />
                                </div>
                                {coursesQuery.data.courses.length ? (
                                    <Select value={courseId} onValueChange={setCourseId}>
                                        <SelectTrigger id="department-course" className="w-full">
                                            <SelectValue placeholder="Choose a published course" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {coursesQuery.data.courses.map((course) => (
                                                <SelectItem key={course.id} value={String(course.id)}>
                                                    {course.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                                        No courses match this search.
                                    </p>
                                )}
                                {coursesQuery.data.totalPages > 1 && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-muted-foreground">
                                            Page {coursePage + 1} of {coursesQuery.data.totalPages}
                                        </span>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                disabled={coursePage === 0}
                                                onClick={() => {
                                                    setCourseId("");
                                                    setCoursePage((page) => page - 1);
                                                }}
                                            >
                                                Previous
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                disabled={coursePage >= coursesQuery.data.totalPages - 1}
                                                onClick={() => {
                                                    setCourseId("");
                                                    setCoursePage((page) => page + 1);
                                                }}
                                            >
                                                Next
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                                    {courseSearch.trim()
                                        ? "No published courses match this search."
                                        : "No published courses are available for enrollment."}
                                </p>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        aria-label="Search published courses"
                                        className="pl-9"
                                        placeholder="Search published courses"
                                        value={courseSearch}
                                        onChange={(event) => {
                                            setCourseSearch(event.target.value);
                                            setCoursePage(0);
                                            setCourseId("");
                                        }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {courseId && previewQuery.isLoading && (
                        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
                            <LoaderCircle className="size-4 animate-spin" /> Calculating department enrollment...
                        </p>
                    )}
                    {courseId && previewQuery.isError && (
                        <p role="alert" className="text-sm text-destructive">
                            {previewQuery.error instanceof Error ? previewQuery.error.message : "Could not calculate enrollment."}
                        </p>
                    )}
                    {preview && (
                        <div className="rounded-xl border p-4 sm:p-5">
                            <div className="flex items-center gap-3 border-b pb-4">
                                <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                                    <Building2 className="size-6" />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="font-semibold">{department.name}</p>
                                    <p className="text-sm text-muted-foreground">{preview.studentCount} active students</p>
                                </div>
                                <ArrowRight className="size-5 text-muted-foreground" />
                                <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300">
                                    <BookOpen className="size-6" />
                                </span>
                            </div>
                            <div className="space-y-3 pt-4">
                                <p className="text-sm font-medium">{preview.courseName}</p>
                                <div className="flex justify-between gap-4 text-sm">
                                    <span className="text-muted-foreground">Students in department</span>
                                    <span className="font-semibold">{preview.studentCount}</span>
                                </div>
                                <div className="flex justify-between gap-4 text-sm">
                                    <span className="text-muted-foreground">Already enrolled</span>
                                    <span className="font-semibold text-green-700 dark:text-green-400">{preview.alreadyEnrolled}</span>
                                </div>
                                <div className="flex justify-between gap-4 border-t pt-3 text-sm">
                                    <span>New enrollments</span>
                                    <span className="font-semibold text-green-700 dark:text-green-400">{preview.newEnrollments}</span>
                                </div>
                            </div>
                            <p className="mt-4 text-xs text-muted-foreground">
                                Students already enrolled will be skipped to prevent duplicate records.
                            </p>
                        </div>
                    )}

                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button
                            disabled={!preview || preview.newEnrollments === 0 || enrollMutation.isPending}
                            onClick={() => enrollMutation.mutate()}
                        >
                            {enrollMutation.isPending && <LoaderCircle className="size-4 animate-spin" />}
                            Enroll department
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
