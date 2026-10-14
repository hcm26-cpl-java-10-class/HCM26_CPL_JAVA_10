import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { StudySession } from "@/types/features/schedule";
import {
  WEEKDAY_LABELS,
  formatSessionTime,
  getMonthGrid,
  getSessionsForDay,
  isToday,
} from "@/utils/schedule.utils";
import dayjs from "dayjs";
import { SessionChip } from "./SessionChip";

interface MonthViewProps {
  anchor: dayjs.Dayjs;
  sessions: StudySession[];
  onSessionClick: (session: StudySession) => void;
}

const MAX_VISIBLE_EVENTS = 3;

export function MonthView({ anchor, sessions, onSessionClick }: MonthViewProps) {
  const year = anchor.year();
  const month = anchor.month();
  const cells = getMonthGrid(year, month);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      {/* Weekday header */}
      <div className="sticky top-0 z-10 grid grid-cols-7 border-b border-border bg-background">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="px-2 py-2 text-right text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-7">
        {cells.map((day) => {
          const daySessions = getSessionsForDay(sessions, day);
          const visibleSessions = daySessions.slice(0, MAX_VISIBLE_EVENTS);
          const hiddenCount = daySessions.length - visibleSessions.length;
          const inCurrentMonth = day.month() === month;
          const today = isToday(day);

          return (
            <div
              key={day.format("YYYY-MM-DD")}
              className={cn(
                "group/day flex min-h-28 flex-col gap-0.5 border-b border-r border-border p-1.5",
                !inCurrentMonth && "bg-muted/40",
                day.day() === 0 && "border-r-0",
              )}
            >
              <div className="flex justify-end">
                <span
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full text-xs",
                    today
                      ? "bg-primary font-bold text-primary-foreground"
                      : cn("font-medium", !inCurrentMonth ? "text-muted-foreground/50" : "text-foreground"),
                  )}
                >
                  {day.date()}
                </span>
              </div>

              <div className="flex min-h-0 flex-col gap-0.5 overflow-hidden">
                {visibleSessions.map((session) => (
                  <SessionChip key={session.id} session={session} onClick={() => onSessionClick(session)} />
                ))}

                {hiddenCount > 0 && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="mt-0.5 w-fit rounded-[4px] px-1 text-left text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      >
                        {hiddenCount} more
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-64 p-2">
                      <p className="px-2 pb-1 pt-1 text-xs font-medium text-muted-foreground">
                        {day.format("dddd, MMM D")}
                      </p>
                      <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
                        {daySessions.map((session) => (
                          <button
                            key={session.id}
                            type="button"
                            onClick={() => onSessionClick(session)}
                            className="flex items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-accent"
                          >
                            <span className="mt-0.5 font-mono text-muted-foreground">
                              {formatSessionTime(session)}
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate font-medium">{session.title}</span>
                              <span className="block truncate text-muted-foreground">{session.course}</span>
                            </span>
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
