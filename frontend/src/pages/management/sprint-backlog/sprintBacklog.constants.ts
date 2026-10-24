import type { SprintBacklogStatus, TaskPriority } from "@/types";

/**
 * Lifecycle of a Sprint Backlog item: To do -> In progress -> Review -> Done.
 * Kept in sync with the backend `SprintBacklogStatus` enum.
 */
export const SPRINT_BACKLOG_STATUS_OPTIONS: {
  label: string;
  value: SprintBacklogStatus;
}[] = [
  { label: "To do", value: "TODO" },
  { label: "In progress", value: "IN_PROGRESS" },
  { label: "Review", value: "REVIEW" },
  { label: "Done", value: "DONE" },
];

/**
 * Priority of a Sprint Backlog item, kept in sync with the backend
 * `SprintBacklogPriority` enum. Shared by every backlog creation form so
 * `/backlogs` and `/sprint-backlogs` accept the same values.
 */
export const SPRINT_BACKLOG_PRIORITY_OPTIONS: {
  label: string;
  value: TaskPriority;
}[] = [
  { label: "Low", value: "LOW" },
  { label: "Medium", value: "MEDIUM" },
  { label: "High", value: "HIGH" },
  { label: "Urgent", value: "URGENT" },
];
