import type { MilestoneLifecycleStatus } from "@/types";

export const milestoneStatusStyles: Record<MilestoneLifecycleStatus, { label: string; badge: string; dot: string; edge: string }> = {
  PLANNED: {
    label: "Planned",
    badge: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
    dot: "bg-slate-400",
    edge: "border-l-slate-400",
  },
  IN_PROGRESS: {
    label: "In progress",
    badge: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
    dot: "bg-amber-500",
    edge: "border-l-amber-500",
  },
  SUBMITTED: {
    label: "Submitted",
    badge: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300",
    dot: "bg-blue-500",
    edge: "border-l-blue-500",
  },
  CHANGES_REQUESTED: {
    label: "Changes requested",
    badge: "border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-300",
    dot: "bg-orange-500",
    edge: "border-l-orange-500",
  },
  ACCEPTED: {
    label: "Accepted",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
    dot: "bg-emerald-500",
    edge: "border-l-emerald-500",
  },
  REJECTED: {
    label: "Rejected",
    badge: "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
    dot: "bg-red-500",
    edge: "border-l-red-500",
  },
};
