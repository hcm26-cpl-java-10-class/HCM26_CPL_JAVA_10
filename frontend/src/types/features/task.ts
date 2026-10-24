export type TaskPriority = "HIGH" | "MEDIUM" | "LOW";

export type TaskStatus = "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE" | "BLOCKED";

export interface TaskPayload {
  projectId: string;
  sprintId: string | null;
  milestoneId: string | null;
  assigneeProjectMemberId: string | null;
  title: string;
  description: string | null;
  estimatedHours: number | null;
  priority: TaskPriority;
  tags: string[];
  version?: number;
}

export interface TaskDTO extends TaskPayload {
  id: string;
  status: TaskStatus;
  version: number;
  isActive: boolean;
  createdBy: number;
  updatedBy: number;
  createdAt: string;
  updatedAt: string;
  predecessorTaskIds: string[];
}

export interface TaskFilter {
  projectId: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  excludeIds?: string[];
}

export interface TaskDependencyDTO {
  taskId: string;
  title: string;
  status: TaskStatus;
  dependencyType: string;
  createdAt: string;
}

export interface TaskWorkflowDTO {
  task: TaskDTO;
  allowedTransitions: TaskStatus[];
  predecessors: TaskDependencyDTO[];
  successors: TaskDependencyDTO[];
  editable: boolean;
  deletable: boolean;
}

export interface TaskActivityDTO {
  id: string;
  action: string;
  actorId: number;
  actorName: string;
  occurredAt: string;
  before: TaskDTO | null;
  after: TaskDTO;
}

export interface TaskStatusPayload {
  status: TaskStatus;
  version: number;
}

export interface TaskDependencyPayload {
  predecessorTaskId: string;
  version: number;
}
