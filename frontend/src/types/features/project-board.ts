export type BoardTaskStatus = "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE" | "BLOCKED";

export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface TaskCard {
  id: number;
  code: string;
  title: string;
  assignee: {
    id: number;
    displayName: string;
  } | null;
  priority: TaskPriority | null;
  status: BoardTaskStatus;
  version: number;
  sprintId: number | null;
}

export interface BoardColumn {
  key: "BACKLOG" | BoardTaskStatus;
  name: string;
  count: number;
  tasks: TaskCard[];
  isDragOver?: boolean;
}

export interface SprintSummary {
  id: number;
  name: string;
  startDate: string | null;
  endDate: string | null;
  sprintGoal: string | null;
}

export interface ProjectActivity {
  id: number;
  actorId: number | null;
  actorDisplayName: string | null;
  actionType: string;
  entityType: string;
  entityId: number | null;
  beforeState: string | null;
  afterState: string | null;
  correlationId: string | null;
  occurredAt: string;
}

export interface ProjectBoard {
  projectId: number;
  sprint: SprintSummary;
  columns: BoardColumn[];
  activityTrail: ProjectActivity[];
}

export interface ProjectBoardProjectOption {
  id: number;
  code: string;
  name: string;
}

export interface ProjectBoardSprintOption {
  id: number;
  name: string;
  status: "PLANNED" | "ACTIVE" | "COMPLETED" | "CANCELLED";
  startDate: string | null;
  endDate: string | null;
}

export interface ProjectTaskAssignee {
  id: number;
  displayName: string;
}

export interface CreateTaskPayload {
  title: string;
  description?: string;
  estimatedHours?: number;
  priority?: TaskPriority;
  assigneeProjectMemberId?: number;
}

export type TaskListItem = TaskCard;

export interface ProjectTaskList {
  projectId: number;
  sprint: SprintSummary | null;
  content: TaskListItem[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface TaskListQuery {
  sprintId?: number;
  status?: BoardTaskStatus;
  assigneeProjectMemberId?: number;
  unassigned?: boolean;
  search?: string;
  page?: number;
  size?: number;
  sortBy?: "code" | "title" | "status" | "priority" | "createdAt" | "updatedAt";
  direction?: "ASC" | "DESC";
}

export interface TaskStatusHistoryItem {
  id: number;
  previousStatus: BoardTaskStatus;
  newStatus: BoardTaskStatus;
  previousVersion: number;
  newVersion: number;
  actorId: number | null;
  actorDisplayName: string | null;
  correlationId: string | null;
  occurredAt: string;
}

export interface TaskStatusUpdateResponse {
  taskId: number;
  status: BoardTaskStatus;
  version: number;
  correlationId: string;
}

export interface UpdateTaskPayload {
  title?: string;
  description?: string;
  estimatedHours?: number;
  priority?: TaskPriority;
  assigneeProjectMemberId?: number | null;
}

export interface MoveTaskToSprintRequest {
  sprintId: number | null;
  expectedVersion: number;
}

export interface AssignTaskRequest {
  assigneeProjectMemberId: number | null;
  expectedVersion: number;
}

export interface UpdateTaskOrderRequest {
  orderIndex: number;
  expectedVersion: number;
}
