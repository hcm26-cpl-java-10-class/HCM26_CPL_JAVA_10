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
          className={`group relative cursor-pointer overflow-hidden rounded-xl border border-border/80 border-l-4 ${accentBorderClass} bg-card p-3 shadow-xs transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md text-left`}
        >
          <div className="flex flex-wrap items-center justify-between gap-1.5 pb-2 border-b border-border/60">
            <div className="inline-flex items-center gap-1 text-[11px] font-bold text-primary whitespace-nowrap">
              <Clock className="h-3 w-3 shrink-0" />
              <span>{timeLabel}</span>
              {durationText && (
                <span className="text-[10px] font-normal text-muted-foreground">({durationText})</span>
              )}
            </div>
            {typeof sessionIndex === "number" && (
              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary whitespace-nowrap shrink-0">
                Ca {sessionIndex}
              </span>
            )}
          </div>

          <div className="pt-2 space-y-2 text-xs">
            <h4 className="font-bold text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
              {session.title || "Buổi học đào tạo"}
            </h4>

            <div className="space-y-1 text-[11px] text-muted-foreground">
              <div className="flex items-start gap-1.5">
                <GraduationCap className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground/70" />
                <span className="break-words leading-snug">
                  {getClassCode(session.classId)} · {getTopicCode(session.topicId, session.title)}
                </span>
              </div>
              <div className="flex items-start gap-1.5">
                <User className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground/70" />
                <span className="font-medium text-foreground/85 leading-snug break-words">
                  {getTrainerName(session.trainerId)}
                </span>
              </div>
              <div className="flex items-start gap-1.5">
                <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground/70" />
                <span className="leading-snug break-words">{session.location || "Chưa xếp phòng"}</span>
              </div>
            </div>

            <div className="pt-1.5 flex items-center justify-between gap-2 border-t border-border/40">
              <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-semibold border whitespace-nowrap shrink-0 ${statusClass}`}>
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

