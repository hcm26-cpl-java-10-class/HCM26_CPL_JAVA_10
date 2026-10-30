import type {
  SprintPlanningItem,
  SprintStatus,
  BacklogPriority,
  BacklogStatus,
} from "@/types";

const DAY_MS = 86_400_000;

/** Sprint lifecycle colours shared by the header ribbon and the summary bar. */
export const SPRINT_STATUS_META: Record<
  SprintStatus,
  { label: string; badge: string; dot: string; bar: string }
> = {
  PLANNED: {
    label: "Planned",
    badge:
      "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
    dot: "bg-sky-500",
    bar: "bg-sky-500",
  },
  ACTIVE: {
    label: "In progress",
    badge:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    dot: "bg-emerald-500",
    bar: "bg-emerald-500",
  },
  COMPLETED: {
    label: "Completed",
    badge:
      "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300",
    dot: "bg-indigo-500",
    bar: "bg-indigo-500",
  },
  CANCELLED: {
    label: "Cancelled",
    badge:
      "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
    dot: "bg-rose-500",
    bar: "bg-rose-500",
  },
};

export const FALLBACK_SPRINT_STATUS = {
  label: "Unknown",
  badge: "border-border bg-muted text-muted-foreground",
  dot: "bg-muted-foreground",
  bar: "bg-muted-foreground/40",
};

/** Backlog item priority pills ("Critical" == URGENT). */
export const PRIORITY_META: Record<
  BacklogPriority,
  { label: string; badge: string; dot: string; rank: number }
> = {
  URGENT: {
    label: "Critical",
    badge:
      "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
    dot: "bg-rose-500",
    rank: 4,
  },
  HIGH: {
    label: "High",
    badge:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    dot: "bg-amber-500",
    rank: 3,
  },
  MEDIUM: {
    label: "Medium",
    badge:
      "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
    dot: "bg-sky-500",
    rank: 2,
  },
  LOW: {
    label: "Low",
    badge:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    dot: "bg-emerald-500",
    rank: 1,
  },
};

export const FALLBACK_PRIORITY = {
  label: "No priority",
  badge: "border-border bg-muted text-muted-foreground",
  dot: "bg-muted-foreground",
  rank: 0,
};

/** Workflow chips of a backlog item card. */
export const TASK_STATUS_META: Record<
  BacklogStatus,
  { label: string; chip: string; column: string }
> = {
  BACKLOG: {
    label: "To Do",
    chip: "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300",
    column: "todo",
  },
  SPRINT_BACKLOG: {
    label: "To Do",
    chip: "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300",
    column: "todo",
  },
  IN_PROGRESS: {
    label: "In Progress",
    chip: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
    column: "doing",
  },
  REVIEW: {
    label: "Review",
    chip: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    column: "review",
  },
  DONE: {
    label: "Done",
    chip: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    column: "done",
  },
  BLOCKED: {
    label: "Blocked",
    chip: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
    column: "blocked",
  },
};

export const FALLBACK_TASK_STATUS = {
  label: "To Do",
  chip: "border-border bg-muted text-muted-foreground",
  column: "todo",
};

export const sprintStatusMeta = (status?: SprintStatus | null) =>
  (status && SPRINT_STATUS_META[status]) || FALLBACK_SPRINT_STATUS;

export const priorityMeta = (priority?: BacklogPriority | null) =>
  (priority && PRIORITY_META[priority]) || FALLBACK_PRIORITY;

export const taskStatusMeta = (status?: BacklogStatus | null) =>
  (status && TASK_STATUS_META[status]) || FALLBACK_TASK_STATUS;

export const formatDate = (value?: string | null) => {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export const formatDateTime = (value?: string | null) => {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

/** Short backlog key shown on every card (e.g. `PRJ-108`). */
export const taskKey = (item: SprintPlanningItem) => `PRJ-${item.id}`;

export const hoursOf = (item: SprintPlanningItem) =>
  typeof item.estimatedHours === "number" ? item.estimatedHours : 0;

export const sumHours = (items: SprintPlanningItem[]) =>
  items.reduce((total, item) => total + hoursOf(item), 0);

export const formatHours = (value: number) =>
  `${Number.isInteger(value) ? value : value.toFixed(1)} h`;

/**
 * Day counter of the sprint ribbon ("Day 8 of 14") and the schedule signal
 * shown next to the completion progress.
 */
export const sprintTimeline = (start?: string | null, end?: string | null) => {
  if (!start || !end) return null;

  const startDate = new Date(start);
  const endDate = new Date(end);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return null;
  }

  const now = Date.now();
  const totalDays = Math.max(
    1,
    Math.round((endDate.getTime() - startDate.getTime()) / DAY_MS),
  );
  const elapsedDays = Math.round((now - startDate.getTime()) / DAY_MS);
  const day = Math.min(Math.max(elapsedDays + 1, 1), totalDays);
  const daysLeft = Math.max(
    0,
    Math.round((endDate.getTime() - now) / DAY_MS),
  );

  return {
    totalDays,
    day,
    daysLeft,
    notStarted: now < startDate.getTime(),
    overdue: now > endDate.getTime(),
  };
};

/** Hours of the sprint backlog that are already DONE. */
export const completionRate = (items: SprintPlanningItem[]) => {
  const total = sumHours(items);
  const done = sumHours(items.filter((item) => item.status === "DONE"));

  return {
    total,
    done,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
  };
};

export const countByStatus = (items: SprintPlanningItem[]) => ({
  todo: items.filter(
    (item) => !item.status || item.status === "BACKLOG" || item.status === "SPRINT_BACKLOG",
  ).length,
  inProgress: items.filter((item) => item.status === "IN_PROGRESS").length,
  done: items.filter((item) => item.status === "DONE").length,
});

/**
 * Sprint Backlog items that are still open. A sprint can only be completed once
 * this list is empty - the backend rejects the transition with 422 otherwise.
 * <p>
 * The backend additionally requires every subtask of those items to be Done, so
 * a sprint whose items are all Done can still be rejected with the subtasks
 * that are left open (the API message is forwarded to the toast).
 */
export const unfinishedSprintItems = (items: SprintPlanningItem[]) =>
  items.filter((item) => item.status !== "DONE");

/** Message shown when "Complete sprint" is blocked by open backlog items. */
export const incompleteSprintMessage = (unfinishedCount: number) =>
  `Không thể hoàn thành Sprint: còn ${unfinishedCount} Backlog item chưa ở trạng thái Done.`;

/**
 * A sprint can only be started once it holds at least one Sprint Backlog item -
 * the backend rejects the transition with 422 otherwise.
 */
export const emptySprintBacklogMessage = () =>
  "Không thể bắt đầu Sprint: Sprint Backlog chưa có Backlog item nào.";
