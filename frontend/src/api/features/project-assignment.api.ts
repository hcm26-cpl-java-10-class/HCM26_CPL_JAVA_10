import axiosInstance from "@/api/axios";
import type {
  AssignmentPreview, AssignmentTemplate, ProjectAssignmentRequest, ProjectAssignmentResult,
  WorkspaceAssignmentContext, ProjectCompletionSummary, MasterMilestoneContext,
} from "@/types/features/project-assignment";

const base = (classId: number, sessionId: number) => `/v1/classes/${classId}/allocation-sessions/${sessionId}/project-assignments`;
const assessment = (projectId: number, teamId: number | null) => teamId == null
  ? `/projects/${projectId}` : `/projects/${projectId}/teams/${teamId}`;
export const projectAssignmentApi = {
  async classMasters(classId: number, sessionId: number, signal?: AbortSignal) {
    return (await axiosInstance.get<Array<{ projectId: number; name: string; status: string; assignedAt: string }>>(
      base(classId, sessionId), { signal })).data;
  },
  async classMasterMilestones(projectId: number, signal?: AbortSignal) {
    return (await axiosInstance.get<MasterMilestoneContext>(`/projects/${projectId}/master-milestones`, { signal })).data;
  },
  async submitClassMaster(projectId: number, milestoneId: string, data: { evidenceUrl: string; notes: string }, key: string) {
    return (await axiosInstance.post<{ id: string }>(`/projects/${projectId}/master-milestones/${milestoneId}/submissions`, data,
      { headers: { "Idempotency-Key": key } })).data;
  },
  async templates(classId: number, sessionId: number, search: string, signal?: AbortSignal) {
    return (await axiosInstance.get<AssignmentTemplate[]>(`${base(classId, sessionId)}/templates`, { params: { search }, signal })).data;
  },
  async preview(classId: number, sessionId: number, template: AssignmentTemplate, signal?: AbortSignal) {
    return (await axiosInstance.get<AssignmentPreview>(`${base(classId, sessionId)}/templates/${template.id}`,
      { params: { versionId: template.versionId }, signal })).data;
  },
  async assign(classId: number, sessionId: number, request: ProjectAssignmentRequest, requestKey: string) {
    return (await axiosInstance.post<ProjectAssignmentResult>(base(classId, sessionId), request,
      { headers: { "X-Idempotency-Key": requestKey } })).data;
  },
  async workspace(workspaceId: number, signal?: AbortSignal) {
    return (await axiosInstance.get<WorkspaceAssignmentContext>(`/workspaces/${workspaceId}/project-hierarchy`, { signal })).data;
  },
  async completion(projectId: number, teamId: number | null, signal?: AbortSignal) {
    return (await axiosInstance.get<ProjectCompletionSummary>(`${assessment(projectId, teamId)}/completion`, { signal })).data;
  },
  async lockGrade(projectId: number, teamId: number | null, finalScore: number) {
    return (await axiosInstance.post(`${assessment(projectId, teamId)}/final-grade/lock`, { finalScore })).data;
  },
  async waive(projectId: number, teamId: number | null, milestoneId: string, reason: string) {
    return (await axiosInstance.post(`${assessment(projectId, teamId)}/milestones/${milestoneId}/waive`, { reason })).data;
  },
};
