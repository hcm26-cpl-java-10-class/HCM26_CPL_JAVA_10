import dayjs from "dayjs";
import type { CalendarSessionResponse } from "@/api/features/calendar.api";
import { ChevronRight, Clock, GraduationCap, MapPin, User } from "lucide-react";
import { STATUS_CLASSES, STATUS_LABELS, TIME_ZONE, useCalendarLookup } from "./calendarLookup";
import { SessionDetailModal } from "./SessionDetailModal";

export function SessionCard({
  session,
  sessionIndex,
}: {
  session: CalendarSessionResponse;
  sessionIndex?: number;
}) {
  const start = dayjs.tz(session.startTime, TIME_ZONE);
  const end = dayjs.tz(session.endTime, TIME_ZONE);
  const sameDay = start.format("YYYY-MM-DD") === end.format("YYYY-MM-DD");
  const timeLabel = sameDay
    ? `${start.format("HH:mm")} – ${end.format("HH:mm")}`
    : `${start.format("DD/MM HH:mm")} – ${end.format("DD/MM HH:mm")}`;

  const durationHours = end.diff(start, "minute") / 60;
  const durationText =
    durationHours > 0
      ? durationHours % 1 === 0
        ? `${durationHours}h`
        : `${durationHours.toFixed(1)}h`
      : "";

  const { getClassCode, getTrainerName, getTopicCode } = useCalendarLookup();
  const statusClass = STATUS_CLASSES[session.status] || "bg-muted text-muted-foreground";

  return (
    <SessionDetailModal
      session={session}
      trigger={
        <article className="group relative cursor-pointer overflow-hidden rounded-xl border border-border/80 bg-card p-2.5 shadow-xs transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md text-left">
          <div className="flex items-center justify-between gap-1 pb-1.5 border-b border-border/60">
            <div className="inline-flex items-center gap-1 text-[11px] font-bold text-primary">
              <Clock className="h-3 w-3 shrink-0" />
              <span>{timeLabel}</span>
              {durationText && (
                <span className="text-[10px] font-normal text-muted-foreground">({durationText})</span>
              )}
            </div>
            {typeof sessionIndex === "number" && (
              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary">
                Ca {sessionIndex}
              </span>
            )}
          </div>

          <div className="pt-2 space-y-1.5 text-xs">
            <h4 className="font-bold text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
              {session.title || "Buổi học đào tạo"}
            </h4>

            <div className="space-y-0.5 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-1.5 truncate">
                <GraduationCap className="h-3 w-3 shrink-0 text-muted-foreground/70" />
                <span className="truncate">
                  {getClassCode(session.classId)} · {getTopicCode(session.topicId, session.title)}
                </span>
              </div>
              <div className="flex items-center gap-1.5 truncate">
                <User className="h-3 w-3 shrink-0 text-muted-foreground/70" />
                <span className="truncate font-medium text-foreground/80">
                  {getTrainerName(session.trainerId)}
                </span>
              </div>
              <div className="flex items-center gap-1.5 truncate">
                <MapPin className="h-3 w-3 shrink-0 text-muted-foreground/70" />
                <span className="truncate">{session.location || "Chưa xếp phòng"}</span>
              </div>
            </div>

            <div className="pt-1 flex items-center justify-between border-t border-border/40">
              <span className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold border ${statusClass}`}>
                {STATUS_LABELS[session.status] ?? session.status}
              </span>
              <span className="text-[10px] text-primary/80 opacity-0 group-hover:opacity-100 transition-opacity font-medium flex items-center gap-0.5">
                Chi tiết <ChevronRight className="h-3 w-3" />
              </span>
            </div>
          </div>
        </article>
      }
    />
  );
}

