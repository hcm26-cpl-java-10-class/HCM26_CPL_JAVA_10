import type { SprintPlanningItem, TaskPriority, TaskStatus } from "@/types";

/** Workflow order of a backlog item (UFR-PRJ-003-02). */
export const TASK_STATUS_ORDER: TaskStatus[] = [
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
  TaskStatus,
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
  DONE: {
    label: "Done",
    pill: "border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
};

export const PRIORITY_FILTER_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: "URGENT", label: "Critical" },
  { value: "HIGH", label: "High" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LOW", label: "Low" },
];

/** The backend only accepts a one-step forward transition (422 otherwise). */
export const NEXT_TASK_STATUS: Record<TaskStatus, TaskStatus | null> = {
  BACKLOG: "SPRINT_BACKLOG",
  SPRINT_BACKLOG: "IN_PROGRESS",
  IN_PROGRESS: "DONE",
  DONE: null,
};

export const backlogStatusMeta = (status?: TaskStatus | null) =>
  (status && BACKLOG_STATUS_META[status]) || BACKLOG_STATUS_META.BACKLOG;

export const canMoveToStatus = (
  current: TaskStatus | null | undefined,
  target: TaskStatus,
) => {
  const from = current ?? "BACKLOG";

  return from === target || NEXT_TASK_STATUS[from] === target;
};

/**
 * Short key prefix of the section (`FSA Sprint 1` -> `FSA`), used by the row
 * keys (`FSA-21`) exactly like the project backlog mock-up.
 */
export const projectKeyOf = (sprintName?: string | null) => {
  const first = (sprintName ?? "").trim().split(/\s+/)[0] ?? "";
  const token = first.replace(/[^A-Za-z0-9]/g, "");

  return (token.length >= 2 && token.length <= 6 ? token : "PRJ").toUpperCase();
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
