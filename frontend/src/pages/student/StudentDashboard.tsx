import { getStudentExams, type Exam } from "@/api/exam.api";
import { enrollmentApi } from "@/api/features/demo/enrollment.api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/usePermissions";
import type { Enrollment } from "@/types";
import { formatRoleLabel } from "@/utils/rbac.utils";
import { ArrowRight, BookOpen, CalendarClock, ClipboardList, Clock, GraduationCap } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

/** Each block of the page loads on its own, so one slow or refused request never empties the page. */
type Loaded<T> = { state: "loading" } | { state: "error" } | { state: "ready"; data: T };

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "";

const Block = ({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) => (
  <section className="rounded-2xl border bg-card p-5 text-card-foreground shadow-sm">
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {action}
    </div>
    {children}
  </section>
);

const Empty = ({ children }: { children: ReactNode }) => (
  <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{children}</p>
);

const StatCard = ({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  hint?: string;
}) => (
  <div className="rounded-2xl border bg-card p-5 text-card-foreground shadow-sm">
    <div className="flex items-center justify-between">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <span className="text-muted-foreground">{icon}</span>
    </div>
    <p className="mt-2 text-3xl font-bold">{value}</p>
    {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
  </div>
);

/** The student's home page: what they can take, what they study and where to go next. */
export default function StudentDashboard() {
  const { user, activeRole, hasPermission } = usePermissions();
  const canReadExams = hasPermission("EXAM_READ");
  const canReadBooks = hasPermission("BOOK_READ");

  const [exams, setExams] = useState<Loaded<{ items: Exam[]; total: number }>>({ state: "loading" });
  const [courses, setCourses] = useState<Loaded<Enrollment[]>>({ state: "loading" });

  useEffect(() => {
    let cancelled = false;

    if (canReadExams) {
      getStudentExams(0, 5)
        .then((page) => {
          if (!cancelled) {
            setExams({ state: "ready", data: { items: page.content ?? [], total: page.totalElements ?? 0 } });
          }
        })
        .catch(() => !cancelled && setExams({ state: "error" }));
    }

    enrollmentApi
      .getMyCourses()
      .then((list) => !cancelled && setCourses({ state: "ready", data: list ?? [] }))
      .catch(() => !cancelled && setCourses({ state: "error" }));

    return () => {
      cancelled = true;
    };
  }, [canReadExams]);

  const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const examCount = exams.state === "ready" ? exams.data.total : null;
  const courseCount = courses.state === "ready" ? courses.data.length : null;
  const shownMinutes = exams.state === "ready" ? exams.data.items.reduce((sum, e) => sum + (e.durationMinutes ?? 0), 0) : null;

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Greeting */}
        <section className="rounded-3xl border border-sky-100 bg-gradient-to-br from-sky-50 via-cyan-50 to-emerald-50 p-6 text-slate-900 sm:p-8">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge className="bg-sky-600 text-white hover:bg-sky-600">{formatRoleLabel(activeRole ?? "STUDENT")}</Badge>
            <span className="text-sm text-slate-600">{today}</span>
          </div>
          <h1 className="text-3xl font-bold sm:text-4xl">Welcome back, {displayName}</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-700 sm:text-base">
            Here is what is waiting for you: your exams, your courses and a few shortcuts.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            {canReadExams && (
              <Button asChild className="bg-cyan-600 text-white hover:bg-cyan-500">
                <Link to="/student/exams">
                  <CalendarClock className="mr-2 size-4" />
                  View my exams
                </Link>
              </Button>
            )}
            {canReadBooks && (
              <Button asChild variant="outline" className="border-slate-300 bg-white/80">
                <Link to="/books">
                  <BookOpen className="mr-2 size-4" />
                  Browse books
                </Link>
              </Button>
            )}
          </div>
        </section>

        {/* Numbers at a glance */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {canReadExams && (
            <StatCard
              icon={<ClipboardList className="size-5" />}
              label="Exams available"
              value={exams.state === "error" ? "-" : (examCount ?? "...")}
              hint="Exams you can take"
            />
          )}
          {canReadExams && (
            <StatCard
              icon={<Clock className="size-5" />}
              label="Time for the next exams"
              value={shownMinutes === null ? "..." : `${shownMinutes} min`}
              hint="Total duration of the exams listed below"
            />
          )}
          <StatCard
            icon={<GraduationCap className="size-5" />}
            label="Courses enrolled"
            value={courses.state === "error" ? "-" : (courseCount ?? "...")}
            hint="Courses you are studying"
          />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Exams */}
          {canReadExams && (
            <Block
              title="Your exams"
              action={
                <Button asChild variant="ghost" size="sm">
                  <Link to="/student/exams">
                    View all
                    <ArrowRight className="ml-1 size-4" />
                  </Link>
                </Button>
              }
            >
              {exams.state === "loading" && <p className="text-sm text-muted-foreground">Loading exams...</p>}
              {exams.state === "error" && <Empty>The exams could not be loaded. Please try again later.</Empty>}
              {exams.state === "ready" &&
                (exams.data.items.length === 0 ? (
                  <Empty>No exam is available for you right now.</Empty>
                ) : (
                  <ul className="divide-y">
                    {exams.data.items.map((exam) => (
                      <li key={exam.id} className="flex items-center justify-between gap-3 py-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{exam.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {exam.durationMinutes} min
                            {exam.totalPoints != null ? ` · ${exam.totalPoints} points` : ""}
                          </p>
                        </div>
                        <Badge variant="secondary" className="shrink-0">
                          Available
                        </Badge>
                      </li>
                    ))}
                  </ul>
                ))}
            </Block>
          )}

          {/* Courses */}
          <Block title="My courses">
            {courses.state === "loading" && <p className="text-sm text-muted-foreground">Loading courses...</p>}
            {courses.state === "error" && <Empty>Your courses are not available right now.</Empty>}
            {courses.state === "ready" &&
              (courses.data.length === 0 ? (
                <Empty>You are not enrolled in any course yet.</Empty>
              ) : (
                <ul className="divide-y">
                  {courses.data.slice(0, 5).map((course) => (
                    <li key={course.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{course.courseName}</p>
                        <p className="text-xs text-muted-foreground">
                          {course.instructor ? `Instructor: ${course.instructor}` : "No instructor listed"}
                        </p>
                      </div>
                      {course.enrolledAt && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          Enrolled {formatDate(course.enrolledAt)}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              ))}
          </Block>
        </div>
      </div>
    </MainLayout>
  );
}
