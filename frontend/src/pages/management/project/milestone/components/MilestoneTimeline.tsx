import { cn } from "@/lib/utils";
import { formatRelativeDeadline, formatTenantDateTime } from "../milestone.utils";

interface TimelinePoint {
  key: string;
  label: string;
  at: string;
  tone: "neutral" | "primary" | "warning";
}

const TONE: Record<TimelinePoint["tone"], string> = {
  neutral: "bg-slate-400",
  primary: "bg-indigo-600 dark:bg-indigo-400",
  warning: "bg-amber-500",
};

/** Horizontal timeline of start → deadline → late window with a "now" marker. */
export function MilestoneTimeline({ start, deadline, lateUntil, timeZone, now, showOverdue }: {
  start?: string | null;
  deadline: string;
  lateUntil?: string | null;
  timeZone: string;
  now: number;
  /** Only highlight overdue state while the milestone is still being worked on. */
  showOverdue: boolean;
}) {
  const points: TimelinePoint[] = [
    ...(start ? [{ key: "start", label: "Starts", at: start, tone: "neutral" as const }] : []),
    { key: "deadline", label: "Deadline", at: deadline, tone: "primary" as const },
    ...(lateUntil ? [{ key: "late", label: "Late submissions until", at: lateUntil, tone: "warning" as const }] : []),
  ].filter((point) => !Number.isNaN(new Date(point.at).getTime()));

  const times = points.map((point) => new Date(point.at).getTime());
  const min = Math.min(...times);
  const max = Math.max(...times);
  const span = max - min;
  const position = (time: number) => (span > 0 ? ((time - min) / span) * 100 : 50);
  const deadlineTime = new Date(deadline).getTime();
  const lateTime = lateUntil ? new Date(lateUntil).getTime() : null;
  const nowPosition = Math.min(100, Math.max(0, position(now)));
  const overdue = showOverdue && now > deadlineTime;
  const inLateWindow = overdue && lateTime !== null && now <= lateTime;

  return (
    <div className="grid gap-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">Timeline</span>
        <span className={cn("text-xs", overdue ? (inLateWindow ? "font-medium text-amber-700 dark:text-amber-300" : "font-medium text-red-700 dark:text-red-300") : "text-muted-foreground")}>
          Deadline {formatRelativeDeadline(deadline)}
          {inLateWindow ? " · late window open" : overdue ? " · past due" : ""}
        </span>
      </div>

      {points.length > 1 ? (
        <div className="relative mx-2 mt-2 h-6" aria-hidden>
          <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-muted" />
          {lateTime !== null && span > 0 ? (
            <div
              className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-amber-200 dark:bg-amber-900"
              style={{ left: `${position(deadlineTime)}%`, width: `${position(lateTime) - position(deadlineTime)}%` }}
            />
          ) : null}
          {points.map((point) => (
            <span
              key={point.key}
              className={cn("absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-background", TONE[point.tone])}
              style={{ left: `${position(new Date(point.at).getTime())}%` }}
            />
          ))}
          <span className="absolute top-0 h-full -translate-x-1/2" style={{ left: `${nowPosition}%` }}>
            <span className="block h-full w-0.5 bg-foreground/70" />
            <span className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-foreground/70">
              {now < min ? "Now ←" : now > max ? "→ Now" : "Now"}
            </span>
          </span>
        </div>
      ) : null}

      <dl className={cn("grid gap-2 text-sm", points.length === 3 ? "sm:grid-cols-3" : points.length === 2 ? "sm:grid-cols-2" : "")}>
        {points.map((point) => (
          <div key={point.key} className="min-w-0">
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={cn("size-2 rounded-full", TONE[point.tone])} /> {point.label}
            </dt>
            <dd className={cn("mt-0.5", point.key === "deadline" ? "font-semibold" : "font-medium")}>{formatTenantDateTime(point.at, timeZone)}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-muted-foreground">All times in {timeZone}</p>
    </div>
  );
}
