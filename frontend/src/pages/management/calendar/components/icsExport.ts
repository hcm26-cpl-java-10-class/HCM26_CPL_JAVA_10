import dayjs from "dayjs";
import type { CalendarSessionResponse } from "@/api/features/calendar.api";
import { STATUS_LABELS, TIME_ZONE } from "./calendarLookup";

export interface IcsSessionLookup {
  getClassName: (classId?: number) => string;
  getClassCode: (classId?: number) => string;
  getTrainerName: (trainerId?: number, note?: string | null) => string;
  getTopicName: (topicId?: number, sessionTitle?: string) => string;
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function foldIcsLine(line: string): string {
  const maxChars = 70;
  if (line.length <= maxChars) return line;
  const parts: string[] = [];
  for (let i = 0; i < line.length; i += maxChars) {
    parts.push(i === 0 ? line.slice(i, i + maxChars) : ` ${line.slice(i, i + maxChars)}`);
  }
  return parts.join("\r\n");
}

function formatLocalDateTime(iso: string): string {
  return dayjs.tz(iso, TIME_ZONE).format("YYYYMMDDTHHmmss");
}

export function buildCalendarIcs(
  sessions: CalendarSessionResponse[],
  lookup: IcsSessionLookup,
  calendarName = "FAMS Training Timetable",
): string {
  const dtStamp = dayjs().utc().format("YYYYMMDDTHHmmss[Z]");
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//FAMS//Training Timetable//VI",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
    `X-WR-TIMEZONE:${TIME_ZONE}`,
    "BEGIN:VTIMEZONE",
    `TZID:${TIME_ZONE}`,
    "BEGIN:STANDARD",
    "DTSTART:19700101T000000",
    "TZOFFSETFROM:+0700",
    "TZOFFSETTO:+0700",
    "TZNAME:+07",
    "END:STANDARD",
    "END:VTIMEZONE",
  ];

  for (const session of sessions) {
    if (!session.startTime || !session.endTime) continue;

    const classCode = lookup.getClassCode(session.classId);
    const className = lookup.getClassName(session.classId);
    const topicName = lookup.getTopicName(session.topicId, session.title);
    const trainerName = lookup.getTrainerName(session.trainerId, session.note);
    const statusLabel = STATUS_LABELS[session.status] ?? session.status;

    const summaryRaw =
      classCode && classCode !== "—"
        ? `[${classCode}] ${session.title || "Buổi học"}`
        : session.title || "Buổi học";

    const descriptionParts = [
      `Lớp: ${className}`,
      `Môn học: ${topicName}`,
      `Giảng viên: ${trainerName}`,
      `Trạng thái: ${statusLabel}`,
    ];
    if (session.note) {
      descriptionParts.push(`Ghi chú: ${session.note}`);
    }

    lines.push(
      "BEGIN:VEVENT",
      `UID:fams-session-${session.id}@fams.local`,
      `DTSTAMP:${dtStamp}`,
      `DTSTART;TZID=${TIME_ZONE}:${formatLocalDateTime(session.startTime)}`,
      `DTEND;TZID=${TIME_ZONE}:${formatLocalDateTime(session.endTime)}`,
      `SUMMARY:${escapeIcsText(summaryRaw)}`,
    );

    if (session.location) {
      lines.push(`LOCATION:${escapeIcsText(session.location)}`);
    }

    lines.push(
      `DESCRIPTION:${escapeIcsText(descriptionParts.join("\n"))}`,
      `STATUS:${session.status === "CANCELLED" ? "CANCELLED" : "CONFIRMED"}`,
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return `${lines.map(foldIcsLine).join("\r\n")}\r\n`;
}
