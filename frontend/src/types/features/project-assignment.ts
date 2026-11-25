export type ProjectAssignmentMode = "SPLIT" | "WHOLE";
export interface AssignmentTemplate { id: number; versionId: number; version: string; code: string; name: string }
export type AssignmentTemplateLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
export type AssignmentCatalogSort = "NAME" | "CODE" | "RECENT";
/** Catalogue card; values come from the published snapshot that would be assigned. */
export interface AssignmentTemplateSummary extends AssignmentTemplate {
  category: string | null; level: AssignmentTemplateLevel | null; estimatedDurationWeeks: number | null;
  technologyStack: string | null; moduleCount: number; milestoneCount: number;
  minMembers: number; maxMembers: number; publishedAt: string | null; assignedTeams: string[];
}
export interface AssignmentCatalogFilter {
  search: string; category: string; level: string; fit: boolean; sort: AssignmentCatalogSort;
  page: number; size?: number; teamId?: number | null;
}
export interface AssignmentCatalog {
  items: AssignmentTemplateSummary[]; total: number; page: number; size: number; categories: string[];
}
export type AssignmentRubricLevel = "EXCELLENT" | "GOOD" | "FAIR" | "NOT_MET";
export interface AssignmentBriefRubricCriterion {
  code: string | null; name: string; description: string | null; weight: number | null; maxScore: number | null;
  ratings: Array<{ level: AssignmentRubricLevel; percentage: number; description: string }>;
}
/** `legacy` rubrics are criteria embedded in older templates: no name, version, weights or rating levels. */
export interface AssignmentBriefRubric {
  name: string | null; version: string | null; description: string | null; totalMaxScore: number | null;
  legacy: boolean; criteria: AssignmentBriefRubricCriterion[];
}
export interface AssignmentBriefMilestone {
  title: string; description: string | null; dueAfter: number | null; dueUnit: "DAYS" | "WEEKS" | null;
  weight: number | null; mandatory: boolean; checklist: Array<{ content: string; mandatory: boolean }>;
  rubric: AssignmentBriefRubric | null;
}
export interface AssignmentBriefNode {
  templateId: number; code: string; name: string; description: string | null; technologyStack: string | null;
  level: AssignmentTemplateLevel | null; estimatedDurationWeeks: number | null; minMembers: number; maxMembers: number;
  rolePolicy: AssignmentRolePolicy; milestones: AssignmentBriefMilestone[];
  backlogItems: Array<{ title: string; description: string | null; suggestedRole: string | null }>;
  modules: AssignmentBriefNode[];
}
export interface AssignmentBrief {
  templateId: number; versionId: number; version: string; category: string | null; publishedAt: string | null;
  master: AssignmentBriefNode;
}
export type AssignmentRole = "PM" | "BA" | "DEV" | "QA";
export interface AssignmentRolePolicy { allowMultiRole: boolean; quotas: Array<{ role: AssignmentRole; min: number; max: number }> }
export interface AssignmentMember { memberId: number; name: string; userCode: string; roles: AssignmentRole[] }
export interface AssignmentTeam {
  id: number; name: string; memberCount: number; status: string; eligible: boolean; reason: string | null;
  version: number; members: AssignmentMember[]; leaderMemberId: number | null;
  assignedProjectName: string | null;
}
export interface AssignmentModule {
  templateId: number; code: string; name: string; minMembers: number; maxMembers: number;
  milestoneCount: number; modules: AssignmentModule[];
  rolePolicy: AssignmentRolePolicy;
}
export interface AssignmentOwner {
  templateId: number; teamId: number; teamName: string;
}
export interface AssignmentPreview {
  master: AssignmentTemplate; minMembers: number; maxMembers: number; masterMilestoneCount: number;
  modules: AssignmentModule[]; teams: AssignmentTeam[];
  rolePolicy: AssignmentRolePolicy;
  owners: AssignmentOwner[];
}
export interface ProjectAssignmentRequest {
  masterTemplateId: number; versionId: number; mode: ProjectAssignmentMode;
  teamId?: number;
  modules: Array<{ moduleTemplateId: number; teamId: number }>;
  teamRoles?: Array<{ teamId: number; expectedVersion: number; leaderMemberId: number | null; members: Array<{ memberId: number; roles: AssignmentRole[] }> }>;
}
export interface ProjectAssignmentResult {
  assignmentId: number; mode: ProjectAssignmentMode; masterProjectId: number | null; assignedAt: string;
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
export interface MasterMilestoneContext {
  projectId: number; projectName: string; mode: ProjectAssignmentMode; teamId: number | null;
  status: string; canManage: boolean; readOnly: boolean;
  milestones: Array<{ id: string; title: string; description: string | null; deadline: string | null;
    mandatory: boolean; status: string; waived: boolean; submissionId: string | null; canSubmit: boolean }>;
}
