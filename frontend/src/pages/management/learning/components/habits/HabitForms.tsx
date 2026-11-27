import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { learningHabitsApi } from "@/api/features/learning-habits.api";
import type { CourseOption, Goal, GoalPeriod, HabitStatistics, Objective, StudySession } from "@/api/features/learning-habits.api";
import { dateOffset, habitError, monday } from "./habit-format";

export type HabitForm =
  | { kind: "goal"; period: GoalPeriod; record?: Goal }
  | { kind: "study"; record?: StudySession }
  | { kind: "objective"; week: string; order: number; record?: Objective };

export const fieldClass = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid gap-1.5 text-sm font-medium">{label}{children}</label>;
}

export function CourseSelect({ value, onChange, courses, fallback, disabled }: {
  value: string; onChange: (value: string) => void; courses: CourseOption[]; fallback?: string | null; disabled?: boolean;
}) {
  return <select className={fieldClass} value={value} onChange={event => onChange(event.target.value)} disabled={disabled}>
    <option value="">General Study</option>
    {value && !courses.some(course => String(course.id) === value) &&
      <option value={value}>{fallback || "Unavailable course"}</option>}
    {courses.map(course => <option key={course.id} value={course.id}>{course.name}</option>)}
  </select>;
}

export function HabitFormDialog({ form, stats, courses, roadmapHours, onClose, onSaved }: {
  form: HabitForm; stats: HabitStatistics; courses: CourseOption[]; roadmapHours?: number;
  onClose: () => void; onSaved: () => Promise<unknown>;
}) {
  const goal = form.kind === "goal" ? form.record : undefined;
  const study = form.kind === "study" ? form.record : undefined;
  const objective = form.kind === "objective" ? form.record : undefined;
  const record = form.record;
  const [period, setPeriod] = useState<GoalPeriod>(form.kind === "goal" ? form.period : "WEEKLY");
  const [week, setWeek] = useState(form.kind === "objective" ? form.week : stats.weekStart);
  const [course, setCourse] = useState(String(study?.courseId ?? objective?.courseId ?? ""));
  const [amount, setAmount] = useState(String(goal?.targetMinutes ?? (study ? Math.ceil(study.elapsedSeconds / 60) : "")));
  const [unit, setUnit] = useState("minutes");
  const [requestKey] = useState(() => form.kind === "study" && !record ? crypto.randomUUID() : undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const title = (record ? "Edit " : form.kind === "study" ? "Log " : "Add ") +
    ({ goal: "study goal", study: "study session", objective: "objective" }[form.kind]);
  const currentPeriod = period === "WEEKLY" ? stats.weekStart : stats.today.slice(0, 7) + "-01";
  const started = goal && goal.startDate <= stats.today;
  const max = form.kind === "goal" ? (period === "WEEKLY" ? 10080 : 44640)
    : Math.max(stats.maxManualMinutes, study ? Math.ceil(study.elapsedSeconds / 60) : 0);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const fields = new FormData(event.currentTarget);
    const value = (name: string) => String(fields.get(name) ?? "").trim();
    const title = value("title");
    const minutes = unit === "hours" ? Math.round(Number(amount) * 60) : Number(amount);
    const courseId = course ? Number(course) : null;
    setError("");
    setBusy(true);
    try {
      if (!title) throw new Error("Enter a title.");
      if (form.kind !== "objective" && (!Number.isInteger(minutes) || minutes < 1 || minutes > max)) {
        throw new Error("Enter a duration between 1 and " + max + " minutes.");
      }
      if (form.kind === "goal") {
        const startDate = started ? goal.startDate : value("start");
        const endDate = value("end") || null;
        if (endDate && endDate < startDate) throw new Error("End date must be on or after the start date.");
        await learningHabitsApi.saveGoal({
          title, description: value("description"), period, targetMinutes: minutes, startDate, endDate, version: goal?.version,
        }, goal?.id);
      } else if (form.kind === "study") {
        await learningHabitsApi.saveStudy({
          title, notes: value("notes"), courseId, studyDate: value("date"), durationMinutes: minutes,
          requestKey, version: study?.version,
        }, study?.id);
      } else {
        if (!week || monday(week) !== week) throw new Error("Select the Monday of the objective week.");
        await learningHabitsApi.saveObjective({
          title, description: value("description"), courseId, weekStart: week, targetDate: value("date") || null,
          displayOrder: Number(value("order")), version: objective?.version,
        }, objective?.id);
      }
      await onSaved();
      onClose();
    } catch (problem) {
      setError(habitError(problem));
    } finally {
      setBusy(false);
    }
  }

  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{form.kind === "goal" ? "Set a personal target for recorded study time."
          : form.kind === "study" ? "Manual logs and changes to timer dates or durations are self-reported."
          : "Plan a personal task for the selected week."}</DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="grid gap-4">
        <Field label="Title"><Input name="title" required maxLength={150} defaultValue={record?.title} /></Field>
        {form.kind !== "goal" && <Field label="Course (optional)">
          <CourseSelect value={course} onChange={setCourse} courses={courses} fallback={study?.courseName ?? objective?.courseName} />
        </Field>}
        {form.kind === "goal" && <Field label="Period">
          <select value={period} disabled={Boolean(goal)} onChange={event => setPeriod(event.target.value as GoalPeriod)} className={fieldClass}>
            <option value="WEEKLY">Weekly</option><option value="MONTHLY">Monthly</option>
          </select>
        </Field>}
        {form.kind !== "objective" && <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <Field label={form.kind === "goal" ? "Target duration" : "Study duration"}>
            <Input name="duration" required type="number" min={unit === "minutes" ? 1 : 0.01}
              step={unit === "minutes" ? 1 : "any"} value={amount} onChange={event => setAmount(event.target.value)} />
          </Field>
          <Field label="Unit"><select className={fieldClass} value={unit} onChange={event => {
            const selected = event.target.value;
            if (amount) setAmount(String(selected === "hours" ? Number(amount) / 60 : Math.round(Number(amount) * 60)));
            setUnit(selected);
          }}><option value="minutes">Minutes</option><option value="hours">Hours</option></select></Field>
        </div>}
        {form.kind === "goal" && period === "WEEKLY" && !!roadmapHours &&
          <Button variant="outline" type="button" className="justify-self-start" onClick={() => {
            setUnit("hours"); setAmount(String(roadmapHours));
          }}>Use Roadmap commitment ({roadmapHours}h)</Button>}
        {form.kind === "goal" && <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Start date"><Input name="start" type="date" required disabled={Boolean(started)}
            min={started ? undefined : currentPeriod} defaultValue={goal?.startDate ?? stats.today} /></Field>
          <Field label="End date (optional)"><Input name="end" type="date" min={stats.today} defaultValue={goal?.endDate ?? ""} /></Field>
        </div>}
        {form.kind === "study" && <Field label="Study date"><Input name="date" type="date" required min="1900-01-01"
          max={stats.today} defaultValue={study?.studyDate ?? stats.today} /></Field>}
        {form.kind === "objective" && <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Week starting Monday"><Input name="week" type="date" required value={week}
              onChange={event => setWeek(event.target.value)} /></Field>
            <Field label="Target date (optional)"><Input name="date" type="date" min={week || undefined}
              max={week ? dateOffset(week, 6) : undefined} defaultValue={objective?.targetDate ?? ""} /></Field>
          </div>
          <Field label="Display order"><Input name="order" type="number" required min={0} max={9999}
            defaultValue={objective?.displayOrder ?? form.order} /></Field>
        </>}
        <Field label={form.kind === "study" ? "Notes (optional)" : "Description (optional)"}>
          <textarea name={form.kind === "study" ? "notes" : "description"} className={fieldClass} rows={3}
            maxLength={2000} defaultValue={study?.notes ?? goal?.description ?? objective?.description ?? ""} />
        </Field>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
