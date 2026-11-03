export type ProjectAssignmentMode = "SPLIT" | "WHOLE";
export interface AssignmentTemplate { id: number; versionId: number; version: string; code: string; name: string }
export type AssignmentRole = "PM" | "BA" | "DEV" | "QA";
export interface AssignmentRolePolicy { allowMultiRole: boolean; quotas: Array<{ role: AssignmentRole; min: number; max: number }> }
export interface AssignmentMember { memberId: number; name: string; userCode: string; roles: AssignmentRole[] }
export interface AssignmentTeam {
  id: number; name: string; memberCount: number; status: string; eligible: boolean; reason: string | null;
  version: number; members: AssignmentMember[];
}
export interface AssignmentModule {
  templateId: number; code: string; name: string; minMembers: number; maxMembers: number;
  milestoneCount: number; modules: AssignmentModule[];
  rolePolicy: AssignmentRolePolicy;
}
export interface AssignmentPreview {
  master: AssignmentTemplate; minMembers: number; maxMembers: number; masterMilestoneCount: number;
  modules: AssignmentModule[]; teams: AssignmentTeam[];
  rolePolicy: AssignmentRolePolicy;
}
export interface ProjectAssignmentRequest {
  masterTemplateId: number; versionId: number; mode: ProjectAssignmentMode;
  teamId?: number;
  modules: Array<{ moduleTemplateId: number; teamId: number }>;
  teamRoles?: Array<{ teamId: number; expectedVersion: number; members: Array<{ memberId: number; roles: AssignmentRole[] }> }>;
}
export interface ProjectAssignmentResult {
  assignmentId: number; mode: ProjectAssignmentMode; masterProjectId: number; assignedAt: string;
  workspaces: Array<{ id: number; teamId: number; teamName: string; projectId: number; projectName: string }>;
}
export interface WorkspaceProjectNode {
  id: number; parentProjectId: number | null; code: string; name: string; status: string;
  teamId: number | null; assigned: boolean; children: WorkspaceProjectNode[];
  description: string | null; technologyStack: string | null;
}
export interface WorkspaceAssignmentContext {
  workspaceId: number; assignmentId: number | null; mode: ProjectAssignmentMode | null;
  assignedAt: string | null; readOnly: boolean; projects: WorkspaceProjectNode[];
  history: Array<{ workspaceId: number; name: string; status: string; createdAt: string; current: boolean }>;
}
export interface ProjectCompletionSummary {
  projectId: number; teamId: number | null; completed: boolean; gradeLocked: boolean; finalScore: number | null;
  canManage: boolean; childrenCompleted: boolean;
  milestones: Array<{ id: string; title: string; mandatory: boolean; accepted: boolean; waived: boolean }>;
}
export interface MasterMilestoneContext {
  projectId: number; projectName: string; mode: ProjectAssignmentMode; teamId: number | null;
  status: string; canManage: boolean; readOnly: boolean;
  milestones: Array<{ id: string; title: string; description: string | null; deadline: string | null;
    mandatory: boolean; status: string; waived: boolean; submissionId: string | null; canSubmit: boolean }>;
}
