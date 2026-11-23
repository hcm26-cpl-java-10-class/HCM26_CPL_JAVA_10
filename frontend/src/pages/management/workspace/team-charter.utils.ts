import type { TeamCharterView } from "@/types/features/project-hub";

export const coreHourDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
type CoreHourDay = (typeof coreHourDays)[number];
type CoreHoursSchedule = { days: CoreHourDay[]; start: string; end: string };
const time = "(?:[01][0-9]|2[0-3]):[0-5][0-9]";

/** Convert a typed clock time to the HH:mm format used in the saved schedule. */
export function parseClockTime(value: string): string | null {
  const text = value.trim();
  if (!text) return "";
  const parts = /^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i.exec(text)
    ?? /^(\d{1,2})(\d{2})\s*(AM|PM)?$/i.exec(text);
  if (!parts) return null;
  const hour = Number(parts[1]);
  const minute = parts[2] ?? "00";
  const period = parts[3]?.toUpperCase();
  if (Number(minute) > 59 || hour > 23 || (period && (hour < 1 || hour > 12))) return null;
  const hour24 = period ? hour % 12 + (period === "PM" ? 12 : 0) : hour;
  return `${String(hour24).padStart(2, "0")}:${minute}`;
}
const schedulePattern = new RegExp(`^([A-Za-z, ]*) · (${time})?–(${time})?$`);

export function parseCoreHours(value: string): CoreHoursSchedule | null {
  if (!value) return {days: [], start: "", end: ""};
  const match = schedulePattern.exec(value);
  if (!match) return null;
  const selected = match[1] ? match[1].split(", ") : [];
  const days = coreHourDays.filter(day => selected.includes(day));
  if (days.length !== selected.length) return null;
  return {days, start: match[2] ?? "", end: match[3] ?? ""};
}

export function formatCoreHours({days, start, end}: CoreHoursSchedule): string {
  if (!days.length && !start && !end) return "";
  return `${coreHourDays.filter(day => days.includes(day)).join(", ")} · ${start}–${end}`;
}

export function validateCoreHours(value: string): string | null {
  if (!value) return null; // An empty field is allowed in a partial charter draft.
  const schedule = parseCoreHours(value);
  if (!schedule?.days.length || !schedule.start || !schedule.end) {
    return "Choose at least one day and enter both times.";
  }
  return schedule.start < schedule.end ? null : "End time must be later than start time on the same day.";
}

/** Keep server workflow enums unchanged; distinguish incomplete content from roster issues. */
export function charterProgressLabel(view: TeamCharterView): string {
  switch (view.workflow?.phase) {
    case "DRAFT": return "Draft";
    case "AWAITING_SIGNATURES": return "Awaiting signatures";
    case "READY_TO_PUBLISH": return "Ready to publish";
    case "PUBLISHED": return "Published";
  }
  if (view.progress === "NOT_SAVED") return "Not created";
  if (view.progress === "FULLY_CONFIRMED") return "Fully confirmed";
  if (view.progress === "PENDING") return "Awaiting confirmation";
  const complete = view.contentComplete ?? (
    [view.charter.mission, view.charter.definitionOfDone, view.charter.primaryChannel,
      view.charter.coreHours, view.charter.conflictResolution].every(value => !!value?.trim()) &&
    (view.members ?? []).every(member => !!member.responsibility?.trim())
  );
  return complete ? "Needs review" : "Draft · Incomplete";
}

/** Explicit UTC fallback for old responses; never silently use the browser's time zone. */
export function charterTimeZone(value?: string): string {
  if (value) {
    try { new Intl.DateTimeFormat("en-GB", {timeZone: value}); return value; }
    catch { /* Invalid/legacy configuration: show a labelled UTC fallback. */ }
  }
  return "UTC";
}

export function formatCharterDate(value: string | null | undefined, timeZone?: string): string {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: charterTimeZone(timeZone), year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    timeZoneName: "shortOffset",
  }).format(date);
}
