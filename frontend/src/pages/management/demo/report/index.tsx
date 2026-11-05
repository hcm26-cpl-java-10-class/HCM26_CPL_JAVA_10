import { courseReportApi } from "@/api/features/demo/course-report.api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { useAdminStudentPreview } from "@/pages/student/useAdminStudentPreview";
import type { CourseReportItem } from "@/types";
import { useQuery } from "@tanstack/react-query";
import { Activity, Award, BarChart3, BookOpen, CheckCircle2, Download, Users } from "lucide-react";
import { useMemo } from "react";
import { Navigate } from "react-router-dom";
import { CourseCatalogPage } from "@/pages/management/demo/course/components/CourseCatalogPage";

const csvCell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;

function downloadCsv(rows: CourseReportItem[]) {
  const headers = ["Course", "Instructor", "Categories", "Level", "Status", "Learners", "Average progress", "Completed learners", "Active learners", "Completion rate", "Certificates issued"];
  const lines = rows.map((row) => [row.courseName, row.instructor, row.categories?.join(", "), row.courseLevel, row.courseStatus, row.studentCount ?? 0, `${row.averageProgress ?? 0}%`, row.completedLearners ?? 0, row.activeLearners ?? 0, `${row.completionRate ?? 0}%`, row.certificatesIssued ?? 0].map(csvCell).join(","));
  const blob = new Blob([[headers.map(csvCell).join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "course-report.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export default function CourseReportPage() {
  const isAdminStudentPreview = useAdminStudentPreview();
  const { data = [] } = useQuery({
    queryKey: ["course-report"],
    queryFn: courseReportApi.getCourseEnrollmentReport,
    enabled: !isAdminStudentPreview,
  });

  const totals = useMemo(() => {
    const learners = data.reduce((sum, row) => sum + (row.studentCount ?? 0), 0);
    const completed = data.reduce((sum, row) => sum + (row.completedLearners ?? 0), 0);
    const active = data.reduce((sum, row) => sum + (row.activeLearners ?? 0), 0);
    const weightedProgress = data.reduce((sum, row) => sum + (row.averageProgress ?? 0) * (row.studentCount ?? 0), 0);
    return {
      courses: data.length,
      learners,
      completed,
      active,
      averageProgress: learners ? Math.round(weightedProgress / learners) : 0,
      completionRate: learners ? Math.round(completed * 100 / learners) : 0,
      certificates: data.reduce((sum, row) => sum + (row.certificatesIssued ?? 0), 0),
    };
  }, [data]);

  if (isAdminStudentPreview) return <Navigate to="/courses" replace />;

  const cards = [
    ["Courses", totals.courses, BookOpen],
    ["Learners", totals.learners, Users],
    ["Average progress", `${totals.averageProgress}%`, BarChart3],
    ["Completed learners", totals.completed, CheckCircle2],
    ["Active learners", totals.active, Activity],
    ["Completion rate", `${totals.completionRate}%`, BarChart3],
    ["Certificates issued", totals.certificates, Award],
  ] as const;

  return (
    <MainLayout pathName={{ "course-enrollments": "Enrollments" }}>
      <section className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-sm font-medium text-blue-600">COURSE OVERVIEW</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Enrollments</h1></div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => downloadCsv(data)} disabled={!data.length}><Download className="size-4" /> Export CSV</Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map(([label, value, Icon]) => <div key={label} className="rounded-xl border bg-card p-4 shadow-sm"><div className="flex items-center justify-between text-sm text-muted-foreground"><span>{label}</span><Icon className="size-4" /></div><div className="mt-3 text-3xl font-semibold">{value}</div></div>)}
        </div>

        <div className="rounded-xl border bg-card p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-blue-600">COURSE CATALOG</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">Courses available</h2>
            </div>
          </div>
          <CourseCatalogPage embedded />
        </div>

      </section>
    </MainLayout>
  );
}
