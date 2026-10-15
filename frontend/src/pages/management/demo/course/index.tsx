import { courseApi, enrollmentApi } from "@/api";
import { userApi } from "@/api";
import { AutoCrudPage } from "@/pages/management/AutoCrudPage";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePermissions } from "@/hooks/usePermissions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, CheckCircle2, GraduationCap, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { type EntityConfig, type EntitySchema, auditableFieldsSchema, type FieldSchema } from "@/types";

const courseSchema: EntitySchema = {
  entityName: "course",
  idField: "id",
  fields: [
    {
      name: "name",
      label: "Course Name",
      type: "text",
      sortable: true,
      bold: true,
    },
    {
      name: "instructor",
      label: "Instructor",
      type: "text",
      sortable: true,
      editable: false,
    },
    {
      name: "instructorId",
      label: "Instructor (User)",
      type: "relation",
      sortable: false,
      visible: false,
      relation: {
        api: userApi,
        valueField: "id",
        labelField: "email",
      },
    },
    {
      name: "description",
      label: "Description",
      type: "textarea",
      sortable: false,
    },
    {
      name: "thumbnailUrl",
      label: "Thumbnail URL",
      type: "text",
      sortable: false,
    },
    ...(auditableFieldsSchema as FieldSchema[]),
  ],
};

export const entityConfig: EntityConfig = {
  name: "Course",
  path: "/courses",
  api: courseApi,
  schema: courseSchema,
};

export default function CourseManagementPage() {
  const { activeRole } = usePermissions();

  if (activeRole?.toUpperCase() !== "STUDENT") {
    return <AutoCrudPage entity={entityConfig} />;
  }

  return <StudentCourseCatalog />;
}

function StudentCourseCatalog() {
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();
  const coursesQuery = useQuery({
    queryKey: ["course-catalog", search],
    queryFn: () => courseApi.getPage({ page: 0, size: 200 }, search.trim() || undefined),
  });
  const enrollmentsQuery = useQuery({
    queryKey: ["my-enrollments"],
    queryFn: enrollmentApi.getMyCourses,
  });
  const enrollments = enrollmentsQuery.data ?? [];
  const enrolledCourseIds = new Set(enrollments.map((enrollment) => enrollment.courseId));
  const enrollmentByCourseId = new Map(enrollments.map((enrollment) => [enrollment.courseId, enrollment]));

  const enrollMutation = useMutation({
    mutationFn: enrollmentApi.enroll,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["my-enrollments"] }),
        queryClient.invalidateQueries({ queryKey: ["course-catalog"] }),
      ]);
      toast.success("You are enrolled in this course.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Could not enroll in this course.");
    },
  });

  const cancelMutation = useMutation({
    mutationFn: enrollmentApi.cancel,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["my-enrollments"] }),
        queryClient.invalidateQueries({ queryKey: ["course-catalog"] }),
      ]);
      toast.success("Your enrollment has been canceled.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Could not cancel this enrollment.");
    },
  });

  const courses = coursesQuery.data?.content ?? coursesQuery.data?.items ?? [];

  return (
    <MainLayout pathName={{ courses: "Courses" }}>
      <div className="mx-auto w-full max-w-7xl space-y-8">
        <section className="relative overflow-hidden rounded-3xl bg-slate-950 px-6 py-10 text-white sm:px-10 sm:py-14">
          <div className="pointer-events-none absolute -right-16 -top-24 size-80 rounded-full bg-blue-500/30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 right-1/3 size-72 rounded-full bg-violet-500/20 blur-3xl" />
          <div className="relative max-w-2xl">
            <Badge className="mb-5 border border-white/20 bg-white/10 text-blue-100 hover:bg-white/10">
              LEARN SOMETHING NEW
            </Badge>
            <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
              Build skills that move you forward.
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
              Explore courses created by your instructors and keep your learning journey in one place.
            </p>
            <div className="mt-7 flex flex-wrap gap-3 text-sm text-slate-200">
              <span className="inline-flex items-center gap-2"><BookOpen className="size-4" /> {courses.length} courses</span>
              <span className="inline-flex items-center gap-2"><CheckCircle2 className="size-4" /> {enrollments.length} enrolled</span>
            </div>
          </div>
          <GraduationCap className="absolute bottom-8 right-10 hidden size-32 text-white/10 sm:block" />
        </section>

        <section className="space-y-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Explore courses</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Find a course and enroll to add it to your learning dashboard.
              </p>
            </div>
            <div className="relative w-full sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Search courses"
                className="pl-9"
                placeholder="Search courses or instructors"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>

          {coursesQuery.isLoading || enrollmentsQuery.isLoading ? (
            <p role="status" className="rounded-2xl border p-8 text-center text-sm text-muted-foreground">
              Loading courses...
            </p>
          ) : coursesQuery.isError || enrollmentsQuery.isError ? (
            <div role="alert" className="space-y-3 rounded-2xl border border-destructive/30 p-6">
              <p className="text-sm text-destructive">
                Could not load the course catalog or your enrollments. Please check your connection and try again.
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  void coursesQuery.refetch();
                  void enrollmentsQuery.refetch();
                }}
              >
                Try again
              </Button>
            </div>
          ) : courses.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-10 text-center">
              <GraduationCap className="mx-auto size-9 text-muted-foreground" />
              <h3 className="mt-3 font-semibold">No courses found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {search ? "Try a different search term." : "Your teacher has not published any courses yet."}
              </p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {courses.map((course) => {
                const isEnrolled = course.id !== undefined && enrolledCourseIds.has(course.id);
                const enrollment = course.id !== undefined ? enrollmentByCourseId.get(course.id) : undefined;

                return (
                  <article key={course.id} className="group overflow-hidden rounded-2xl border bg-card shadow-sm transition-shadow hover:shadow-lg">
                    <div className="relative h-48 overflow-hidden bg-gradient-to-br from-blue-100 via-indigo-100 to-violet-100">
                      {course.thumbnailUrl ? (
                        <img
                          src={course.thumbnailUrl}
                          alt=""
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <GraduationCap className="size-16 text-blue-900/25" />
                        </div>
                      )}
                      <Badge className="absolute left-3 top-3 bg-white/95 text-slate-800 hover:bg-white">
                        Course
                      </Badge>
                    </div>
                    <div className="space-y-3 p-5">
                      <div>
                        <h3 className="line-clamp-2 min-h-12 text-lg font-semibold leading-6">
                          {course.name || "Untitled course"}
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {course.instructor || "Course instructor"}
                        </p>
                      </div>
                      <p className="line-clamp-3 min-h-[3.75rem] text-sm leading-5 text-muted-foreground">
                        {course.description || "Start learning with this instructor-led course."}
                      </p>
                      {isEnrolled && enrollment ? (
                        <div className="flex gap-2">
                          <Button className="flex-1" variant="secondary" disabled>
                            <CheckCircle2 className="size-4" /> Enrolled
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="border-destructive/30 text-destructive hover:bg-destructive/5"
                            disabled={cancelMutation.isPending || course.id === undefined}
                            onClick={() => {
                              if (course.id !== undefined) {
                                cancelMutation.mutate(enrollment.id);
                              }
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          className="w-full"
                          disabled={course.id === undefined || enrollMutation.isPending}
                          onClick={() => course.id !== undefined && enrollMutation.mutate(course.id)}
                        >
                          Enroll for free
                        </Button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </MainLayout>
  );
}
