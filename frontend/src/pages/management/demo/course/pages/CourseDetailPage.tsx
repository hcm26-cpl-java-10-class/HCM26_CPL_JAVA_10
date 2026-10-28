import { PermissionGate } from "@/components/PermissionGate";

import { courseApi, departmentApi, enrollmentApi } from "@/api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ConfirmDialog } from "@/components/ui/confirmdialog";
import { Input } from "@/components/ui/input";
import { StudentCheckboxList } from "@/pages/student/StudentCheckboxList";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CourseDetail, CourseDetailLesson, CourseDetailSection, DepartmentMember, LessonContentType } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Clock,
  Eye,
  FileText,
  GraduationCap,
  Layers,
  Link2,
  Lock,
  LoaderCircle,
  Music2,
  PlayCircle,
  Video,
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useCourseEnrollment } from "../hooks/useCourseEnrollment.ts";
import {
  LEVEL_BADGE_CLASS,
  LEVEL_LABEL,
  formatLessonDuration,
  formatTotalDuration,
  getErrorStatus,
} from "../utils/course.utils.ts";

const CONTENT_ICON: Record<LessonContentType, LucideIcon> = {
  VIDEO: Video,
  AUDIO: Music2,
  TEXT: FileText,
  DOCUMENT: FileText,
  LINK: Link2,
};

export function CourseDetailPage() {
  const { id } = useParams();
  const courseId = Number(id);
  const validId = Number.isInteger(courseId) && courseId > 0;

  const detailQuery = useQuery({
    queryKey: ["course-detail", courseId],
    queryFn: () => courseApi.getCatalogDetail(courseId),
    enabled: validId,
    retry: (failureCount, error) => getErrorStatus(error) !== 404 && failureCount < 2,
  });

  const course = detailQuery.data;
  const breadcrumbTitles: Record<string, string> = { courses: "Courses" };
  if (id && course?.name) breadcrumbTitles[id] = course.name;

  return (
    <MainLayout pathName={breadcrumbTitles}>
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <Button asChild variant="ghost" className="-ml-3">
          <Link to="/courses">
            <ArrowLeft className="size-4" /> Back to courses
          </Link>
        </Button>

        {!validId || (detailQuery.isError && getErrorStatus(detailQuery.error) === 404) ? (
          <StateCard
            title="Course not found"
            text="This course does not exist or is no longer available."
            action={
              <Button asChild>
                <Link to="/courses">Browse courses</Link>
              </Button>
            }
          />
        ) : detailQuery.isLoading ? (
          <DetailSkeleton />
        ) : detailQuery.isError || !course ? (
          <div role="alert" className="space-y-3 rounded-2xl border border-destructive/30 p-6">
            <p className="text-sm text-destructive">Could not load this course. Please try again.</p>
            <Button variant="outline" onClick={() => void detailQuery.refetch()}>
              Try again
            </Button>
          </div>
        ) : (
          <CourseDetailContent course={course} />
        )}
      </div>
    </MainLayout>
  );
}

function CourseDetailContent({ course }: { course: CourseDetail }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-6">
        <section className="overflow-hidden rounded-2xl border bg-card">
          <div className="relative h-56 bg-gradient-to-br from-blue-100 via-indigo-100 to-violet-100 sm:h-72">
            {course.thumbnailUrl ? (
              <img src={course.thumbnailUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center">
                <GraduationCap className="size-20 text-blue-900/25" />
              </div>
            )}
          </div>
          <div className="space-y-4 p-6">
            <div className="flex flex-wrap items-center gap-2">
              {(course.categoryNames?.length
                ? course.categoryNames
                : course.categoryName
                  ? [course.categoryName]
                  : []
              ).map((name) => (
                <Badge key={name} variant="outline">
                  {name}
                </Badge>
              ))}
              {course.level && (
                <Badge variant="secondary" className={LEVEL_BADGE_CLASS[course.level]}>
                  {LEVEL_LABEL[course.level]}
                </Badge>
              )}
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{course.name}</h1>
            <p className="text-sm text-muted-foreground">
              Instructor: <span className="font-medium text-foreground">{course.instructor || "—"}</span>
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Layers className="size-4" /> {course.sections.length} sections
              </span>
              <span className="inline-flex items-center gap-1.5">
                <BookOpen className="size-4" /> {course.lessonCount} lessons
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-4" /> {formatTotalDuration(course.totalDuration)}
              </span>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-6">
          <h2 className="text-lg font-semibold">About this course</h2>
          <p className="mt-2 whitespace-pre-line text-sm leading-6 text-muted-foreground">
            {course.description || "The instructor has not added a description yet."}
          </p>
        </section>

        <section className="rounded-2xl border bg-card p-6">
          <h2 className="text-lg font-semibold">Skills you will achieve</h2>
          {(() => {
            const skills =
              course.categoryNames && course.categoryNames.length > 0
                ? course.categoryNames
                : course.categoryName
                  ? [course.categoryName]
                  : [];

            return skills.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  The instructor has not added any skills yet.
                </p>
            ) : (
                <div className="mt-4 flex flex-wrap gap-3">
                  {skills.map((skill) => (
                      <span
                          key={skill}
                          className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-[0_2px_8px_rgba(15,23,42,0.08)]"
                      >
                        {skill}
                      </span>
                  ))}
                </div>
            );
          })()}
        </section>
        <Syllabus course={course} />
      </div>

      <aside className="lg:sticky lg:top-4 lg:self-start">
        <CourseActionCard course={course} />
      </aside>
    </div>
  );
}

/** Nút hành động động: Ghi danh / Tiếp tục học / Xem trước (staff). */
function CourseActionCard({ course }: { course: CourseDetail }) {
  const { canEnroll, canCancel, enrollmentsQuery, enrollmentByCourseId, enrollMutation, cancelMutation } =
    useCourseEnrollment();
  const [confirmCancel, setConfirmCancel] = useState(false);

  const enrollment = enrollmentByCourseId.get(course.id);
  // Staff (COURSE_UPDATE) xem được nội dung nhưng không ghi danh.
  const isStaffPreview = !course.enrolled && !course.isFree && course.contentUnlocked;

  let action: ReactNode;
  if (course.enrolled) {
    if (enrollment) {
      action = (
        <Button asChild size="lg" className="w-full">
          <Link to={`/enrollments/${enrollment.id}/learn`}>
            <PlayCircle className="size-5" /> Continue learning
          </Link>
        </Button>
      );
    } else if (enrollmentsQuery.isError) {
      action = (
        <Button size="lg" variant="outline" className="w-full" onClick={() => void enrollmentsQuery.refetch()}>
          Retry loading your enrollment
        </Button>
      );
    } else {
      action = (
        <Button size="lg" className="w-full" disabled>
          Loading...
        </Button>
      );
    }
  } else if (isStaffPreview) {
    action = (
      <div className="flex items-start gap-2 rounded-lg bg-blue-50 p-3 text-sm text-blue-900">
        <Eye className="mt-0.5 size-4 shrink-0" />
        <span>You are previewing this course as staff. Lesson content is visible to you.</span>
      </div>
    );
  } else if (canEnroll) {
    action = (
      <Button
        size="lg"
        className="w-full"
        disabled={enrollMutation.isPending}
        onClick={() => enrollMutation.mutate(course.id)}
      >
        {enrollMutation.isPending ? "Enrolling..." : "Enroll"}
      </Button>
    );
  } else {
    action = (
      <Button size="lg" className="w-full" disabled>
        Enrollment not available
      </Button>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border bg-card p-6 shadow-sm">
      {course.enrolled ? (
        <div className="flex items-center gap-2 text-sm font-medium text-emerald-700">
          <CheckCircle2 className="size-5" /> You are enrolled
        </div>
      ) : (
        <div>
          <p className="text-2xl font-bold">{course.isFree ? "Free" : "Enrollment required"}</p>
          <p className="text-sm text-muted-foreground">
            {course.isFree
              ? "Lesson content is available for free. Enroll to track your progress."
              : "Enroll to unlock all lesson content."}
          </p>
        </div>
      )}

      {action}

      <PermissionGate permissions={["DEPARTMENT_READ", "DEPARTMENT_UPDATE"]} requireAll>
        <DepartmentEnrollmentControl courseId={course.id} />
      </PermissionGate>

      <ul className="space-y-2 border-t pt-4 text-sm text-muted-foreground">
        <li className="flex items-center gap-2">
          <BookOpen className="size-4" /> {course.lessonCount} lessons
        </li>
        <li className="flex items-center gap-2">
          <Clock className="size-4" /> {formatTotalDuration(course.totalDuration)} of content
        </li>
        {course.level && (
          <li className="flex items-center gap-2">
            <GraduationCap className="size-4" /> {LEVEL_LABEL[course.level]} level
          </li>
        )}
      </ul>

      {course.enrolled && enrollment && canCancel && (
        <>
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-destructive hover:bg-destructive/5 hover:text-destructive"
            onClick={() => setConfirmCancel(true)}
          >
            Cancel enrollment
          </Button>
          <ConfirmDialog
            open={confirmCancel}
            title="Cancel enrollment?"
            description="You will lose access to the lesson content and your progress may be removed."
            confirmLabel="Cancel enrollment"
            cancelLabel="Keep course"
            loading={cancelMutation.isPending}
            onCancel={() => setConfirmCancel(false)}
            onConfirm={() =>
              cancelMutation.mutate(enrollment.id, { onSettled: () => setConfirmCancel(false) })
            }
          />
        </>
      )}
    </div>
  );
}

function DepartmentEnrollmentControl({ courseId }: { courseId: number }) {
  const [targetType, setTargetType] = useState<"department" | "student">("department");
  const [departmentId, setDepartmentId] = useState("");
  const [selectedStudents, setSelectedStudents] = useState<DepartmentMember[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [studentPage, setStudentPage] = useState(0);
  const queryClient = useQueryClient();

  const departmentsQuery = useQuery({
    queryKey: ["course-enrollment-departments"],
    enabled: targetType === "department",
    queryFn: async () => {
      const firstPage = await departmentApi.getPage(
        { page: 0, size: 100, sort: "name,asc" },
      );
      const remainingPages = await Promise.all(
        Array.from({ length: Math.max(0, firstPage.totalPages - 1) }, (_, index) =>
          departmentApi.getPage({ page: index + 1, size: 100, sort: "name,asc" }),
        ),
      );
      return [firstPage, ...remainingPages]
        .flatMap((page) => page.content)
        .filter((department) => department.isActive !== false && department.id !== undefined);
    },
  });

  const studentsQuery = useQuery({
    queryKey: ["course-enrollment-students", studentPage, studentSearch],
    enabled: targetType === "student",
    queryFn: () =>
      enrollmentApi.searchStudents(studentPage, studentSearch.trim()),
  });

  const previewQuery = useQuery({
    queryKey: ["course-department-enrollment-preview", courseId, departmentId],
    enabled: targetType === "department" && Boolean(departmentId),
    queryFn: () =>
      enrollmentApi.previewDepartment({
        departmentId: Number(departmentId),
        courseId,
      }),
  });

  const departmentEnrollMutation = useMutation({
    mutationFn: () =>
      enrollmentApi.enrollDepartment({
        departmentId: Number(departmentId),
        courseId,
      }),
    onSuccess: async (result) => {
      toast.success(
        `${result.newEnrollments} student${result.newEnrollments === 1 ? "" : "s"} enrolled in ${result.courseName}.`,
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["department-overview"] }),
        queryClient.invalidateQueries({ queryKey: ["course-catalog"] }),
        queryClient.invalidateQueries({ queryKey: ["course-detail"] }),
      ]);
      setDepartmentId("");
      setSelectedStudents([]);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Department enrollment failed.");
    },
  });

  const studentEnrollMutation = useMutation({
    mutationFn: async () => {
      const results = await Promise.allSettled(
        selectedStudents.map((student) =>
          enrollmentApi.enrollStudent({ studentId: student.id, courseId }),
        ),
      );
      const failed = results.filter((result) => result.status === "rejected");
      return { total: results.length, failed: failed.length };
    },
    onSuccess: async ({ total, failed }) => {
      const succeeded = total - failed;
      if (succeeded > 0) {
        toast.success(`${succeeded} student${succeeded === 1 ? "" : "s"} enrolled in this course.`);
      }
      if (failed > 0) {
        toast.error(`${failed} student${failed === 1 ? "" : "s"} could not be enrolled.`);
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["department-overview"] }),
        queryClient.invalidateQueries({ queryKey: ["course-catalog"] }),
        queryClient.invalidateQueries({ queryKey: ["course-detail"] }),
      ]);
      setSelectedStudents([]);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Student enrollment failed.");
    },
  });

  const selectedDepartment = departmentsQuery.data?.find(
    (department) => department.id === Number(departmentId),
  );
  const preview = previewQuery.data;
  const enrollmentPending =
    departmentEnrollMutation.isPending || studentEnrollMutation.isPending;

  return (
    <div className="space-y-2 border-t pt-4">
      <label htmlFor="course-enrollment-target" className="text-sm font-medium">
        Enroll a department or student
      </label>
      <Select
        value={targetType}
        onValueChange={(value) => {
          if (value !== "department" && value !== "student") return;
          setTargetType(value);
          setDepartmentId("");
          setSelectedStudents([]);
          setStudentSearch("");
          setStudentPage(0);
        }}
        disabled={enrollmentPending}
      >
        <SelectTrigger id="course-enrollment-target" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="department">Department</SelectItem>
          <SelectItem value="student">Student</SelectItem>
        </SelectContent>
      </Select>
      {targetType === "department" ? (
        departmentsQuery.isLoading ? (
          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" /> Loading departments...
          </p>
        ) : departmentsQuery.isError ? (
          <div role="alert" className="space-y-2">
            <p className="text-sm text-destructive">
              {departmentsQuery.error instanceof Error
                ? departmentsQuery.error.message
                : "Could not load departments."}
            </p>
            <Button variant="outline" size="sm" onClick={() => void departmentsQuery.refetch()}>
              Try again
            </Button>
          </div>
        ) : departmentsQuery.data?.length ? (
          <>
          <Select
            value={departmentId}
            onValueChange={(value) => {
              setDepartmentId(value);
            }}
            disabled={enrollmentPending}
          >
            <SelectTrigger id="course-enrollment-department" className="w-full">
              <SelectValue placeholder="Choose a department" />
            </SelectTrigger>
            <SelectContent>
              {departmentsQuery.data.map((department) => (
                <SelectItem key={department.id} value={String(department.id)}>
                  {department.name || department.code || `Department ${department.id}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {departmentId && previewQuery.isLoading && (
            <p role="status" className="text-xs text-muted-foreground">
              Checking department students...
            </p>
          )}
          {departmentId && previewQuery.isError && (
            <p role="alert" className="text-xs text-destructive">
              {previewQuery.error instanceof Error
                ? previewQuery.error.message
                : "Could not check department enrollment."}
            </p>
          )}
          {preview && (
            <>
              <p className="text-xs text-muted-foreground">
                {preview.newEnrollments} new enrollment{preview.newEnrollments === 1 ? "" : "s"} for{" "}
                {selectedDepartment?.name || "this department"} ({preview.studentCount} active students).
              </p>
              <Button
                size="sm"
                className="w-full"
                disabled={preview.newEnrollments === 0 || enrollmentPending}
                onClick={() => departmentEnrollMutation.mutate()}
              >
                {departmentEnrollMutation.isPending && (
                  <LoaderCircle className="size-4 animate-spin" />
                )}
                Enroll department
              </Button>
            </>
          )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No active departments available.</p>
        )
      ) : (
        <>
          <Input
            aria-label="Search students"
            placeholder="Search students"
            value={studentSearch}
            onChange={(event) => {
              setStudentSearch(event.target.value);
              setStudentPage(0);
            }}
          />
          {studentsQuery.isLoading ? (
            <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" /> Loading students...
            </p>
          ) : studentsQuery.isError ? (
            <div role="alert" className="space-y-2">
              <p className="text-xs text-destructive">
                {studentsQuery.error instanceof Error
                  ? studentsQuery.error.message
                  : "Could not load students."}
              </p>
              <Button variant="outline" size="sm" onClick={() => void studentsQuery.refetch()}>
                Try again
              </Button>
            </div>
          ) : studentsQuery.data?.content.length ? (
            <>
              <StudentCheckboxList
                students={studentsQuery.data.content}
                selected={selectedStudents}
                onChange={setSelectedStudents}
                disabled={enrollmentPending}
              />
              {studentsQuery.data.totalPages > 1 && (
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    Page {studentPage + 1} of {studentsQuery.data.totalPages}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={studentPage === 0}
                      onClick={() => {
                        setStudentPage((page) => page - 1);
                      }}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={studentPage >= studentsQuery.data.totalPages - 1}
                      onClick={() => {
                        setStudentPage((page) => page + 1);
                      }}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
              {selectedStudents.length > 0 && (
                <Button
                  size="sm"
                  className="w-full"
                  disabled={enrollmentPending}
                  onClick={() => studentEnrollMutation.mutate()}
                >
                  {studentEnrollMutation.isPending && (
                    <LoaderCircle className="size-4 animate-spin" />
                  )}
                  Enroll {selectedStudents.length} student{selectedStudents.length === 1 ? "" : "s"}
                </Button>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {studentSearch.trim()
                ? "No students match this search."
                : "No active students available."}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function Syllabus({ course }: { course: CourseDetail }) {
  const sections = [...course.sections].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));

  return (
    <section className="rounded-2xl border bg-card p-6">

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">
          Course content
        </h2>

        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted-foreground">
            {sections.length} sections · {course.lessonCount} lessons
          </p>

          <PermissionGate
              permissions={["SECTION_READ", "COURSE_UPDATE"]}
              requireAll
          >
            <Button asChild variant="outline" size="sm">
              <Link to={`/curriculum?courseId=${course.id}`}>
                <BookOpen className="size-4" />
                Manage Curriculum
              </Link>
            </Button>
          </PermissionGate>
        </div>
      </div>


      {sections.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          The syllabus for this course is not available yet.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {sections.map((section, index) => (
            <SectionItem key={section.id} section={section} index={index} defaultOpen={index === 0} />
          ))}
        </div>
      )}

      {!course.contentUnlocked && sections.length > 0 && (
        <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Lock className="size-3.5" /> Enroll in this course to unlock lesson content.
        </p>
      )}
    </section>
  );
}

function SectionItem({
  section,
  index,
  defaultOpen,
}: {
  section: CourseDetailSection;
  index: number;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const lessons = [...section.lessons].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
  const totalSeconds = lessons.reduce((sum, lesson) => sum + (lesson.duration ?? 0), 0);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="overflow-hidden rounded-xl border">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 bg-muted/40 px-4 py-3 text-left hover:bg-muted/70"
        >
          <span className="min-w-0">
            <span className="block truncate font-medium">
              Section {index + 1}: {section.title}
            </span>
            <span className="block text-xs text-muted-foreground">
              {lessons.length} lessons · {formatTotalDuration(totalSeconds)}
            </span>
          </span>
          <ChevronDown className={`size-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {lessons.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">No lessons in this section yet.</p>
        ) : (
          <ul className="divide-y">
            {lessons.map((lesson) => (
              <LessonRow key={lesson.id} lesson={lesson} />
            ))}
          </ul>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

function LessonRow({ lesson }: { lesson: CourseDetailLesson }) {
  const Icon = CONTENT_ICON[lesson.contentType] ?? FileText;
  const duration = formatLessonDuration(lesson.duration);

  return (
    <li className="flex items-center gap-3 px-4 py-2.5 text-sm">
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className={`min-w-0 flex-1 truncate ${lesson.locked ? "text-muted-foreground" : ""}`}>
        {lesson.title}
      </span>
      {duration && <span className="shrink-0 text-xs text-muted-foreground">{duration}</span>}
      {lesson.locked && <Lock className="size-3.5 shrink-0 text-muted-foreground" aria-label="Locked" />}
    </li>
  );
}

function StateCard({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed px-6 py-14 text-center">
      <GraduationCap className="mx-auto size-12 text-muted-foreground" />
      <h2 className="mt-4 text-lg font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]" role="status" aria-label="Loading course">
      <div className="space-y-6">
        <div className="h-96 animate-pulse rounded-2xl bg-muted" />
        <div className="h-32 animate-pulse rounded-2xl bg-muted" />
        <div className="h-64 animate-pulse rounded-2xl bg-muted" />
      </div>
      <div className="h-64 animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}
