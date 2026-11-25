import { useState } from "react";
import { BookOpen, Check, ChevronLeft, ChevronRight, Flame, ListChecks, Plus, Target } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { learningHabitsApi } from "@/api/features/learning-habits.api";
import type { CourseOption, DateRange, Goal, GoalPeriod, StudySource, TargetProgress } from "@/api/features/learning-habits.api";
import { Field, fieldClass, HabitFormDialog } from "./HabitForms";
import type { HabitForm } from "./HabitForms";
import { HabitTimer } from "./HabitTimer";
import { HabitCharts, WeekActivity } from "./HabitCharts";
import { dateLabel, duration, habitError, monday } from "./habit-format";

const emptyCourses: CourseOption[] = [];
type Confirmation = { title: string; description: string; action: () => Promise<unknown>; success: string };

function Meter({ percent, label, green }: { percent: number; label: string; green?: boolean }) {
  const capped = Math.min(100, Math.max(0, percent));
  return <div role="progressbar" aria-label={label} aria-valuenow={capped} aria-valuetext={Math.round(percent) + "%"}
    className="h-2 overflow-hidden rounded-full bg-muted">
    <div className={"h-full rounded-full " + (green ? "bg-emerald-600 dark:bg-emerald-400" : "bg-primary")}
      style={{ width: capped + "%" }} />
  </div>;
}

function GoalCard({ period, goal, progress, edit, archive }: {
  period: GoalPeriod; goal?: Goal; progress: TargetProgress | null;
  edit: () => void; archive: (goal: Goal) => void;
}) {
  const label = period === "WEEKLY" ? "Weekly Study Goal" : "Monthly Study Goal";
  return <section className="rounded-xl border bg-card p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="font-semibold">{label}</h3>
      <div className="flex flex-wrap gap-1">
        {goal && <Button size="sm" variant="ghost" onClick={() => archive(goal)}>Archive</Button>}
        <Button size="sm" variant={goal ? "outline" : "default"} onClick={edit}>{goal ? "Edit goal" : "Set goal"}</Button>
      </div>
    </div>
    {progress ? <div className="mt-3 space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-1">
        <p className="text-sm text-muted-foreground">{progress.title}{goal?.id !== progress.goalId ? " · Past target" : ""}</p>
        <p className="text-xs text-muted-foreground">{dateLabel(progress.fromDate)} – {dateLabel(progress.toDate)}</p>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-1">
        <p className="text-2xl font-semibold tabular-nums">{Math.round(progress.percentage)}%</p>
        <p className="text-sm text-muted-foreground tabular-nums">{duration(progress.actualSeconds)} / {duration(progress.targetMinutes * 60)}</p>
      </div>
      <Meter label={label} percent={progress.percentage} />
      <p className="text-sm text-muted-foreground">{progress.remainingSeconds > 0
        ? duration(progress.remainingSeconds) + " remaining" : "Target reached"}</p>
    </div> : goal ? <p className="mt-3 text-sm text-muted-foreground">
      {goal.title} · {duration(goal.targetMinutes * 60)} · Starts {dateLabel(goal.startDate)}
    </p> : <p className="mt-3 text-sm text-muted-foreground">Set a target to track your progress here.</p>}
  </section>;
}

export function GoalsHabitsPanel({ account, roadmapHours }: { account: string; roadmapHours?: number }) {
  const client = useQueryClient();
  const key = ["learning-habits", account] as const;
  const [range, setRange] = useState<DateRange>({});
  const [week, setWeek] = useState<string>();
  const [status, setStatus] = useState("all");
  const [source, setSource] = useState<StudySource>();
  const [page, setPage] = useState(0);
  const [form, setForm] = useState<HabitForm | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const statistics = useQuery({
    queryKey: [...key, "statistics", range],
    queryFn: ({ signal }) => learningHabitsApi.statistics(range, signal),
    placeholderData: previous => previous,
    refetchInterval: 60_000,
  });
  const goals = useQuery({ queryKey: [...key, "goals"], queryFn: ({ signal }) => learningHabitsApi.goals(signal) });
  const courses = useQuery({ queryKey: [...key, "courses"], queryFn: ({ signal }) => learningHabitsApi.courses(signal) });
  const history = useQuery({
    queryKey: [...key, "history", page, source],
    queryFn: ({ signal }) => learningHabitsApi.history({ page, source, size: 8 }, signal),
  });
  const objectives = useQuery({
    queryKey: [...key, "objectives", week ?? statistics.data?.weekStart],
    queryFn: ({ signal }) => learningHabitsApi.objectives({ week: week ?? statistics.data?.weekStart }, signal),
    enabled: Boolean(week ?? statistics.data?.weekStart),
  });
  const refresh = () => client.invalidateQueries({ queryKey: key });

  async function change(action: () => Promise<unknown>, success: string) {
    if (pending) return;
    setPending(true);
    setError("");
    setNotice("");
    try {
      await action();
      await refresh();
      setConfirmation(null);
      setNotice(success);
    } catch (problem) {
      setError(habitError(problem));
      await refresh();
    } finally {
      setPending(false);
    }
  }

  function confirm(item: Confirmation) {
    setError("");
    setConfirmation(item);
  }

  const stats = statistics.data;
  if (!stats) return <section className="rounded-xl border bg-card p-5 text-sm" aria-busy={statistics.isPending}>
    {statistics.isPending ? <p role="status">Loading Goals &amp; Habits…</p> : <p role="alert">
      Could not load Goals &amp; Habits. <button className="underline" onClick={() => void statistics.refetch()}>Retry</button>
    </p>}
  </section>;

  const shownWeek = week ?? stats.weekStart;
  const courseOptions = courses.data ?? emptyCourses;
  const weeklyTotal = stats.weeklyTotalObjectives;
  const weeklyDone = stats.weeklyCompletedObjectives;
  const shownObjectives = objectives.data?.filter(row => status === "all" || (status === "done") === !!row.completedAt);
  const selectedTotal = objectives.data?.length ?? 0;
  const selectedDone = objectives.data?.filter(row => row.completedAt).length ?? 0;

  return <div className="space-y-4">
    <header className="flex items-start gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Target size={21} /></span>
      <div>
        <h2 className="text-xl font-semibold">My Learning Goals</h2>
        <p className="text-sm text-muted-foreground">Set study targets, record sessions, and build a consistent routine.</p>
      </div>
    </header>
    {error && !confirmation && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
    {statistics.isError && <p role="alert" className="text-sm text-destructive">Could not refresh statistics.{" "}
      <button className="underline" onClick={() => void statistics.refetch()}>Retry</button></p>}
    <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      {[
        { Icon: Target, label: "Study this week", value: duration(stats.weekSeconds),
          detail: stats.weeklyGoal ? "Target " + duration(stats.weeklyGoal.targetMinutes * 60) : "No weekly target" },
        { Icon: Flame, label: "Current streak", value: stats.currentStreak + (stats.currentStreak === 1 ? " day" : " days"),
          detail: "Best " + stats.longestStreak + (stats.longestStreak === 1 ? " day" : " days") },
        { Icon: ListChecks, label: "Weekly objectives", value: weeklyDone + "/" + weeklyTotal, detail: "Completed objectives" },
      ].map(({ Icon, label, value, detail }) => <div key={label}
        className="grid grid-cols-[auto_1fr] gap-x-2 rounded-xl border bg-card p-4">
        <Icon size={16} className="mt-0.5 text-muted-foreground" />
        <dt className="text-sm text-muted-foreground">{label}</dt>
        <dd className="col-start-2 mt-0.5 text-xl font-semibold tabular-nums">{value}</dd>
        <dd className="col-start-2 text-xs text-muted-foreground">{detail}</dd>
      </div>)}
    </dl>
    {goals.isPending ? <p role="status" className="text-sm text-muted-foreground">Loading goals…</p>
      : goals.isError ? <p role="alert" className="text-sm text-destructive">Could not load goals.{" "}
        <button className="underline" onClick={() => void goals.refetch()}>Retry</button></p>
      : <div className="grid gap-3 lg:grid-cols-2">
        {(["WEEKLY", "MONTHLY"] as const).map(period => {
          const goal = goals.data.find(row => row.period === period && ["ACTIVE", "SCHEDULED"].includes(row.status));
          return <GoalCard key={period} period={period} goal={goal}
            progress={period === "WEEKLY" ? stats.weeklyGoal : stats.monthlyGoal}
            edit={() => setForm({ kind: "goal", period, record: goal })}
            archive={record => confirm({ title: "Archive this goal?", description: "Its target stays in your learning history.",
              action: () => learningHabitsApi.archiveGoal(record), success: "Goal archived." })} />;
        })}
      </div>}
    {courses.isError && <p role="alert" className="text-sm text-destructive">Could not load enrolled courses.{" "}
      <button className="underline" onClick={() => void courses.refetch()}>Retry</button></p>}
    <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
      <HabitTimer account={account} courses={courseOptions} onLog={() => setForm({ kind: "study" })}
        onChange={refresh} confirmCancel={action => confirm({ title: "Cancel this timer?",
          description: "Time from this unfinished session will be discarded.", action, success: "Timer cancelled." })} />
      <div className="space-y-3">
        <section className="space-y-3 rounded-xl border bg-card p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold">Learning Activity</h3>
            <span className="text-xs text-muted-foreground">This week</span>
          </div>
          <WeekActivity days={stats.currentWeek} threshold={stats.activeDayMinutes} />
          <p className="border-t pt-3 text-xs text-muted-foreground">
            Study at least {stats.activeDayMinutes} minutes in a day to count toward your streak.
          </p>
        </section>
        <section className="space-y-3 rounded-xl border bg-card p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">Study Session History</h3>
            <label className="text-xs text-muted-foreground"><span className="sr-only">Session source</span>
              <select className={fieldClass} value={source ?? ""} onChange={event => {
                setSource(event.target.value as StudySource || undefined); setPage(0);
              }}><option value="">All sources</option><option value="TIMER">Timer</option><option value="MANUAL">Manual</option></select>
            </label>
          </div>
          {history.isPending ? <p role="status" className="text-sm text-muted-foreground">Loading sessions…</p>
            : history.isError ? <p role="alert" className="text-sm text-destructive">Could not load sessions.{" "}
              <button className="underline" onClick={() => void history.refetch()}>Retry</button></p>
            : history.data.items.length ? <ul className="divide-y">
              {history.data.items.map(study => <li key={study.id}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2 py-2">
                <span className="grid size-8 place-items-center rounded-lg bg-muted text-muted-foreground"><BookOpen size={15} /></span>
                <div className="min-w-0">
                  <p className="break-words text-sm font-medium">{study.title}</p>
                  <p className="break-words text-xs text-muted-foreground">
                    {dateLabel(study.studyDate, { dateStyle: "medium" })} · {study.courseName ?? "General Study"} ·
                    {" "}{study.source === "MANUAL" ? "Manual · Self-reported" : study.selfReported ? "Timer · Self-reported correction" : "Timer"}
                  </p>
                  {study.notes && <p className="mt-1 whitespace-pre-wrap break-words text-xs text-muted-foreground">{study.notes}</p>}
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setForm({ kind: "study", record: study })}>Edit</Button>
                    <Button size="sm" variant="ghost" onClick={() => confirm({
                      title: "Delete this study record?", description: "Your goals and statistics will update when the record is removed.",
                      action: async () => {
                        await learningHabitsApi.deleteStudy(study);
                        if (history.data.items.length === 1 && page > 0) setPage(page - 1);
                      }, success: "Study record deleted.",
                    })}>Delete</Button>
                  </div>
                </div>
                <p className="text-sm font-medium tabular-nums">{duration(study.elapsedSeconds)}</p>
              </li>)}
            </ul> : <p className="text-sm text-muted-foreground">No saved sessions for this source.</p>}
          {(page > 0 || history.data?.hasMore) && <div className="flex items-center justify-between">
            <Button size="icon-sm" variant="ghost" aria-label="Previous session page" disabled={!page} onClick={() => setPage(page - 1)}><ChevronLeft /></Button>
            <span className="text-xs text-muted-foreground">Page {page + 1}</span>
            <Button size="icon-sm" variant="ghost" aria-label="Next session page" disabled={!history.data?.hasMore} onClick={() => setPage(page + 1)}><ChevronRight /></Button>
          </div>}
          <p className="border-t pt-2 text-xs text-muted-foreground">Personal study records are separate from official LMS progress.</p>
        </section>
      </div>
    </div>
    <section className="space-y-3 rounded-xl border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Weekly Objectives</h3>
        <Button size="sm" variant="outline" disabled={!objectives.data} onClick={() => {
          const order = Math.min(9999, Math.max(0, ...(objectives.data ?? []).map(row => row.displayOrder)) + 1);
          setForm({ kind: "objective", week: shownWeek, order });
        }}><Plus /> Add objective</Button>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Week of"><Input type="date" value={shownWeek} min="1900-01-01"
          onChange={event => setWeek(event.target.value ? monday(event.target.value) : undefined)} /></Field>
        <Field label="Status"><select className={fieldClass} value={status} onChange={event => setStatus(event.target.value)}>
          <option value="all">All objectives</option><option value="open">Open</option><option value="done">Completed</option>
        </select></Field>
      </div>
      {objectives.isPending ? <p role="status" className="text-sm text-muted-foreground">Loading objectives…</p>
        : objectives.isError ? <p role="alert" className="text-sm text-destructive">Could not load objectives.{" "}
          <button className="underline" onClick={() => void objectives.refetch()}>Retry</button></p>
        : shownObjectives?.length ? <ul className="divide-y">
          {shownObjectives.map(objective => <li key={objective.id} className="flex flex-wrap items-start justify-between gap-2 py-2">
            <label className="flex min-w-0 flex-1 items-start gap-2 text-sm">
              <input type="checkbox" checked={!!objective.completedAt} disabled={pending}
                className="mt-0.5 size-4 shrink-0 accent-primary"
                onChange={event => {
                  const checked = event.target.checked;
                  void change(() => learningHabitsApi.objectiveStatus(objective, checked),
                    checked ? "Objective completed." : "Objective reopened.");
                }} />
              <span className="min-w-0 break-words">
                <span className={objective.completedAt ? "text-muted-foreground line-through" : "font-medium"}>{objective.title}</span>
                {(objective.targetDate || objective.courseName) && <span className="block text-xs text-muted-foreground">
                  {[objective.targetDate && dateLabel(objective.targetDate), objective.courseName].filter(Boolean).join(" · ")}
                </span>}
                {objective.description && <span className="block whitespace-pre-wrap text-xs text-muted-foreground">{objective.description}</span>}
              </span>
            </label>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => setForm({ kind: "objective", week: objective.weekStart,
                order: objective.displayOrder, record: objective })}>Edit</Button>
              <Button size="sm" variant="ghost" onClick={() => confirm({ title: "Delete this objective?",
                description: "It will be removed from your weekly checklist.", action: () => learningHabitsApi.deleteObjective(objective),
                success: "Objective deleted." })}>Delete</Button>
            </div>
          </li>)}
        </ul> : <p className="text-sm text-muted-foreground">No objectives match this week and status.</p>}
      {objectives.data && <>
        <Meter label="Selected week's objective completion" percent={selectedTotal ? 100 * selectedDone / selectedTotal : 0} green />
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Check size={14} /> {selectedDone} of {selectedTotal} objectives completed
        </p>
      </>}
    </section>
    <HabitCharts account={account} stats={stats} range={range} setRange={setRange} />
    {form && <HabitFormDialog form={form} stats={stats} courses={courseOptions} roadmapHours={roadmapHours}
      onClose={() => setForm(null)} onSaved={async () => {
        await refresh(); setNotice("Changes saved."); setError("");
      }} />}
    {confirmation && <Dialog open onOpenChange={open => { if (!open && !pending) setConfirmation(null); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{confirmation.title}</DialogTitle>
          <DialogDescription>{confirmation.description}</DialogDescription></DialogHeader>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={() => setConfirmation(null)}>Keep it</Button>
          <Button variant="destructive" disabled={pending} onClick={() => void change(confirmation.action, confirmation.success)}>
            {pending ? "Working…" : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>}
  </div>;
}
