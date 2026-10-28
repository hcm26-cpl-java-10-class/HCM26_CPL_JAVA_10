import { enrollmentApi } from "@/api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/usePermissions";
import { formatRoleLabel } from "@/utils/rbac.utils";
import { motion } from "motion/react";
import { ArrowRight, BookOpen, Calendar, CheckCircle2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BookOpen, CalendarDays, CheckCircle2, GraduationCap, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import { EnrollmentProgressBar } from "../management/demo/progress/EnrollmentProgressBar";
import { AdminDepartmentStudentCourses } from "./AdminDepartmentStudentCourses";
import { useAdminStudentPreview } from "./useAdminStudentPreview";

const checklistItems = [
  {
    title: "Khoa hoc da dang ky",
    text: "Mo lai cac khoa hoc ban da dang ky, bao gom khoa hoc duoc them boi quan tri vien.",
  },
  {
    title: "Lich thi sinh vien",
    text: "Theo doi danh sach va thoi gian cac ky thi duoc xep lich.",
    title: "Danh sach books",
    text: "Xem thong tin sach trong he thong o che do chi doc.",
  },
];

const formatEnrollmentDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("vi-VN");
};

export default function StudentLandingPage() {
  const { user, activeRole, hasPermission } = usePermissions();

  const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
  const canReadBooks = hasPermission("BOOK_READ");
  const canReadEnrollments = hasPermission("ENROLLMENT_READ");
  const isAdminStudentPreview = useAdminStudentPreview();
  const enrollmentsQuery = useQuery({
    queryKey: ["my-enrollments"],
    queryFn: enrollmentApi.getMyCourses,
    enabled: canReadEnrollments && !isAdminStudentPreview,
  });

  return (
      <MainLayout>
        <section className="relative overflow-hidden rounded-3xl border border-sky-100 bg-gradient-to-br from-sky-50 via-cyan-50 to-emerald-50 p-6 sm:p-8">
          <div className="pointer-events-none absolute -top-16 -right-10 h-40 w-40 rounded-full bg-cyan-200/50 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-8 h-44 w-44 rounded-full bg-emerald-200/50 blur-3xl" />

          <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="relative"
              style={{ fontFamily: '"Space Grotesk", "Segoe UI", sans-serif' }}
          >
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Badge className="bg-sky-600 text-white hover:bg-sky-600">
                {formatRoleLabel(activeRole ?? "STUDENT")}
              </Badge>
              <Badge variant="secondary" className="bg-white/80 text-slate-700">
                Book list & Exams
              </Badge>
            </div>
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative"
          style={{ fontFamily: '"Space Grotesk", "Segoe UI", sans-serif' }}
        >
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Badge className="bg-sky-600 text-white hover:bg-sky-600">
              {formatRoleLabel(activeRole ?? "STUDENT")}
            </Badge>
            <Badge variant="secondary" className="bg-white/80 text-slate-700">
              Student view
            </Badge>
          </div>

            <h1 className="max-w-3xl text-3xl font-bold leading-tight text-slate-900 sm:text-4xl">
              Chao mung tro lai, {displayName}
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-700 sm:text-base">
              Thuc hien xem danh sach books va truy cap vao trang Lich thi de kiem tra cac ky thi sap toi.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              {/* Nút Xem Lịch Thi Mới */}
              <Button asChild className="bg-cyan-600 text-white hover:bg-cyan-500">
                <Link to="/student/exams">
                  <Calendar className="mr-2 size-4" />
                  Xem lịch thi
                </Link>
              </Button>

              {/* Nút Xem Books */}
              {canReadBooks ? (
                  <Button asChild className="bg-slate-900 text-white hover:bg-slate-800">
                    <Link to="/books">
                      Mo danh sach books
                      <ArrowRight className="ml-2 size-4" />
                    </Link>
                  </Button>
              ) : (
                  <Button disabled variant="outline" className="border-slate-300 bg-white/80">
                    Khong co quyen BOOK_READ
                  </Button>
              )}
            </div>
          </motion.div>
        </section>

      {isAdminStudentPreview && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
          <AdminDepartmentStudentCourses />
        </div>
      )}

      {canReadEnrollments && !isAdminStudentPreview && (
        <section className="mt-6 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">My courses</h2>
              <p className="mt-1 text-sm text-slate-600">Courses assigned or enrolled for your account.</p>
            </div>
            <Button asChild variant="outline">
              <Link to="/courses">
                Explore courses
                <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
          </div>

          {enrollmentsQuery.isLoading ? (
            <p role="status" className="rounded-xl border bg-white p-8 text-center text-sm text-muted-foreground">
              Loading your courses...
            </p>
          ) : enrollmentsQuery.isError ? (
            <div role="alert" className="space-y-3 rounded-xl border border-destructive/30 bg-white p-5">
              <p className="text-sm text-destructive">
                Could not load your courses: {enrollmentsQuery.error instanceof Error
                  ? enrollmentsQuery.error.message
                  : "Unknown error"}
              </p>
              <Button variant="outline" onClick={() => void enrollmentsQuery.refetch()}>
                Try again
              </Button>
            </div>
          ) : enrollmentsQuery.data?.length ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {enrollmentsQuery.data.map((enrollment) => (
                <article key={enrollment.id} className="overflow-hidden rounded-2xl border bg-white shadow-sm">
                  <div className="h-40 overflow-hidden bg-gradient-to-br from-blue-100 via-indigo-100 to-violet-100">
                    {enrollment.thumbnailUrl ? (
                      <img src={enrollment.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <GraduationCap className="size-16 text-blue-900/25" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-4 p-5">
                    <div>
                      <h3 className="line-clamp-2 min-h-12 text-lg font-semibold text-slate-900">
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
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed bg-white px-6 py-10 text-center">
              <GraduationCap className="mx-auto size-10 text-muted-foreground" />
              <h3 className="mt-3 font-semibold text-slate-900">No courses yet</h3>
              <p className="mt-1 text-sm text-slate-600">
                Courses assigned to you by your department will appear here.
              </p>
            </div>
          )}
        </section>
      )}

      <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        {checklistItems.map((item, index) => {
          const content = (
            <>
              <div className="inline-flex rounded-xl bg-slate-100 p-2 text-slate-700">
                <CheckCircle2 className="size-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{item.text}</p>
            </>
          );

          return (
            <motion.article
              key={item.title}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.1 + index * 0.08, ease: "easeOut" }}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              style={{ fontFamily: '"DM Sans", "Segoe UI", sans-serif' }}
            >
              {index === 0 ? (
                <Link
                  to="/enrollments"
                  aria-label="View enrolled courses"
                  className="block h-full rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {content}
                </Link>
              ) : (
                content
              )}
            </motion.article>
          );
        })}
      </section>
        <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          {checklistItems.map((item, index) => {
            return (
                <motion.article
                    key={item.title}
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, delay: 0.1 + index * 0.08, ease: "easeOut" }}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                    style={{ fontFamily: '"DM Sans", "Segoe UI", sans-serif' }}
                >
                  <div className="inline-flex rounded-xl bg-slate-100 p-2 text-slate-700">
                    <CheckCircle2 className="size-5" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-slate-900">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.text}</p>
                </motion.article>
            );
          })}
        </section>

        <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.45 }}
            className="mt-6 rounded-2xl border border-slate-200 bg-white p-5"
        >
          <div className="flex items-center gap-3 text-slate-700">
            <BookOpen className="size-5" />
            <p className="text-sm">
              Neu can chinh sua noi dung sach, vui long lien he TEACHER hoac ADMIN.
            </p>
          </div>
        </motion.section>
      </MainLayout>
  );
}