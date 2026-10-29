import { courseApi } from "@/api";
import { CourseThumbnail } from "@/components/CourseThumbnail";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

export default function CourseDetailPage() {
    const { id } = useParams<{ id: string }>();
    const validId = !!id && /^[1-9]\d*$/.test(id);
    const { data: course, isLoading, isError, refetch } = useQuery({
        queryKey: ["course-detail", id],
        queryFn: () => courseApi.getById(id!),
        enabled: validId,
    });

    return (
        <MainLayout pathName={{ courses: "Courses", ...(id ? { [id]: "Course details" } : {}) }}>
            <section className="mx-auto max-w-3xl space-y-6">
                <Button asChild variant="outline"><Link to="/enrollments">Back to My Learning</Link></Button>
                {!validId ? <p role="alert">Invalid course ID.</p> : isLoading ? (
                    <p role="status">Loading course details...</p>
                ) : isError ? (
                    <div role="alert" className="space-y-3 rounded-xl border p-6">
                        <p>Could not load course details. The course may be unavailable or you may not have access.</p>
                        <Button variant="outline" onClick={() => void refetch()}>Try again</Button>
                    </div>
                ) : course ? (
                    <article className="overflow-hidden rounded-2xl border bg-card">
                        <CourseThumbnail src={course.thumbnailUrl} />
                        <div className="space-y-4 p-6">
                            <h1 className="text-3xl font-bold">{course.name}</h1>
                            <p className="whitespace-pre-wrap break-words text-muted-foreground">{course.description || "No description available."}</p>
                            <p className="text-sm">Instructor: {course.instructor || "Not provided"}</p>
                        </div>
                    </article>
                ) : <p role="alert">Course not found.</p>}
            </section>
        </MainLayout>
    );
}
