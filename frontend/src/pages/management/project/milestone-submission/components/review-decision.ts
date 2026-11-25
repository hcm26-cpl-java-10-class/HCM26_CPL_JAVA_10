import { CheckCircle2, RotateCcw, XCircle, type LucideIcon } from "lucide-react";
import type { ReviewDecision } from "@/types";

/** Shared colour/label vocabulary of review decisions (soft tints, matching the submission status badges). */
export const decisionStyles: Record<ReviewDecision, {
  label: string; done: string; icon: LucideIcon; icon_color: string; banner: string; pill: string;
}> = {
  ACCEPT: {
    label: "Accepted", done: "Submission accepted", icon: CheckCircle2,
    icon_color: "text-emerald-600 dark:text-emerald-400",
    banner: "border-emerald-200 bg-emerald-50/80 dark:border-emerald-900 dark:bg-emerald-950/30",
    pill: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
  },
  REJECT: {
    label: "Rejected", done: "Submission rejected", icon: XCircle,
    icon_color: "text-rose-600 dark:text-rose-400",
    banner: "border-rose-200 bg-rose-50/80 dark:border-rose-900 dark:bg-rose-950/30",
    pill: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300",
  },
  REQUEST_CHANGES: {
    label: "Changes requested", done: "Revision requested", icon: RotateCcw,
    icon_color: "text-amber-600 dark:text-amber-400",
    banner: "border-amber-200 bg-amber-50/80 dark:border-amber-900 dark:bg-amber-950/30",
    pill: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
  },
};

export const ratingTones: Record<string, string> = {
  EXCELLENT: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
  GOOD: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300",
  FAIR: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
  NOT_MET: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300",
};

export function formatScore(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}
