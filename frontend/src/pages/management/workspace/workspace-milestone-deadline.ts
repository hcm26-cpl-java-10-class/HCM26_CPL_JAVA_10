import { createLocaleFormatter } from "@/i18n/format";
import { toLanguage } from "@/i18n/languages";
import i18n from "@/i18n";
import type { MilestoneLifecycleStatus } from "@/types";

const ACTIVE: MilestoneLifecycleStatus[] = ["IN_PROGRESS", "CHANGES_REQUESTED"];

const formatter = () => createLocaleFormatter(toLanguage(i18n.language));

export type DeadlineTone = "normal" | "soon" | "late-window" | "overdue" | "done";

export interface DeadlineInfo {
  date: string;
  relative: string;
  tone: DeadlineTone;
  /** Short badge such as "3d overdue" or "Late window"; null when nothing needs flagging. */
  flag: string | null;
}

function shortDuration(ms: number) {
  const minutes = Math.round(Math.abs(ms) / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

function relativeText(ms: number) {
  const minutes = Math.round(ms / 60_000);
  const locale = formatter().locale;
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (Math.abs(minutes) < 60) return relative.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 48) return relative.format(hours, "hour");
  return relative.format(Math.round(hours / 24), "day");
}

export const isActiveMilestone = (status: MilestoneLifecycleStatus | null | undefined) => !!status && ACTIVE.includes(status);

export function describeDeadline(deadline: string | null | undefined, status: MilestoneLifecycleStatus | null | undefined, now: number, lateUntil?: string | null): DeadlineInfo {
  if (!deadline) return { date: i18n.t("No deadline"), relative: "", tone: "normal", flag: null };
  const time = new Date(deadline).getTime();
  if (Number.isNaN(time)) return { date: i18n.t("Invalid deadline"), relative: "", tone: "normal", flag: null };
  const diff = time - now;
  const base = { date: formatter().formatDateTimeMedium(new Date(time)), relative: relativeText(diff) };
  if (!isActiveMilestone(status)) {
    const done = status === "ACCEPTED" || status === "REJECTED" || status === "SUBMITTED";
    return { ...base, tone: done ? "done" : "normal", flag: null };
  }
  if (diff < 0) {
    const lateTime = lateUntil ? new Date(lateUntil).getTime() : NaN;
    if (!Number.isNaN(lateTime) && now <= lateTime) return { ...base, tone: "late-window", flag: i18n.t("Late window") };
    return { ...base, tone: "overdue", flag: `${shortDuration(diff)} ${i18n.t("overdue")}` };
  }
  if (diff <= 48 * 60 * 60 * 1000) return { ...base, tone: "soon", flag: i18n.t("Due soon") };
  return { ...base, tone: "normal", flag: null };
}
