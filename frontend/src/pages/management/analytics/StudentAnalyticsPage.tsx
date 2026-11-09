import { useState } from "react";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import axiosInstance from "@/api/axios";

type Point = { period: string; count: number };
type Report = {
  courses: { id: number; name: string }[];
  newStudents: Point[];
  activity: Point[];
  topStudents: { rank: number; studentId: number; name: string; score: number; courseCount: number }[];
  lowProgress: { studentId: number; name: string; courseId: number; courseName: string; progress: number; lastAccessedAt: string | null }[];
  enrollmentDistribution: { label: string; count: number }[];
  completionRate: { completed: number; withoutSubmittedExam: number; percentage: number | null };
};
type Interval = "DAY" | "WEEK" | "MONTH";

function vietnamToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function BarList({ items }: { items: { label: string; count: number }[] }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">No data available.</p>;
  const max = Math.max(1, ...items.map((item) => item.count));
  return <div className="max-h-80 space-y-2 overflow-y-auto">{items.map((item) =>
    <div key={item.label} className="grid grid-cols-[7rem_1fr_3rem] items-center gap-2 text-sm">
      <span>{item.label}</span>
      <div className="h-3 rounded bg-muted"><div className="h-3 rounded bg-blue-500" style={{ width: `${item.count / max * 100}%` }} /></div>
      <span className="text-right">{item.count}</span>
    </div>)}</div>;
}

function Panel({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return <section className="rounded-xl border bg-card p-5 shadow-sm">
    <h2 className="text-lg font-semibold">{title}</h2><p className="mb-4 text-sm text-muted-foreground">{note}</p>{children}
  </section>;
}

export default function StudentAnalyticsPage() {
  const [to, setTo] = useState(vietnamToday);
  const [from, setFrom] = useState(() => {
    const today = vietnamToday();
    const date = new Date(`${today}T00:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() - 11, 1);
    return date.toISOString().slice(0, 10);
  });
  const [interval, setInterval] = useState<Interval>("MONTH");
  const [course, setCourse] = useState("");
  const validRange = !!from && !!to && from <= to;
  const query = useQuery({
    queryKey: ["student-analytics", from, to, interval, course],
    enabled: validRange,
    queryFn: async () => {
      const { data } = await axiosInstance.get<Report>("/analytics/students", {
        params: { from, to, interval, ...(course ? { courseId: Number(course) } : {}) },
      });
      return data;
    },
  });
  const data = query.data;
  return <MainLayout pathName={{ analytics: "Analytics", students: "Student Analytics" }}>
    <div className="space-y-6">
      <header><p className="text-sm font-medium text-blue-600">ANALYTICS</p>
        <h1 className="text-3xl font-bold">Student Analytics</h1>
        <p className="text-sm text-muted-foreground">Times use Vietnam time (GMT+7); weeks start on Monday.</p></header>
      <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
        <label className="text-sm">From<input className="block rounded border bg-background p-2" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="text-sm">To<input className="block rounded border bg-background p-2" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <label className="text-sm">Activity interval<select className="block rounded border bg-background p-2" value={interval} onChange={(e) => setInterval(e.target.value as Interval)}>
          <option value="DAY">Daily</option><option value="WEEK">Weekly</option><option value="MONTH">Monthly</option>
        </select></label>
        <label className="text-sm">Course<select className="block max-w-64 rounded border bg-background p-2" value={course} onChange={(e) => setCourse(e.target.value)}>
          <option value="">All accessible courses</option>{data?.courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select></label>
      </div>
      <p className="text-sm text-muted-foreground">Dates apply only to new students and activity. Other metrics show current data. Activity history starts when analytics recording is enabled.</p>
      {!validRange && <p role="alert" className="text-red-600">Choose a valid date range.</p>}
      {query.isLoading && validRange && <p>Loading analytics...</p>}
      {query.isError && <p role="alert" className="text-red-600">Unable to load analytics. Check your access and date range (maximum 731 days).</p>}
      {data && <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="New students by month" note="Account creation date; current Student role."><BarList items={data.newStudents.map((p) => ({ label: p.period.slice(0, 7), count: p.count }))} /></Panel>
        <Panel title="Active students" note="Distinct students interacting with lessons during each period. Zero means no recorded events; activity before recording began is unavailable."><BarList items={data.activity.map((p) => ({ label: p.period, count: p.count }))} /></Panel>
        <Panel title="Top 10 students" note="Average of course scores already published, out of 10; tied scores share a rank.">
          {!data.topStudents.length ? <p>No published course scores.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th>Rank</th><th>Student</th><th>Score</th><th>Courses</th></tr></thead><tbody>
            {data.topStudents.map((s) => <tr key={s.studentId} className="border-t"><td>{s.rank}</td><td>{s.name}</td><td>{s.score.toFixed(2)}</td><td>{s.courseCount}</td></tr>)}</tbody></table></div>}
        </Panel>
        <Panel title="Lowest course progress" note="Up to 10 student–course pairs; courses without active lessons are excluded.">
          {!data.lowProgress.length ? <p>No course progress data.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th>Student</th><th>Course</th><th>Progress</th><th>Last access</th></tr></thead><tbody>
            {data.lowProgress.map((p) => <tr key={`${p.studentId}-${p.courseId}`} className="border-t"><td>{p.name}</td><td>{p.courseName}</td><td>{p.progress}%</td><td>{p.lastAccessedAt?.replace("T", " ").slice(0, 16) ?? "—"}</td></tr>)}</tbody></table></div>}
        </Panel>
        <Panel title="Courses enrolled per student" note="Current active enrollments in your accessible scope."><BarList items={data.enrollmentDistribution} /></Panel>
        <Panel title="Completed course, no exam submitted" note="Student–course pairs with at least one linked active exam. Courses without exams are excluded.">
          <div className="text-3xl font-semibold">{data.completionRate.percentage == null ? "No data" : `${data.completionRate.percentage}%`}</div>
          <p className="mt-2 text-sm">{data.completionRate.withoutSubmittedExam} of {data.completionRate.completed} completed student–course pairs</p>
        </Panel>
      </div>}
    </div>
  </MainLayout>;
}
