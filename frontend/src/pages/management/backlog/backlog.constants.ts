import type {
  BacklogPriority,
  BacklogStatus,
  SprintBacklogWorkType,
  SprintPlanningItem,
} from "@/types";
import { Bookmark, Bug, SquareCheck, type LucideIcon } from "lucide-react";

/** Workflow order of a backlog item (UFR-PRJ-003-02). */
export const TASK_STATUS_ORDER: BacklogStatus[] = [
  "BACKLOG",
  "SPRINT_BACKLOG",
  "IN_PROGRESS",
  "DONE",
];

/**
 * Pill colours of the status dropdown shown on every backlog row.
 * `SPRINT_BACKLOG` is displayed as "To Do" to stay closer to the board wording.
 */
export const BACKLOG_STATUS_META: Record<
  BacklogStatus,
  { label: string; pill: string; dot: string }
> = {
  BACKLOG: {
    label: "Backlog",
    pill: "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200",
    dot: "bg-slate-400",
  },
  SPRINT_BACKLOG: {
    label: "To Do",
    pill: "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300",
    dot: "bg-slate-400",
  },
  IN_PROGRESS: {
    label: "In Progress",
    pill: "border-sky-200 bg-sky-100 text-sky-700 dark:border-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
    dot: "bg-sky-500",
  },
  REVIEW: {
    label: "Review",
    pill: "border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  DONE: {
    label: "Done",
    pill: "border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  BLOCKED: {
    label: "Blocked",
    pill: "border-rose-200 bg-rose-100 text-rose-700 dark:border-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
    dot: "bg-rose-500",
  },
};

export const PRIORITY_FILTER_OPTIONS: { value: BacklogPriority; label: string }[] = [
  { value: "URGENT", label: "Critical" },
  { value: "HIGH", label: "High" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LOW", label: "Low" },
];

/**
 * Priority pills shown on every backlog row (`URGENT` is displayed as
 * "Critical" like the project mock-up).
 */
export const BACKLOG_PRIORITY_META: Record<
  BacklogPriority,
  { label: string; pill: string; dot: string }
> = {
  URGENT: {
    label: "Critical",
    pill: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
    dot: "bg-rose-500",
  },
  HIGH: {
    label: "High",
    pill: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  MEDIUM: {
    label: "Medium",
    pill: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
    dot: "bg-sky-500",
  },
  LOW: {
    label: "Low",
    pill: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
};

export const NO_PRIORITY_META = {
  label: "No priority",
  pill: "border-border bg-muted text-muted-foreground",
  dot: "bg-muted-foreground",
};

/**
 * Work type of a work item: Story / Bug / Task (fixed set, no custom types).
 * The icon + colour match the Jira work item type picker.
 */
export const BACKLOG_WORK_TYPE_META: Record<
  SprintBacklogWorkType,
  { label: string; icon: LucideIcon; iconClass: string }
> = {
  STORY: { label: "Story", icon: Bookmark, iconClass: "text-lime-600" },
  BUG: { label: "Bug", icon: Bug, iconClass: "text-rose-500" },
  TASK: { label: "Task", icon: SquareCheck, iconClass: "text-sky-500" },
};

/** Falls back to `Task`, the backend default, when no type is stored. */
export const backlogWorkTypeMeta = (
  workType?: SprintBacklogWorkType | null,
) =>
  (workType && BACKLOG_WORK_TYPE_META[workType]) ||
  BACKLOG_WORK_TYPE_META.TASK;

export const backlogPriorityMeta = (priority?: BacklogPriority | null) =>
  (priority && BACKLOG_PRIORITY_META[priority]) || NO_PRIORITY_META;

export const NEXT_TASK_STATUS: Record<BacklogStatus, BacklogStatus | null> = {
  BACKLOG: "SPRINT_BACKLOG",
  SPRINT_BACKLOG: "IN_PROGRESS",
  IN_PROGRESS: "REVIEW",
  REVIEW: "DONE",
  DONE: null,
  BLOCKED: "IN_PROGRESS",
};

export const backlogStatusMeta = (status?: BacklogStatus | null) =>
  (status && BACKLOG_STATUS_META[status]) || BACKLOG_STATUS_META.BACKLOG;
export const canMoveToStatus = (
  current: BacklogStatus | null | undefined,
  target: BacklogStatus,
) => {
  const from = current ?? "BACKLOG";

  return from === target || TASK_STATUS_ORDER.includes(target);
};



/**
 * Words that name the container, not the work it holds: taking them as key
 * prefix turned every row into `SPRINT-1`, `SPRINT-2`, ... which reads like a
 * <em>sprint</em> code instead of a work item code.
 */
const GENERIC_KEY_TOKENS = new Set([
  "sprint",
  "sprints",
  "backlog",
  "backlogs",
  "product",
  "iteration",
  "phase",
]);

/**
 * Short key prefix of a backlog box, used by the row keys (`DISCOVERY-21`)
 * exactly like the Jira project key.
 * <p>
 * `Sprint 1 - Discovery` -> `DISCOVERY`, `Sprint 2 - Design System` ->
 * `DESIGN`. The generic words above and the sprint numbers are skipped so a
 * work item key can never be confused with a sprint code; when nothing is left
 * the `SB` (sprint backlog) fallback is used.
 */
export const projectKeyOf = (
  sprintName?: string | null,
  fallback = "FA",
) => {
  // Bug 44: use workspace task prefix stored in localStorage (set when workspace is opened)
  const stored = typeof window !== "undefined"
    ? (localStorage.getItem("workspace_task_prefix") ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase()
    : "";
  if (stored.length >= 1) return stored;

  // Fallback: derive from sprint name (legacy behaviour)
  const meaningful = (sprintName ?? "")
    .split(/[^A-Za-z0-9]+/)
    .filter(
      (token) =>
        token !== "" &&
        !/^\d+$/.test(token) &&
        !GENERIC_KEY_TOKENS.has(token.toLowerCase()),
    );

  const token = (meaningful[0] ?? "").replace(/[^A-Za-z0-9]/g, "");

  return (token.length >= 2 && token.length <= 10 ? token : fallback).toUpperCase();
};

export const backlogItemKey = (
  prefix: string,
  item: SprintPlanningItem,
) => `${prefix}-${item.id}`;

const shortDate = (value?: string | null) => {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

/** `24 Oct – 31 Oct`, the range shown next to the sprint name. */
export const formatBacklogRange = (
  start?: string | null,
  end?: string | null,
) => {
  const from = shortDate(start);
  const to = shortDate(end);

  if (from && to) {
    return `${from} – ${to}`;
  }

  return from || to;
};

export const formatBacklogDate = shortDate;

export const isOverdue = (value?: string | null) => {
  if (!value) return false;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return date.getTime() < today.getTime();
};

/** Status tallies of the three grey counters in the sprint section header. */
export const statusCounts = (items: SprintPlanningItem[]) => ({
  todo: items.filter(
    (item) =>
      (item.status ?? "BACKLOG") === "BACKLOG" ||
      item.status === "SPRINT_BACKLOG",
  ).length,
  inProgress: items.filter((item) => item.status === "IN_PROGRESS").length,
  done: items.filter((item) => item.status === "DONE").length,
});
