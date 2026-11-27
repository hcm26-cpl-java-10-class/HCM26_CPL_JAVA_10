import { useEffect, useRef, useState } from "react";
import { Play, Pause, Timer, CircleCheck } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { learningHabitsApi } from "@/api/features/learning-habits.api";
import type { CourseOption, StudySession, TimerAction } from "@/api/features/learning-habits.api";
import { CourseSelect, Field } from "./HabitForms";
import { habitError, timerDisplay } from "./habit-format";

export function HabitTimer({ account, courses, onLog, onChange, confirmCancel }: {
  account: string; courses: CourseOption[]; onLog: () => void; onChange: () => Promise<unknown>;
  confirmCancel: (action: () => Promise<void>) => void;
}) {
  const client = useQueryClient();
  const key = ["study-timer", account] as const;
  const timer = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => learningHabitsApi.active(signal),
    refetchInterval: 10000,
  });
  const active = timer.data;
  const [course, setCourse] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const startRequest = useRef<{ course: string; key: string } | null>(null);

  useEffect(() => {
    if (active?.state !== "RUNNING") return;
    const interval = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [active?.state]);

  const delta = Math.max(0, Math.floor((now - timer.dataUpdatedAt) / 1000));
  const remaining = active?.expiresAt
    ? Math.max(0, Math.floor((Date.parse(active.expiresAt) - Date.parse(active.serverNow)) / 1000)) : 0;
  const seconds = (active?.elapsedSeconds ?? 0) + (active?.state === "RUNNING" ? Math.min(delta, remaining) : 0);

  async function run(action: () => Promise<StudySession>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await client.cancelQueries({ queryKey: key });
      const result = await action();
      client.setQueryData(key, result.state === "RUNNING" || result.state === "PAUSED" ? result : null);
      setNow(Date.now());
      if (result.state === "COMPLETED") {
        setNotice("Study session saved.");
        await onChange();
      }
      if (result.state === "CANCELLED") setNotice("Timer cancelled.");
      if (result.state === "EXPIRED") setNotice("This timer expired. You can log the time you studied manually.");
    } catch (problem) {
      await Promise.all([timer.refetch(), onChange()]);
      setError(habitError(problem));
      throw problem;
    } finally {
      setBusy(false);
    }
  }

  function start() {
    if (startRequest.current?.course !== course) startRequest.current = { course, key: crypto.randomUUID() };
    const request = startRequest.current;
    void run(async () => {
      const result = await learningHabitsApi.start(request.key, course ? Number(course) : null);
      startRequest.current = null;
      return result;
    }).catch(() => undefined);
  }

  function transition(action: TimerAction) {
    if (!active) return;
    const perform = () => run(() => learningHabitsApi.transition(active, action));
    if (action === "cancel") confirmCancel(perform);
    else void perform().catch(() => undefined);
  }

  return <section className="rounded-xl border bg-card p-4 sm:p-5" aria-labelledby="study-timer-heading">
    <h3 id="study-timer-heading" className="flex items-center gap-2 font-semibold"><Timer size={18} /> Study Timer</h3>
    <div className="mt-4">
      <Field label="What are you studying?"><CourseSelect courses={courses}
        value={active ? String(active.courseId ?? "") : course}
        fallback={active?.courseName} onChange={setCourse} disabled={busy || !!active} /></Field>
    </div>
    <div className="my-6 grid justify-items-center gap-4 text-center">
      <div className={active?.state === "RUNNING"
        ? "grid size-36 content-center rounded-full border-[5px] border-primary/50 bg-primary/5"
        : "grid size-36 content-center rounded-full border-[5px] border-muted"}>
        <span role="timer" aria-label="Elapsed study time" className="text-3xl font-bold tabular-nums">{timerDisplay(seconds)}</span>
        <span className="text-xs text-muted-foreground">{active?.state === "RUNNING" ? "Studying"
          : active?.state === "PAUSED" ? "Paused" : "Ready to study"}</span>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {active ? <>
          {active.state === "RUNNING" ? <Button variant="outline" disabled={busy} onClick={() => transition("pause")}><Pause /> Pause</Button>
            : <Button variant="outline" disabled={busy} onClick={() => transition("resume")}><Play /> Resume</Button>}
          <Button disabled={busy || seconds === 0} onClick={() => transition("finish")}><CircleCheck /> Finish and save</Button>
          <Button variant="ghost" disabled={busy} onClick={() => transition("cancel")}>Cancel timer</Button>
        </> : <Button disabled={busy || timer.isPending || timer.isError} onClick={start}><Play /> Start studying</Button>}
      </div>
      <Button variant="link" onClick={onLog}>Log study time manually</Button>
    </div>
    {timer.isError && <p role="alert" className="text-sm text-destructive">
      Could not check the timer. <button className="underline" onClick={() => void timer.refetch()}>Retry</button>
    </p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
    {active?.expiresAt && <p className="text-center text-xs text-muted-foreground">
      Save before {new Date(active.expiresAt).toLocaleString()}. Unfinished timers expire.
    </p>}
  </section>;
}
