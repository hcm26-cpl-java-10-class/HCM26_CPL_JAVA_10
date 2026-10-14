import { cn } from "@/lib/utils";
import type { StudySession } from "@/types/features/schedule";
import {
  darken,
  getSessionsForDay,
  getSessionColor,
  getWeekDays,
  isToday,
  layoutDaySessions,
  minutesOfDay,
  withAlpha,
} from "@/utils/schedule.utils";
import dayjs from "dayjs";
import { useEffect, useRef } from "react";

interface WeekViewProps {
  anchor: dayjs.Dayjs;
  sessions: StudySession[];
  onSessionClick: (session: StudySession) => void;
}

const HOUR_HEIGHT = 48;
const HOURS = Array.from({ length: 24 }, (_, index) => index);
const DAY_COLUMNS = 7;

const clampToDay = (minutes: number): number => Math.max(0, Math.min(24 * 60, minutes));

export function WeekView({ anchor, sessions, onSessionClick }: WeekViewProps) {
  const days = getWeekDays(anchor);
  const scrollRef = useRef<HTMLDivElement>(null);
  const now = dayjs();

  useEffect(() => {
    // Start the day around 07:30 like most calendar apps.
    scrollRef.current?.scrollTo({ top: 7 * HOUR_HEIGHT + HOUR_HEIGHT / 2 });
  }, [anchor]);

  const allDaySessions = sessions.filter(
    (session) => session.allDay && days.some((day) => getSessionsForDay([session], day).length > 0),
  );

  const showNowLine = days.some((day) => isToday(day));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Day headers */}
      <div className="grid shrink-0 grid-cols-[3.5rem_1fr] border-b border-border">
        <div />
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const today = isToday(day);
            return (
              <div
                key={day.format("YYYY-MM-DD")}
                className="flex flex-col items-center gap-0.5 py-1.5"
              >
                <span
                  className={cn(
                    "text-[11px] font-medium uppercase tracking-wide",
                    today ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {day.format("ddd")}
                </span>
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full text-sm",
                    today ? "bg-primary font-semibold text-primary-foreground" : "text-foreground",
                  )}
                >
                  {day.date()}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Scrollable body */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        {allDaySessions.length > 0 && (
          <div className="grid grid-cols-[3.5rem_1fr] border-b border-border">
            <div className="border-r border-border py-1 pr-2 text-right text-[10px] font-medium uppercase leading-5 text-muted-foreground">
              all-day
            </div>
            <div className="grid grid-cols-7 gap-0.5 p-1">
              {days.map((day) => (
                <div key={day.format("YYYY-MM-DD")} className="flex flex-col gap-0.5">
                  {getSessionsForDay(allDaySessions, day).map((session) => (
                    <button
                      key={session.id}
                      type="button"
                      onClick={() => onSessionClick(session)}
                      className="truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium"
                      style={{
                        backgroundColor: withAlpha(getSessionColor(session), 0.2),
                        color: darken(getSessionColor(session), 70),
                      }}
                    >
                      {session.title}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex">
          {/* Time gutter */}
          <div className="relative w-14 shrink-0" style={{ height: HOUR_HEIGHT * 24 }}>
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="absolute right-2 text-[10px] font-medium text-muted-foreground"
                style={{ top: hour * HOUR_HEIGHT, transform: "translateY(-50%)" }}
              >
                {hour === 0 ? "" : `${String(hour).padStart(2, "0")}:00`}
              </div>
            ))}
          </div>

          {/* Time grid */}
          <div className="relative flex-1" style={{ height: HOUR_HEIGHT * 24 }}>
            {/* Hour lines */}
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="absolute left-0 right-0 border-t border-border"
                style={{ top: hour * HOUR_HEIGHT }}
              />
            ))}

            {/* Day columns */}
            <div className="pointer-events-none absolute inset-0 grid grid-cols-7">
              {days.map((day, index) => (
                <div
                  key={day.format("YYYY-MM-DD")}
                  className={cn(
                    index > 0 && "border-l border-border",
                    isToday(day) && "bg-primary/[0.03]",
                  )}
                />
              ))}
            </div>

            {/* Events */}
            {days.map((day, dayIndex) => {
              const daySessions = getSessionsForDay(sessions, day).filter((session) => !session.allDay);
              const laidOut = layoutDaySessions(daySessions);
              const columnWidth = 100 / DAY_COLUMNS;

              return laidOut.map(({ session, lane, lanes }) => {
                const start = clampToDay(minutesOfDay(session.start));
                const end = clampToDay(minutesOfDay(session.end) <= start ? start + 15 : minutesOfDay(session.end));
                const color = getSessionColor(session);

                return (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => onSessionClick(session)}
                    className="absolute overflow-hidden rounded-md border-l-[3px] px-1.5 py-1 text-left transition-shadow hover:shadow-md"
                    style={{
                      top: (start / 60) * HOUR_HEIGHT + 1,
                      height: Math.max(((end - start) / 60) * HOUR_HEIGHT - 2, 18),
                      left: `calc(${dayIndex * columnWidth}% + ${(lane / lanes) * columnWidth}% + 1px)`,
                      width: `calc(${columnWidth / lanes}% - 2px)`,
                      backgroundColor: withAlpha(color, 0.2),
                      borderColor: color,
                    }}
                  >
                    <span
                      className="block truncate text-[11px] font-semibold leading-4"
                      style={{ color: darken(color, 70) }}
                    >
                      {session.title}
                    </span>
                    <span className="block truncate text-[10px] leading-3 text-muted-foreground">
                      {dayjs(session.start).format("HH:mm")} · {session.course}
                    </span>
                  </button>
                );
              });
            })}

            {/* Current time line */}
            {showNowLine && (
              <div
                className="pointer-events-none absolute left-0 right-0 z-10"
                style={{ top: (clampToDay(now.hour() * 60 + now.minute()) / 60) * HOUR_HEIGHT }}
              >
                <div className="relative h-0.5 bg-destructive">
                  <span className="absolute -left-1 -top-[3px] size-2 rounded-full bg-destructive" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
