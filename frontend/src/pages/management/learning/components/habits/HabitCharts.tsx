import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { learningHabitsApi } from "@/api/features/learning-habits.api";
import type { DateRange, HabitStatistics, StudyDay } from "@/api/features/learning-habits.api";
import { Field } from "./HabitForms";
import { dateLabel, duration } from "./habit-format";

export function WeekActivity({ days, threshold }: { days: StudyDay[]; threshold: number }) {
  return <div className="grid grid-cols-7 gap-1.5 text-center">
    {days.map(day => <div key={day.date} className="min-w-0">
      <p className="text-xs text-muted-foreground">{dateLabel(day.date, { weekday: "short" })}</p>
      <div aria-label={dateLabel(day.date) + ", " + duration(day.seconds) +
          (day.active ? ", active day" : ", below " + threshold + " minute threshold")}
        role="img" className={"my-1.5 grid min-h-9 place-items-center rounded-md text-xs font-medium " +
          (day.active ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" : "bg-muted text-muted-foreground")}>
        <span>{duration(day.seconds)}</span>
      </div>
    </div>)}
  </div>;
}

export function HabitCharts({ account, stats, range, setRange }: {
  account: string; stats: HabitStatistics; range: DateRange; setRange: (range: DateRange) => void;
}) {
  const history = useQuery({
    queryKey: ["learning-habits", account, "periods", range],
    queryFn: ({ signal }) => learningHabitsApi.goalPeriods(range, signal),
  });
  const [from, setFrom] = useState(stats.from);
  const [to, setTo] = useState(stats.to);
  const [rangeError, setRangeError] = useState("");
  const totalWeeks = Math.max(1, ...stats.weeks.flatMap(week => [week.actualSeconds, (week.targetMinutes ?? 0) * 60]));
  const largestCourse = stats.byCourse[0]?.seconds ?? 1;
  return <section className="space-y-5 rounded-xl border bg-card p-4 sm:p-5" aria-labelledby="habit-statistics">
    <h3 className="font-semibold" id="habit-statistics">Learning Statistics</h3>
    <form className="flex flex-wrap items-end gap-2" onSubmit={event => {
      event.preventDefault();
      if (from > to || Date.parse(to) - Date.parse(from) >= 366 * 86400000) {
        setRangeError("Choose a date range of up to 366 days.");
        return;
      }
      setRangeError(""); setRange({ from, to });
    }}>
      <Field label="From"><Input type="date" required min="1900-01-01" value={from} max={stats.today}
        onChange={event => setFrom(event.target.value)} /></Field>
      <Field label="To"><Input type="date" required min={from} value={to} max={stats.today}
        onChange={event => setTo(event.target.value)} /></Field>
      <Button variant="outline" type="submit">Apply dates</Button>
      {rangeError && <p role="alert" className="basis-full text-sm text-destructive">{rangeError}</p>}
    </form>
    <dl className="grid grid-cols-2 divide-border gap-x-4 gap-y-3 rounded-lg bg-muted/50 p-4 sm:grid-cols-4">
      {[
        ["All-time study", duration(stats.totalSeconds)], ["Today", duration(stats.todaySeconds)],
        ["This month", duration(stats.monthSeconds)], ["Selected dates", duration(stats.rangeSeconds)],
        ["Active days in range", stats.activeDays], ["Average per active day", duration(stats.averageActiveDaySeconds)],
        ["Weekly goals achieved", stats.weeklyGoalsTracked ? stats.weeklyGoalsAchieved + "/" + stats.weeklyGoalsTracked : "—"],
        ["Objectives in range", stats.completedObjectives + "/" + stats.totalObjectives],
      ].map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="mt-1 text-lg font-semibold tabular-nums">{value}</dd></div>)}
    </dl>
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-3">
        <h4 className="font-medium">Weekly study time</h4>
        <p className="text-xs text-muted-foreground">Planned and recorded study by calendar week</p>
        <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
          {stats.weeks.map(week => <div key={week.start} className="grid grid-cols-[3.75rem_minmax(0,1fr)_5.5rem] items-center gap-2 text-xs">
            <span>{dateLabel(week.start)}</span>
            <div aria-hidden="true" className="space-y-1">
              <div className="h-2 rounded bg-primary/15" style={{ width: ((week.targetMinutes ?? 0) * 6000 / totalWeeks) + "%" }} />
              <div className="h-2 rounded bg-emerald-600 dark:bg-emerald-400" style={{ width: (week.actualSeconds * 100 / totalWeeks) + "%" }} />
            </div>
            <span className="text-right tabular-nums"><span className="sr-only">Planned </span>
              {week.targetMinutes == null ? "—" : duration(week.targetMinutes * 60)} / <span className="sr-only">Recorded </span>{duration(week.actualSeconds)}</span>
          </div>)}
        </div>
        {!stats.rangeSeconds && <p className="text-sm text-muted-foreground">No study recorded in these dates.</p>}
      </div>
      <div className="space-y-3">
        <h4 className="font-medium">Study time by course</h4>
        {stats.byCourse.length ? <ul className="max-h-64 space-y-3 overflow-y-auto">
          {stats.byCourse.map(row => <li key={row.courseId ?? "general"} className="space-y-1 text-sm">
            <div className="flex justify-between gap-3"><span>{row.name}</span><span className="shrink-0 tabular-nums">{duration(row.seconds)}</span></div>
            <div aria-hidden="true" className="h-1.5 rounded bg-muted">
              <div className="h-full rounded bg-primary/70" style={{ width: (row.seconds * 100 / largestCourse) + "%" }} />
            </div>
          </li>)}
        </ul> : <p className="text-sm text-muted-foreground">Course time appears after you save a study session.</p>}
      </div>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
      <div>
        <h4 className="font-medium">Learning activity heatmap</h4>
        <p className="text-xs text-muted-foreground">View your full activity heatmap, trends, and session breakdown in Goals &amp; Habits Report.</p>
      </div>
      <Link to="/my-learning/reports/goals-habits" className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted">
        View full heatmap
      </Link>
    </div>
    <details className="border-t pt-4">
      <summary className="cursor-pointer font-medium">Target history</summary>
      {history.isPending ? <p className="mt-3 text-sm text-muted-foreground">Loading targets…</p>
        : history.isError ? <p role="alert" className="mt-3 text-sm text-destructive">Could not load target history.{" "}
          <button className="underline" onClick={() => void history.refetch()}>Retry</button></p>
        : history.data.length ? <ul className="mt-3 divide-y text-sm">
          {history.data.map(period => <li key={period.period + period.periodStart} className="flex flex-wrap justify-between gap-2 py-2">
            <span>{period.title} · {dateLabel(period.fromDate)} – {dateLabel(period.toDate)}</span>
            <span className="tabular-nums">{duration(period.actualSeconds)} / {duration(period.targetMinutes * 60)}
              {" · "}{Math.round(period.percentage)}%</span>
          </li>)}
        </ul> : <p className="mt-3 text-sm text-muted-foreground">No targets in the selected dates.</p>}
    </details>
  </section>;
}
