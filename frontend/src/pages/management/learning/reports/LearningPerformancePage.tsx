import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";
import { MainLayout } from "@/components/layout/MainLayout";
import { usePermissions } from "@/hooks/usePermissions";
import { computePresetRange, dashboardApi } from "./dashboard-api";
import type { PeriodPreset } from "./dashboard-api";
import { DashboardFilterBar } from "./components/DashboardFilterBar";
import { AiReportTriggerModal } from "./components/AiReportTriggerModal";
import { exportPerformanceExcel, exportPerformancePdf } from "./components/DashboardExport";

const STATUS_COLORS = {
  COMPLETED: "#16a34a",
  IN_PROGRESS: "#2563eb",
  NOT_STARTED: "#94a3b8",
};

export function LearningPerformancePage() {
  const { user } = usePermissions();
  const [preset, setPreset] = useState<PeriodPreset>("LAST_30_DAYS");
  const initial = computePresetRange("LAST_30_DAYS");
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [courseId, setCourseId] = useState<number | undefined>(undefined);
  const [aiOpen, setAiOpen] = useState(false);

  const query = useQuery({
    queryKey: ["learning-dashboard-performance", user.email, from, to, courseId],
    queryFn: ({ signal }) => dashboardApi.performance({ from, to, courseId }, signal),
  });

  function handlePresetChange(next: PeriodPreset) {
    setPreset(next);
    if (next !== "CUSTOM") {
      const range = computePresetRange(next);
      setFrom(range.from);
      setTo(range.to);
    }
  }

  const data = query.data;
  const overview = data?.overview;
  const courses = data?.courses ?? [];
  const roadmap = data?.roadmap;
  const assessments = data?.assessments;

  const statusData = overview
    ? [
        { name: "Completed", value: overview.completed, color: STATUS_COLORS.COMPLETED },
        { name: "In Progress", value: overview.inProgress, color: STATUS_COLORS.IN_PROGRESS },
        { name: "Not Started", value: overview.notStarted, color: STATUS_COLORS.NOT_STARTED },
      ].filter((d) => d.value > 0)
    : [];

  const roadmapData = roadmap
    ? [
        { name: "Completed", value: roadmap.completedPhases, color: STATUS_COLORS.COMPLETED },
        {
          name: "Current",
          value: roadmap.phases.filter((p) => p.status === "CURRENT").length,
          color: STATUS_COLORS.IN_PROGRESS,
        },
        {
          name: "Upcoming",
          value: roadmap.phases.filter((p) => p.status === "UPCOMING").length,
          color: STATUS_COLORS.NOT_STARTED,
        },
      ].filter((d) => d.value > 0)
    : [];

  const kpis = [
    { label: "Total Enrolled Courses", value: overview?.enrolled ?? "—", tag: "Current snapshot" },
    { label: "Completed Courses", value: overview?.completed ?? "—", tag: "Current snapshot" },
    { label: "Courses In Progress", value: overview?.inProgress ?? "—", tag: "Current snapshot" },
    { label: "Courses Not Started", value: overview?.notStarted ?? "—", tag: "Current snapshot" },
    {
      label: "Average Course Progress",
      value: overview?.averageProgress != null ? `${overview.averageProgress.toFixed(1)}%` : "—",
      tag: "Current snapshot",
    },
    {
      label: "Course Completion Rate",
      value: overview?.completionRate != null ? `${overview.completionRate.toFixed(1)}%` : "—",
      tag: "Current snapshot",
    },
  ];

  return (
    <MainLayout pathName={{ "my-learning": "My Learning", reports: "My Reports", performance: "Learning Performance" }}>
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <div className="border-b pb-4">
          <h1 className="text-2xl font-bold">Learning Performance</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Course progress, learning outcomes, and roadmap completion analytics.
          </p>
        </div>

        <DashboardFilterBar
          preset={preset}
          from={from}
          to={to}
          zone={data?.zone}
          courseId={courseId}
          courses={courses.map((c) => ({ id: c.id, name: c.name }))}
          loading={query.isFetching}
          onPresetChange={handlePresetChange}
          onDateChange={(f, t) => {
            setFrom(f);
            setTo(t);
          }}
          onCourseChange={setCourseId}
          onRefresh={() => void query.refetch()}
          onExportPdf={() => data && exportPerformancePdf(data)}
          onExportExcel={() => data && exportPerformanceExcel(data)}
          onGenerateAi={() => setAiOpen(true)}
        />

        {query.isError && (
          <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            Failed to load learning performance data. Please try refreshing.
          </div>
        )}

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="rounded-xl border bg-card p-4">
              <dt className="text-xs text-muted-foreground">{kpi.label}</dt>
              <dd className="mt-2 text-2xl font-semibold tabular-nums">{kpi.value}</dd>
              <span className="mt-1 inline-block text-[11px] text-muted-foreground">{kpi.tag}</span>
            </div>
          ))}
        </dl>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border bg-card p-5">
            <h2 className="text-base font-semibold">Course Status Distribution</h2>
            <p className="text-xs text-muted-foreground">Current enrollment status breakdown</p>
            {statusData.length > 0 ? (
              <div className="relative mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={86} paddingAngle={2}>
                      {statusData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pb-6">
                  <span className="text-2xl font-bold">{overview?.enrolled ?? 0}</span>
                  <span className="text-xs text-muted-foreground">Total</span>
                </div>
              </div>
            ) : (
              <p className="mt-8 text-center text-sm text-muted-foreground">No enrolled courses found.</p>
            )}
          </section>

          <section className="rounded-xl border bg-card p-5">
            <h2 className="text-base font-semibold">Learning Progress Over Time</h2>
            <p className="text-xs text-muted-foreground">Historical course progress snapshots</p>
            <div className="mt-6 flex h-56 flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center">
              <p className="text-sm font-medium">Historical progress snapshots are unavailable</p>
              <p className="mt-1 max-w-md text-xs text-muted-foreground">
                The current system stores only the latest lesson completion state per course and does not reconstruct historical course progress.
              </p>
            </div>
          </section>
        </div>

        <section className="rounded-xl border bg-card p-5">
          <h2 className="text-base font-semibold">Individual Course Progress</h2>
          <p className="text-xs text-muted-foreground">Actual completion percentage per enrolled course</p>
          {courses.length > 0 ? (
            <div className="mt-4 grid gap-6 lg:grid-cols-2">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={courses.map((c) => ({ name: c.name, progress: c.percent ?? 0 }))} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" domain={[0, 100]} unit="%" />
                    <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="progress" fill="#2563eb" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2.5 overflow-y-auto max-h-64 pr-1">
                {courses.map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                    <div className="min-w-0">
                      <Link to={`/courses/${c.id}`} className="font-medium hover:underline truncate block">
                        {c.name}
                      </Link>
                      <span className="text-xs text-muted-foreground">
                        {c.status} {c.totalLessons != null ? `· ${c.completedLessons ?? 0}/${c.totalLessons} lessons` : ""}
                      </span>
                    </div>
                    <span className="ml-3 font-semibold tabular-nums">{c.percent != null ? `${c.percent}%` : "—"}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-6 text-center text-sm text-muted-foreground">No courses to display.</p>
          )}
        </section>

        <section className="rounded-xl border bg-card p-5">
          <h2 className="text-base font-semibold">Roadmap Performance</h2>
          <p className="text-xs text-muted-foreground">
            Phase completion is tracked separately from individual course progress.
          </p>
          {roadmap ? (
            <div className="mt-4 grid gap-6 lg:grid-cols-2">
              <div className="space-y-3">
                <div className="rounded-lg bg-muted/40 p-3 text-sm">
                  <div><strong>Career Goal:</strong> {roadmap.goal}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Revision #{roadmap.revision ?? 1} · {roadmap.completedPhases}/{roadmap.phases.length} phases completed (
                    {roadmap.completionRate != null ? `${roadmap.completionRate.toFixed(1)}%` : "—"})
                  </div>
                </div>
                <div className="space-y-2">
                  {roadmap.phases.map((p) => (
                    <div key={p.title} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                      <span>{p.title} (W{p.startWeek}–W{p.endWeek})</span>
                      <span className="text-xs font-medium text-muted-foreground">{p.status}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={roadmapData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={78} paddingAngle={2}>
                      {roadmapData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <p className="mt-6 text-center text-sm text-muted-foreground">No personal learning roadmap generated yet.</p>
          )}
        </section>

        {assessments && (
          <section className="rounded-xl border bg-card p-5">
            <h2 className="text-base font-semibold">Assessment Performance</h2>
            <p className="text-xs text-muted-foreground">Published exam results within the selected period</p>
            <div className="mt-3 flex flex-wrap gap-6 text-sm">
              <div>Attempts: <strong>{assessments.results}</strong></div>
              <div>Average Score: <strong>{assessments.averagePercent != null ? `${assessments.averagePercent}%` : "—"}</strong></div>
            </div>
            {assessments.scores.length > 0 && (
              <div className="mt-4 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={assessments.scores.map((s) => ({ title: s.title, percent: Number(s.percent) }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="title" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 100]} unit="%" />
                    <Tooltip />
                    <Line type="monotone" dataKey="percent" stroke="#2563eb" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>
        )}
      </div>

      <AiReportTriggerModal
        open={aiOpen}
        onOpenChange={setAiOpen}
        defaultTitle="Learning Performance Report"
        from={from}
        to={to}
        sections={["OVERVIEW", "COURSES", "ROADMAP", "ASSESSMENTS"]}
      />
    </MainLayout>
  );
}

export default LearningPerformancePage;
