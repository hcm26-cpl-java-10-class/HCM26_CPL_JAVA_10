import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  ReferenceLine,
} from "recharts";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/usePermissions";
import { computePresetRange, dashboardApi } from "./dashboard-api";
import type { PeriodPreset } from "./dashboard-api";
import { DashboardFilterBar } from "./components/DashboardFilterBar";
import { AiReportTriggerModal } from "./components/AiReportTriggerModal";
import { exportGoalsHabitsExcel, exportGoalsHabitsPdf } from "./components/DashboardExport";

const PIE_COLORS = ["#2563eb", "#16a34a", "#0ea5e9", "#f59e0b", "#64748b"];

function fmtMins(seconds: number | null | undefined): string {
  if (seconds == null) return "—";
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function GoalsHabitsReportPage() {
  const { user } = usePermissions();
  const [preset, setPreset] = useState<PeriodPreset>("LAST_30_DAYS");
  const initial = computePresetRange("LAST_30_DAYS");
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [heatmapView, setHeatmapView] = useState<"month" | "week">("month");
  const [sessionPage, setSessionPage] = useState(0);
  const [aiOpen, setAiOpen] = useState(false);

  const query = useQuery({
    queryKey: ["learning-dashboard-goals-habits", user.email, from, to],
    queryFn: ({ signal }) => dashboardApi.goalsHabits({ from, to }, signal),
  });

  const sessionsQuery = useQuery({
    queryKey: ["learning-dashboard-sessions", user.email, from, to, sessionPage],
    queryFn: ({ signal }) => dashboardApi.sessions({ from, to, page: sessionPage, size: 10 }, signal),
  });

  function handlePresetChange(next: PeriodPreset) {
    setPreset(next);
    setSessionPage(0);
    if (next !== "CUSTOM") {
      const range = computePresetRange(next);
      setFrom(range.from);
      setTo(range.to);
    }
  }

  const data = query.data;
  const study = data?.study;
  const objectives = data?.objectives;

  const kpis = [
    { label: "Recorded Study Time", value: fmtMins(study?.actualSeconds) },
    { label: "Planned Study Time", value: fmtMins(study?.plannedSeconds) },
    { label: "Goal Achievement", value: study?.achievement != null ? `${study.achievement.toFixed(1)}%` : "—" },
    { label: "Active Learning Days", value: study?.activeDays ?? "—" },
    { label: "Current Streak", value: study != null ? `${study.currentStreak}d` : "—" },
    { label: "Longest Streak", value: study != null ? `${study.longestStreak}d` : "—" },
    {
      label: "Completed Objectives",
      value: objectives ? `${objectives.completed}/${objectives.total}` : "—",
    },
  ];

  const weeklyChartData = (study?.weeks ?? []).map((w) => {
    const plannedMin = w.plannedSeconds != null ? Math.round(w.plannedSeconds / 60) : 0;
    const actualMin = Math.round(w.actualSeconds / 60);
    const pct = plannedMin > 0 ? Math.round((actualMin / plannedMin) * 1000) / 10 : 0;
    return { week: w.start, plannedMin, actualMin, achievement: pct };
  });

  const distributionData = (() => {
    const list = study?.byCourse ?? [];
    if (list.length <= 5) {
      return list.map((c, idx) => ({
        name: c.name || "General Study",
        value: Math.round(c.seconds / 60),
        color: PIE_COLORS[idx % PIE_COLORS.length],
      }));
    }
    const top = list.slice(0, 4).map((c, idx) => ({
      name: c.name || "General Study",
      value: Math.round(c.seconds / 60),
      color: PIE_COLORS[idx],
    }));
    const otherSec = list.slice(4).reduce((sum, c) => sum + c.seconds, 0);
    return [...top, { name: "Other", value: Math.round(otherSec / 60), color: PIE_COLORS[4] }];
  })();

  const objectiveData = objectives
    ? [
        { name: "Completed", value: objectives.completed, color: "#16a34a" },
        { name: "Incomplete", value: Math.max(0, objectives.total - objectives.completed), color: "#94a3b8" },
      ].filter((d) => d.value > 0)
    : [];

  const sourceData = (study?.days ?? []).map((d) => ({
    date: d.date.slice(5),
    timerMin: Math.round(Math.max(0, d.seconds - d.selfReportedSeconds) / 60),
    manualMin: Math.round(d.selfReportedSeconds / 60),
  }));

  const heatmapDays = heatmapView === "week" ? (study?.days ?? []).slice(-7) : (study?.days ?? []);

  return (
    <MainLayout pathName={{ "my-learning": "My Learning", reports: "My Reports", "goals-habits": "Goals & Habits Report" }}>
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <div className="border-b pb-4">
          <h1 className="text-2xl font-bold">Goals &amp; Habits Report</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Study time, consistency, learning goals, and personal objectives.
          </p>
        </div>

        <DashboardFilterBar
          preset={preset}
          from={from}
          to={to}
          zone={data?.zone}
          loading={query.isFetching}
          onPresetChange={handlePresetChange}
          onDateChange={(f, t) => {
            setFrom(f);
            setTo(t);
            setSessionPage(0);
          }}
          onRefresh={() => void query.refetch()}
          onExportPdf={() => data && exportGoalsHabitsPdf(data)}
          onExportExcel={() => data && exportGoalsHabitsExcel(data)}
          onGenerateAi={() => setAiOpen(true)}
        />

        {query.isError && (
          <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            Failed to load goals &amp; habits report. Please try refreshing.
          </div>
        )}

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="rounded-xl border bg-card p-3.5">
              <dt className="text-xs text-muted-foreground">{kpi.label}</dt>
              <dd className="mt-2 text-xl font-semibold tabular-nums">{kpi.value}</dd>
            </div>
          ))}
        </dl>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border bg-card p-5">
            <h2 className="text-base font-semibold">Planned vs Actual Study Time</h2>
            <p className="text-xs text-muted-foreground">
              Remaining: {fmtMins(study?.remainingSeconds)} · Achievement:{" "}
              {study?.achievement != null ? `${study.achievement.toFixed(1)}%` : "—"}
            </p>
            {weeklyChartData.length > 0 ? (
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                    <YAxis unit="m" />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="plannedMin" name="Planned (min)" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="actualMin" name="Actual (min)" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="mt-8 text-center text-sm text-muted-foreground">No weekly study data in this range.</p>
            )}
          </section>

          <section className="rounded-xl border bg-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">Learning Activity Heatmap</h2>
                <p className="text-xs text-muted-foreground">Daily study duration ({data?.zone ?? "local"})</p>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant={heatmapView === "month" ? "default" : "outline"} onClick={() => setHeatmapView("month")}>
                  Period
                </Button>
                <Button size="sm" variant={heatmapView === "week" ? "default" : "outline"} onClick={() => setHeatmapView("week")}>
                  Last 7d
                </Button>
              </div>
            </div>
            {heatmapDays.length > 0 ? (
              <div className="mt-4 grid grid-cols-7 gap-1.5">
                {heatmapDays.map((d) => {
                  const mins = Math.round(d.seconds / 60);
                  const intensity =
                    mins === 0
                      ? "bg-muted text-muted-foreground"
                      : mins < 30
                        ? "bg-emerald-200 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-200"
                        : mins < 60
                          ? "bg-emerald-400 text-emerald-950 dark:bg-emerald-800 dark:text-emerald-100"
                          : "bg-emerald-600 text-white dark:bg-emerald-600";
                  return (
                    <div
                      key={d.date}
                      title={`${d.date}: ${fmtMins(d.seconds)}`}
                      className={`flex h-9 flex-col items-center justify-center rounded text-[10px] font-medium ${intensity}`}
                    >
                      <span>{d.date.slice(8)}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mt-8 text-center text-sm text-muted-foreground">No activity recorded in this period.</p>
            )}
          </section>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border bg-card p-5">
            <h2 className="text-base font-semibold">Study Time Distribution</h2>
            <p className="text-xs text-muted-foreground">Grouped by course and General Study (minutes)</p>
            {distributionData.length > 0 ? (
              <div className="relative mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={distributionData} dataKey="value" nameKey="name" innerRadius={56} outerRadius={84} paddingAngle={2}>
                      {distributionData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pb-6">
                  <span className="text-lg font-bold">{fmtMins(study?.actualSeconds)}</span>
                  <span className="text-xs text-muted-foreground">Total</span>
                </div>
              </div>
            ) : (
              <p className="mt-8 text-center text-sm text-muted-foreground">No study sessions recorded.</p>
            )}
          </section>

          <section className="rounded-xl border bg-card p-5">
            <h2 className="text-base font-semibold">Personal Objective Completion</h2>
            <p className="text-xs text-muted-foreground">
              {objectives ? `${objectives.completed}/${objectives.total} completed · ${objectives.overdue} overdue` : "—"}
            </p>
            {objectiveData.length > 0 ? (
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={objectiveData} dataKey="value" nameKey="name" innerRadius={56} outerRadius={84} paddingAngle={2}>
                      {objectiveData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="mt-8 text-center text-sm text-muted-foreground">No personal objectives in this period.</p>
            )}
          </section>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border bg-card p-5">
            <h2 className="text-base font-semibold">Weekly Goal Achievement Trend</h2>
            <p className="text-xs text-muted-foreground">Percentage of weekly target achieved (100% reference line)</p>
            {weeklyChartData.length > 0 ? (
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weeklyChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                    <YAxis unit="%" />
                    <Tooltip />
                    <ReferenceLine y={100} stroke="#16a34a" strokeDasharray="4 4" />
                    <Line type="monotone" dataKey="achievement" name="Achievement %" stroke="#2563eb" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="mt-8 text-center text-sm text-muted-foreground">No weekly trend data available.</p>
            )}
          </section>

          <section className="rounded-xl border bg-card p-5">
            <h2 className="text-base font-semibold">Study Session Sources</h2>
            <p className="text-xs text-muted-foreground">Timer-recorded vs manually logged study time (minutes)</p>
            {sourceData.length > 0 ? (
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sourceData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis unit="m" />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="timerMin" stackId="a" name="Timer (min)" fill="#2563eb" />
                    <Bar dataKey="manualMin" stackId="a" name="Manual (min)" fill="#f59e0b" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="mt-8 text-center text-sm text-muted-foreground">No session source data available.</p>
            )}
          </section>
        </div>

        <section className="rounded-xl border bg-card p-5">
          <h2 className="text-base font-semibold">Study Session History</h2>
          <p className="text-xs text-muted-foreground">Recent recorded sessions in the selected date range</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Course / Scope</th>
                  <th className="py-2 pr-4">Activity</th>
                  <th className="py-2 pr-4">Duration</th>
                  <th className="py-2">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(sessionsQuery.data?.items ?? []).map((s) => (
                  <tr key={s.id}>
                    <td className="py-2 pr-4 whitespace-nowrap">{s.studyDate}</td>
                    <td className="py-2 pr-4">{s.courseTitle || "General Study"}</td>
                    <td className="py-2 pr-4">{s.note || "Study session"}</td>
                    <td className="py-2 pr-4 tabular-nums">{fmtMins(s.durationSeconds)}</td>
                    <td className="py-2">{s.source}</td>
                  </tr>
                ))}
                {(sessionsQuery.data?.items ?? []).length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-muted-foreground">
                      No study sessions found in this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {sessionsQuery.data && sessionsQuery.data.totalPages > 1 && (
            <div className="mt-3 flex items-center justify-end gap-2 text-xs">
              <Button size="sm" variant="outline" disabled={sessionPage === 0} onClick={() => setSessionPage((p) => p - 1)}>
                Previous
              </Button>
              <span>
                Page {sessionPage + 1} of {sessionsQuery.data.totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={sessionPage + 1 >= sessionsQuery.data.totalPages}
                onClick={() => setSessionPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </section>
      </div>

      <AiReportTriggerModal
        open={aiOpen}
        onOpenChange={setAiOpen}
        defaultTitle="Goals & Habits Report"
        from={from}
        to={to}
        sections={["STUDY", "OBJECTIVES"]}
      />
    </MainLayout>
  );
}

export default GoalsHabitsReportPage;
