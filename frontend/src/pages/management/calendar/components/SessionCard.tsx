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
  const accentBorderClass =
    session.status === "COMPLETED"
      ? "border-l-emerald-500"
      : session.status === "CANCELLED"
        ? "border-l-red-500"
        : "border-l-blue-500";

  return (
    <SessionDetailModal
      session={session}
      trigger={
        <article
          className={`group relative w-full min-w-0 cursor-pointer overflow-hidden rounded-lg border border-border/80 border-l-4 ${accentBorderClass} bg-card p-2 shadow-xs transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md text-left`}
        >
          <div className="flex flex-wrap items-center justify-between gap-1 pb-1.5 border-b border-border/60">
            <div className="inline-flex min-w-0 items-center gap-1 text-[10px] font-bold text-primary whitespace-nowrap">
              <Clock className="h-3 w-3 shrink-0" />
              <span>{timeLabel}</span>
              {durationText && (
                <span className="text-[10px] font-normal text-muted-foreground">({durationText})</span>
              )}
            </div>
            {typeof sessionIndex === "number" && (
              <span className="rounded bg-primary/10 px-1 py-0.5 text-[10px] font-bold text-primary whitespace-nowrap shrink-0">
                Ca {sessionIndex}
              </span>
            )}
          </div>

          <div className="pt-1.5 space-y-1.5 text-[11px]">
            <h4 className="font-bold text-foreground leading-snug line-clamp-2 break-words group-hover:text-primary transition-colors">
              {session.title || "Buổi học đào tạo"}
            </h4>

            <div className="space-y-1 text-[10px] text-muted-foreground">
              <div className="flex items-start gap-1 min-w-0">
                <GraduationCap className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground/70" />
                <span className="min-w-0 break-words leading-tight line-clamp-2">
                  {getClassCode(session.classId)} · {getTopicCode(session.topicId, session.title)}
                </span>
              </div>
              <div className="flex items-start gap-1 min-w-0">
                <User className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground/70" />
                <span className="min-w-0 font-medium text-foreground/85 leading-tight break-words line-clamp-2">
                  {getTrainerName(session.trainerId, session.note)}
                </span>
              </div>
              <div className="flex items-start gap-1 min-w-0">
                <MapPin className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground/70" />
                <span className="min-w-0 leading-tight break-words line-clamp-2">{session.location || "Chưa xếp phòng"}</span>
              </div>
            </div>

            <div className="pt-1.5 flex flex-wrap items-center justify-between gap-1 border-t border-border/40">
              <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold border whitespace-nowrap shrink-0 ${statusClass}`}>
                {STATUS_LABELS[session.status] ?? session.status}
              </span>
              <span className="text-[10px] text-primary/80 opacity-0 group-hover:opacity-100 transition-opacity font-medium flex items-center gap-0.5 whitespace-nowrap shrink-0">
                Chi tiết <ChevronRight className="h-3 w-3" />
              </span>
            </div>
          </div>
        </article>
      }
    />
  );
}

