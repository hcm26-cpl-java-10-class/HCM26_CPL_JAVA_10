import type { TeamCharterView } from "@/types/features/project-hub";

/** Keep server workflow enums unchanged; distinguish incomplete content from roster issues. */
export function charterProgressLabel(view: TeamCharterView): string {
  if (view.progress === "NOT_SAVED") return "Not created";
  if (view.progress === "FULLY_CONFIRMED") return "Fully confirmed";
  if (view.progress === "PENDING") return "Awaiting confirmation";
  const complete = view.contentComplete ?? (
    [view.charter.mission, view.charter.definitionOfDone, view.charter.primaryChannel,
      view.charter.coreHours, view.charter.conflictResolution].every(value => !!value?.trim()) &&
    view.members.every(member => !!member.responsibility?.trim())
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
