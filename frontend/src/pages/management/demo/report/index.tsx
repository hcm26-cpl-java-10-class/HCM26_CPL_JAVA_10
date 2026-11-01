import { courseReportApi } from "@/api/features/demo/course-report.api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAdminStudentPreview } from "@/pages/student/useAdminStudentPreview";
import type { CourseReportItem } from "@/types";
import { useQuery } from "@tanstack/react-query";
import { Activity, Award, BarChart3, BookOpen, CheckCircle2, Download, Search, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";

const ALL = "ALL";
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
  const [query, setQuery] = useState("");
  const [instructor, setInstructor] = useState(ALL);
  const [category, setCategory] = useState(ALL);
  const [level, setLevel] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedCourse, setSelectedCourse] = useState<CourseReportItem | null>(null);

  const { data = [], isLoading, isError } = useQuery({
    queryKey: ["course-report"],
    queryFn: courseReportApi.getCourseEnrollmentReport,
    enabled: !isAdminStudentPreview,
  });

  const options = useMemo(() => ({
    instructors: [...new Set(data.map((row) => row.instructor).filter(Boolean) as string[])].sort(),
    categories: [...new Set(data.flatMap((row) => row.categories ?? []))].sort(),
    levels: [...new Set(data.map((row) => row.courseLevel).filter(Boolean) as string[])].sort(),
    statuses: [...new Set(data.map((row) => row.courseStatus).filter(Boolean) as string[])].sort(),
  }), [data]);

  const filteredRows = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const from = fromDate ? new Date(`${fromDate}T00:00:00`) : null;
    const to = toDate ? new Date(`${toDate}T23:59:59`) : null;
    return data.filter((row) => {
      const matchesText = !keyword || [row.courseName, row.instructor, ...(row.categories ?? []), ...(row.students ?? [])].some((value) => value?.toLowerCase().includes(keyword));
      const matchesDate = (!from && !to) || (row.learners ?? []).some((learner) => {
        if (!learner.enrolledAt) return false;
        const enrolledAt = new Date(learner.enrolledAt);
        return (!from || enrolledAt >= from) && (!to || enrolledAt <= to);
      });
      return matchesText
        && (instructor === ALL || row.instructor === instructor)
        && (category === ALL || row.categories?.includes(category))
        && (level === ALL || row.courseLevel === level)
        && (status === ALL || row.courseStatus === status)
        && matchesDate;
    });
  }, [data, query, instructor, category, level, status, fromDate, toDate]);

  const totals = useMemo(() => {
    const learners = filteredRows.reduce((sum, row) => sum + (row.studentCount ?? 0), 0);
    const completed = filteredRows.reduce((sum, row) => sum + (row.completedLearners ?? 0), 0);
    const active = filteredRows.reduce((sum, row) => sum + (row.activeLearners ?? 0), 0);
    const weightedProgress = filteredRows.reduce((sum, row) => sum + (row.averageProgress ?? 0) * (row.studentCount ?? 0), 0);
    return {
      courses: filteredRows.length,
      learners,
      completed,
      active,
      averageProgress: learners ? Math.round(weightedProgress / learners) : 0,
      completionRate: learners ? Math.round(completed * 100 / learners) : 0,
      certificates: filteredRows.reduce((sum, row) => sum + (row.certificatesIssued ?? 0), 0),
    };
  }, [filteredRows]);

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
    <MainLayout pathName={{ "course-report": "Course Report" }}>
      <section className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-sm font-medium text-blue-600">COURSE OVERVIEW</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Course Report</h1></div>
          <Button variant="outline" onClick={() => downloadCsv(filteredRows)} disabled={!filteredRows.length}><Download className="size-4" /> Export CSV</Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map(([label, value, Icon]) => <div key={label} className="rounded-xl border bg-card p-4 shadow-sm"><div className="flex items-center justify-between text-sm text-muted-foreground"><span>{label}</span><Icon className="size-4" /></div><div className="mt-3 text-3xl font-semibold">{value}</div></div>)}
        </div>

        <div className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="relative xl:col-span-2"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search courses, instructors, categories, or learners..." className="pl-9" /></div>
          <Select value={instructor} onValueChange={setInstructor}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>All instructors</SelectItem>{options.instructors.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select>
          <Select value={category} onValueChange={setCategory}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>All categories</SelectItem>{options.categories.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select>
          <Select value={level} onValueChange={setLevel}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>All levels</SelectItem>{options.levels.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select>
          <Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>All statuses</SelectItem>{options.statuses.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select>
          <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} aria-label="Enrolled from date" />
          <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} aria-label="Enrolled to date" />
        </div>

        <div className="overflow-hidden rounded-xl border bg-card"><div className="overflow-x-auto"><table className="min-w-full text-left text-sm">
          <thead className="bg-muted/60 text-muted-foreground"><tr><th className="px-4 py-3">Course</th><th className="px-4 py-3">Instructor</th><th className="px-4 py-3">Category / Level</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Average progress</th><th className="px-4 py-3">Learners</th></tr></thead>
          <tbody>{isLoading ? <tr><td colSpan={6} className="p-10 text-center text-muted-foreground">Loading report...</td></tr> : isError ? <tr><td colSpan={6} className="p-10 text-center text-destructive">Could not load the course report.</td></tr> : filteredRows.length === 0 ? <tr><td colSpan={6} className="p-10 text-center text-muted-foreground">No courses match the selected filters.</td></tr> : filteredRows.map((row) => <tr key={row.courseId} className="border-t hover:bg-muted/30">
            <td className="px-4 py-3 font-medium">{row.courseName}</td><td className="px-4 py-3">{row.instructor || "—"}</td><td className="px-4 py-3"><div>{row.categories?.join(", ") || "Uncategorized"}</div><div className="text-xs text-muted-foreground">{row.courseLevel || "No level"}</div></td><td className="px-4 py-3"><Badge variant="secondary">{row.courseStatus || "DRAFT"}</Badge></td>
            <td className="min-w-44 px-4 py-3"><div className="mb-1 flex justify-between text-xs"><span>{row.averageProgress ?? 0}%</span><span>{row.completedLearners ?? 0} completed</span></div><Progress value={row.averageProgress ?? 0} /></td>
            <td className="px-4 py-3">{(row.studentCount ?? 0) === 0 ? <span className="text-muted-foreground">No learners enrolled</span> : <Button variant="link" className="h-auto p-0" onClick={() => setSelectedCourse(row)}>{row.studentCount} learners</Button>}</td>
          </tr>)}</tbody>
        </table></div></div>
      </section>

      <Sheet open={!!selectedCourse} onOpenChange={(open) => !open && setSelectedCourse(null)}><SheetContent side="right" className="w-full overflow-y-auto p-6 sm:max-w-2xl"><SheetHeader><SheetTitle>{selectedCourse?.courseName} — learner progress</SheetTitle></SheetHeader><div className="mt-6 space-y-3">{selectedCourse?.learners?.map((learner) => <div key={learner.enrollmentId} className="rounded-xl border p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{learner.studentName || learner.studentEmail || "Student"}</p><p className="text-xs text-muted-foreground">{learner.studentEmail || "—"}</p></div><Badge variant={learner.completed ? "default" : "secondary"}>{learner.completed ? "Completed" : "Active"}</Badge></div><div className="mt-3 flex items-center gap-3"><Progress value={learner.progressPercentage} className="flex-1" /><span className="text-sm font-medium">{learner.progressPercentage}%</span></div><p className="mt-2 text-xs text-muted-foreground">Enrolled {learner.enrolledAt ? new Date(learner.enrolledAt).toLocaleDateString() : "—"}</p></div>)}</div></SheetContent></Sheet>
    </MainLayout>
  );
}
