import { enrollmentApi } from "@/api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, CalendarDays, GraduationCap, UserRound } from "lucide-react";
import type { EntityConfig } from "@/types";
import { Link } from "react-router-dom";
import { CourseLearningPage } from "../progress/CourseLearningPage";
import { EnrollmentProgressBar } from "../progress/EnrollmentProgressBar";

const formatEnrollmentDate = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("vi-VN");
};

export const entityConfig: EntityConfig = {
    name: "Enrollments",
    path: "/enrollments",
    api: enrollmentApi,
    schema: {
        entityName: "enrollment",
        idField: "id",
        fields: [
            { name: "id", label: "ID", type: "number" },
            { name: "courseId", label: "Course ID", type: "number" },
            { name: "courseName", label: "Course Name", type: "text" },
            { name: "instructor", label: "Instructor", type: "text" },
            { name: "thumbnailUrl", label: "Thumbnail", type: "text" },
            { name: "enrolledAt", label: "Enrolled At", type: "text" },
        ],
    },
    actionPages: {
        detail: {
            path: "/enrollments/:id/learn",
            component: CourseLearningPage,
            requiredPermission: "LESSON_PROGRESS_READ",
        },
    },
};

export default function EnrollmentManagementPage() {
    const { data: enrollments = [], isLoading, isError, error, refetch } = useQuery({
        queryKey: ["my-enrollments"],
        queryFn: enrollmentApi.getMyCourses,
    });

    return (
        <MainLayout pathName={{ enrollments: "Enrollments" }}>
            <section className="space-y-6">
                <div>
                    <div className="flex flex-wrap items-end justify-between gap-4">
                        <div>
                            <p className="text-sm font-medium text-blue-700">YOUR LEARNING SPACE</p>
                            <h1 className="mt-1 text-3xl font-bold tracking-tight">Enrollment</h1>
                        </div>
                        <Button asChild>
                            <Link to="/courses">
                                <BookOpen className="size-4" /> Explore courses
                            </Link>
                        </Button>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Pick up where you left off and keep building your skills.
                    </p>
                </div>

                {isLoading ? (
                    <p role="status" className="rounded-xl border p-8 text-center text-sm text-muted-foreground">
                        Loading enrollments...
                    </p>
                ) : isError ? (
                    <div role="alert" className="space-y-3 rounded-lg border border-destructive/30 p-4">
                        <p className="text-sm text-destructive">
                            Could not load enrollments: {error instanceof Error ? error.message : "Unknown error"}
                        </p>
                        <Button variant="outline" onClick={() => void refetch()}>
                            Try again
                        </Button>
                    </div>
                ) : enrollments.length === 0 ? (
                    <div className="rounded-2xl border border-dashed px-6 py-14 text-center">
                        <GraduationCap className="mx-auto size-12 text-muted-foreground" />
                        <h2 className="mt-4 text-lg font-semibold">Your classroom is waiting</h2>
                        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                            Browse the course catalog and enroll in a course to see it here.
                        </p>
                        <Button asChild className="mt-5">
                            <Link to="/courses">Browse courses</Link>
                        </Button>
                    </div>
                ) : (
                    <>
                        <div className="grid gap-4 sm:grid-cols-3">
                            <div className="rounded-xl border bg-card p-5">
                                <p className="text-sm text-muted-foreground">Courses enrolled</p>
                                <p className="mt-2 text-3xl font-bold">{enrollments.length}</p>
                            </div>
                            <div className="rounded-xl border bg-card p-5">
                                <p className="text-sm text-muted-foreground">Course access</p>
                                <p className="mt-2 flex items-center gap-2 text-lg font-semibold">
                                    <BookOpen className="size-5 text-blue-700" /> Available anytime
                                </p>
                            </div>
                            <div className="rounded-xl border bg-card p-5">
                                <p className="text-sm text-muted-foreground">Discover</p>
                                <p className="mt-2 text-lg font-semibold">Explore the catalog</p>
                            </div>
                        </div>
                        <section>
                            <div className="mb-4">
                                <h2 className="text-xl font-semibold">My courses</h2>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Courses you have enrolled in.
                                </p>
                            </div>
                            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                                {enrollments.map((enrollment) => {
                                    return (
                                        <article key={enrollment.id} className="overflow-hidden rounded-2xl border bg-card shadow-sm">
                                            <div className="h-44 overflow-hidden bg-gradient-to-br from-blue-100 via-indigo-100 to-violet-100">
                                                {enrollment.thumbnailUrl ? (
                                                    <img
                                                        src={enrollment.thumbnailUrl}
                                                        alt=""
                                                        className="h-full w-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="flex h-full items-center justify-center">
                                                        <GraduationCap className="size-16 text-blue-900/25" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="space-y-4 p-5">
                                                <div>
                                                    <h3 className="line-clamp-2 min-h-12 text-lg font-semibold">
                                                        {enrollment.courseName}
                                                    </h3>
                                                    {enrollment.instructor && (
                                                        <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                                                            <UserRound className="size-4" /> {enrollment.instructor}
                                                        </p>
                                                    )}
                                                </div>
                                                {enrollment.enrolledAt && (
                                                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                                                        <CalendarDays className="size-4" />
                                                        Enrolled {formatEnrollmentDate(enrollment.enrolledAt)}
                                                    </p>
                                                )}
                                                <EnrollmentProgressBar enrollmentId={enrollment.id} />
                                                <Button asChild className="w-full">
                                                    <Link to={`/enrollments/${enrollment.id}/learn`}>
                                                        <BookOpen className="size-4" /> Continue learning
                                                    </Link>
                                                </Button>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        </section>
                    </>
                )}
            </section>
        </MainLayout>
    );
}
