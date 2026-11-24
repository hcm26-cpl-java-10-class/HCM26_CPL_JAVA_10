export type ProjectReadiness = "INACTIVE" | "MILESTONES_PENDING" | "CHILDREN_PENDING" | "READY" | "COMPLETED";

export interface ProjectCompletionSummary {
  projectId: number;
  teamId: number | null;
  completed: boolean;
  gradeLocked: boolean;
  /** Only returned to users who can manage the project's assessment. */
  finalScore: number | null;
  canManage: boolean;
  childrenCompleted: boolean;
  milestones: Array<{ id: string; title: string; mandatory: boolean; accepted: boolean; waived: boolean }>;
  readiness: ProjectReadiness;
  canFinalize: boolean;
  master: boolean;
  pendingMilestones: Array<{ id: string; title: string; lifecycleStatus: string; draft: boolean }>;
  pendingChildren: Array<{ id: number; code: string; name: string; status: string | null }>;
  suggestedScore: number | null;
  finalizedAt: string | null;
}

export interface FinalizeProjectRequest {
  finalScore: number;
  note?: string;
}

export interface ProjectCompletionResult {
  projectId: number;
  teamId: number | null;
  completed: boolean;
  gradeLocked: boolean;
  trigger: string;
}
