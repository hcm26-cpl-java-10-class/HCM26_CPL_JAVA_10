import axiosInstance from "@/api/axios";
import type {
  AssignmentBrief, AssignmentBriefNode, AssignmentBriefRubric, AssignmentCatalog, AssignmentCatalogFilter, AssignmentPreview, AssignmentTemplate, ProjectAssignmentRequest, ProjectAssignmentResult,
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
  return !!brief && typeof brief.master === "object" && brief.master !== null;
}

const array = <T,>(value: T[] | null | undefined): T[] => Array.isArray(value) ? value : [];

function normalizeRubric(rubric: AssignmentBriefRubric | null | undefined): AssignmentBriefRubric | null {
  if (!rubric || typeof rubric !== "object") return null;
  return {
    ...rubric, name: rubric.name ?? null, version: rubric.version ?? null, description: rubric.description ?? null,
    totalMaxScore: rubric.totalMaxScore ?? null, legacy: !!rubric.legacy,
    criteria: array(rubric.criteria).map(criterion => ({ ...criterion, ratings: array(criterion.ratings) })),
  };
}

/** Fills fields an older or partial response may omit, so the brief views can rely on the declared shape. */
function normalizeNode(node: AssignmentBriefNode): AssignmentBriefNode {
  return {
    ...node,
    rolePolicy: { allowMultiRole: !!node.rolePolicy?.allowMultiRole, quotas: array(node.rolePolicy?.quotas) },
    milestones: array(node.milestones).map(milestone => ({
      ...milestone, checklist: array(milestone.checklist), rubric: normalizeRubric(milestone.rubric),
    })),
    backlogItems: array(node.backlogItems),
    modules: array(node.modules).map(normalizeNode),
  };
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
    return { ...data, master: normalizeNode(data.master) };
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
