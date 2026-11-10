import axiosInstance from "@/api/axios";
import type {
  AssignmentBrief, AssignmentCatalog, AssignmentCatalogFilter, AssignmentPreview, AssignmentTemplate, ProjectAssignmentRequest, ProjectAssignmentResult,
  WorkspaceAssignmentContext, MasterMilestoneContext,
} from "@/types/features/project-assignment";

const base = (classId: number, sessionId: number) => `/v1/classes/${classId}/allocation-sessions/${sessionId}/project-assignments`;

/** The server answered with a shape this screen does not understand (typically a backend older than the frontend). */
export class UnsupportedApiResponseError extends Error {
  constructor() {
    super("Backend chưa hỗ trợ thư viện đề bài mới. Hãy build lại và khởi động lại backend.");
    this.name = "UnsupportedApiResponseError";
  }
}

function isCatalog(value: unknown): value is AssignmentCatalog {
  const catalog = value as Partial<AssignmentCatalog> | null;
  return !!catalog && Array.isArray(catalog.items) && Array.isArray(catalog.categories)
    && typeof catalog.total === "number" && typeof catalog.size === "number";
}

function isBrief(value: unknown): value is AssignmentBrief {
  const brief = value as Partial<AssignmentBrief> | null;
  return !!brief && !!brief.master && Array.isArray(brief.master.milestones) && Array.isArray(brief.master.modules);
}
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
  async templates(classId: number, sessionId: number, filter: Partial<AssignmentCatalogFilter>, signal?: AbortSignal) {
    const { search, category, level, fit, sort, page, size, teamId } = filter;
    const params = {
      search: search || undefined, category: category || undefined, level: level || undefined,
      fit: fit || undefined, teamId: fit && teamId != null ? teamId : undefined,
      sort: sort || undefined, page: page || undefined, size: size || undefined,
    };
    const data: unknown = (await axiosInstance.get(`${base(classId, sessionId)}/templates`, { params, signal })).data;
    if (!isCatalog(data)) throw new UnsupportedApiResponseError();
    return data;
  },
  async brief(classId: number, sessionId: number, template: AssignmentTemplate, signal?: AbortSignal) {
    const data: unknown = (await axiosInstance.get(`${base(classId, sessionId)}/templates/${template.id}/brief`,
      { params: { versionId: template.versionId }, signal })).data;
    if (!isBrief(data)) throw new UnsupportedApiResponseError();
    return data;
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
};
