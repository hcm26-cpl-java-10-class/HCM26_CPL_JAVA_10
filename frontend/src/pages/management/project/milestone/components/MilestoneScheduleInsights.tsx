import { AlertTriangle, CalendarRange, Globe2, Hourglass, PlayCircle } from "lucide-react";
import type { ReactNode } from "react";
import { formatTenantDateTime } from "../milestone.utils";
import { countWorkingDays, diffDays, isWeekend, isYmd } from "../milestone-date.utils";

interface Props {
  startDate?: string;
  /** "YYYY-MM-DDTHH:mm" in the device time zone. */
  deadlineValue?: string;
  scheduledStart: Date | null;
  deadline: Date | null;
  tenantTimeZone: string;
  tenantToday: string;
}

function dateInZone(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(instant);
}

function plural(count: number, unit: string) {
  return `${count} ${unit}${count === 1 ? "" : "s"}`;
}

function Row({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <div className="text-sm text-foreground">{children}</div>
      </div>
    </div>
  );
}

export function MilestoneScheduleInsights({ startDate, deadlineValue, scheduledStart, deadline, tenantTimeZone, tenantToday }: Props) {
  const deviceTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const hasStart = isYmd(startDate) && !!scheduledStart;
  const startsIn = hasStart ? diffDays(tenantToday, startDate) : null;
  const durationMs = hasStart && deadline ? deadline.getTime() - scheduledStart.getTime() : null;
  const deadlineTenantDate = deadline ? dateInZone(deadline, tenantTimeZone) : null;

  const warnings: string[] = [];
  if (deadlineTenantDate && isWeekend(deadlineTenantDate)) warnings.push("The deadline falls on a weekend.");
  if (deadlineValue?.slice(11, 16) === "00:00") warnings.push("A 00:00 deadline closes at the very start of that day — did you mean 23:59 the day before?");

  if (!hasStart && !deadline) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground md:col-span-2">
        Pick a start date and a deadline to see the milestone duration and timeline.
      </div>
    );
  }

  return (
    <div className="grid gap-4 rounded-xl border bg-muted/20 p-4 md:col-span-2" aria-live="polite">
      <div className="grid gap-4 sm:grid-cols-2">
        {hasStart && startsIn !== null ? (
          <Row icon={<PlayCircle className="size-4" />} label="Starts">
            {startsIn <= 0
              ? <>Today at 00:00 <span className="text-muted-foreground">— opens on the next scheduler run</span></>
              : <>In {plural(startsIn, "day")} <span className="text-muted-foreground">· {formatTenantDateTime(scheduledStart.toISOString(), tenantTimeZone)}</span></>}
          </Row>
        ) : null}
        {durationMs !== null && durationMs > 0 && deadlineTenantDate && isYmd(startDate) ? (
          <Row icon={<Hourglass className="size-4" />} label="Duration">
            {plural(Math.floor(durationMs / 86_400_000), "day")}
            {Math.floor((durationMs % 86_400_000) / 3_600_000) ? ` ${plural(Math.floor((durationMs % 86_400_000) / 3_600_000), "hour")}` : ""}
            <span className="text-muted-foreground"> · {plural(countWorkingDays(startDate, deadlineTenantDate), "working day")}</span>
          </Row>
        ) : null}
        {hasStart && deadline ? (
          <Row icon={<CalendarRange className="size-4" />} label={`Timeline (${tenantTimeZone})`}>
            <span className="tabular-nums">{formatTenantDateTime(scheduledStart.toISOString(), tenantTimeZone)} → {formatTenantDateTime(deadline.toISOString(), tenantTimeZone)}</span>
          </Row>
        ) : null}
        {deadline && deviceTimeZone !== tenantTimeZone ? (
          <Row icon={<Globe2 className="size-4" />} label={`Deadline in your time (${deviceTimeZone})`}>
            <span className="tabular-nums">{formatTenantDateTime(deadline.toISOString(), deviceTimeZone)}</span>
          </Row>
        ) : null}
      </div>
      {warnings.length ? (
        <ul className="grid gap-1.5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          {warnings.map((warning) => (
            <li key={warning} className="flex items-start gap-2"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" />{warning}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
