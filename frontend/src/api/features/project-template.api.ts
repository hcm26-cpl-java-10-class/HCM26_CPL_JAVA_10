import axiosInstance from "@/api/axios";
import type { PageResponse, Pagination } from "@/types/common/pageable";
import type { ProjectTemplateOption } from "@/types/features/team-allocation";
import type { TemplateCandidate, TemplateCandidateFilter, TemplateCandidatePreview } from "@/types/features/template-candidate";
import type {
  ProjectTemplateDTO,
  ProjectTemplateFilter,
  ProjectTemplateOptions,
  ProjectTemplatePayload,
  TemplateTeamConstraintsPayload,
  TemplateMilestonePlan,
  TemplateMilestonePlanPayload,
  TemplateMilestoneOptions,
  TemplateActivationChecklist,
  TemplateSampleContent,
  TemplateSampleContentPayload,
  TemplateBacklogInput,
} from "@/types/features/project-template";

const path = "/project-templates";

export const projectTemplateApi = {
  async searchCandidates(classId: number, sessionId: number, teamId: number,
    filter: TemplateCandidateFilter, signal?: AbortSignal) {
    const params = new URLSearchParams();
    params.set("page", String(filter.page));
    params.set("size", String(filter.size));
    if (filter.q) params.set("q", filter.q);
    if (filter.level) params.set("level", filter.level);
    if (filter.category) params.set("category", filter.category);
    filter.technologies.forEach((value) => params.append("technology", value));
    filter.roles.forEach((value) => params.append("role", value));
    filter.outcomes.forEach((value) => params.append("outcome", value));
    const response = await axiosInstance.get<PageResponse<TemplateCandidate>>(
      `/v1/classes/${classId}/allocation-sessions/${sessionId}/teams/${teamId}/project-template-candidates`,
      { params, signal },
    );
    return response.data;
  },

  async previewCandidate(classId: number, sessionId: number, teamId: number,
    templateId: number, signal?: AbortSignal) {
    const response = await axiosInstance.get<TemplateCandidatePreview>(
      `/v1/classes/${classId}/allocation-sessions/${sessionId}/teams/${teamId}/project-template-candidates/${templateId}`,
      { signal },
    );
    return response.data;
  },
  async getPage(pagination: Pagination, search?: string, filter?: ProjectTemplateFilter) {
    const params = new URLSearchParams();
    params.set("page", String(pagination.page ?? 0));
    params.set("size", String(pagination.size ?? 10));
    const sort = pagination.sort ?? "createdAt,desc";
    (Array.isArray(sort) ? sort : [sort]).forEach((value) => params.append("sort", value));
    if (search?.trim()) params.set("search", search.trim());
    Object.entries(filter ?? {}).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    const response = await axiosInstance.get<PageResponse<ProjectTemplateDTO>>(path, { params });
    return response.data;
  },

  async getOptions(signal?: AbortSignal) {
    const response = await axiosInstance.get<ProjectTemplateOptions>(`${path}/options`, { signal });
    return response.data;
  },

  async getCohorts(signal?: AbortSignal) {
    const response = await axiosInstance.get<Array<{ id: number; name: string }>>(`${path}/cohorts`, { signal });
    return response.data;
  },

  /**
   * US-10: project templates that can be assigned to a DRAFT team.
   *
   * Student team-leader options remain separate from the mentor picker API.
   */
  async getAssignableOptions(signal?: AbortSignal): Promise<ProjectTemplateOption[]> {
    const response = await axiosInstance.get<ProjectTemplateOption[]>(
      "/v1/students/me/draft-teams/template-options",
      { signal },
    );
    return response.data ?? [];
  },

  async getById(id: string, signal?: AbortSignal) {
    const response = await axiosInstance.get<ProjectTemplateDTO>(`${path}/${id}`, { signal });
    return response.data;
  },

  async create(payload: ProjectTemplatePayload) {
    const response = await axiosInstance.post<ProjectTemplateDTO>(path, payload);
    return response.data;
  },

  async update(id: number, payload: ProjectTemplatePayload) {
    const response = await axiosInstance.put<ProjectTemplateDTO>(`${path}/${id}`, payload);
    return response.data;
  },

  async updateTeamConstraints(id: number, payload: TemplateTeamConstraintsPayload) {
    const response = await axiosInstance.put<ProjectTemplateDTO>(`${path}/${id}/team-constraints`, payload);
    return response.data;
  },

  async getMilestones(id: number, signal?: AbortSignal) {
    const response = await axiosInstance.get<TemplateMilestonePlan>(`${path}/${id}/milestones`, { signal });
    return response.data;
  },

  async saveMilestones(id: number, payload: TemplateMilestonePlanPayload) {
    const response = await axiosInstance.put<TemplateMilestonePlan>(`${path}/${id}/milestones`, payload);
    return response.data;
  },

  async getMilestoneOptions(id: number, signal?: AbortSignal) {
    const response = await axiosInstance.get<TemplateMilestoneOptions>(`${path}/${id}/milestone-options`, { signal });
    return response.data;
  },

  async getActivationChecklist(id: number, signal?: AbortSignal) {
    const response = await axiosInstance.get<TemplateActivationChecklist>(`${path}/${id}/activation-checklist`, { signal });
    return response.data;
  },

  async getSampleContent(id: number, signal?: AbortSignal) {
    const response = await axiosInstance.get<TemplateSampleContent>(`${path}/${id}/sample-content`, { signal });
    return response.data;
  },

  async saveSampleContent(id: number, payload: TemplateSampleContentPayload) {
    const response = await axiosInstance.put<TemplateSampleContent>(`${path}/${id}/sample-content`, payload);
    return response.data;
  },

  async previewBacklogImport(id: number, file: File) {
    const form = new FormData();
    form.append("file", file);
    const response = await axiosInstance.post<TemplateBacklogInput[]>(`${path}/${id}/backlog-import-preview`, form,
      { headers: { "Content-Type": undefined } });
    return response.data;
  },

  async getBacklogImportTemplate(id: number) {
    const response = await axiosInstance.get<Blob>(`${path}/${id}/backlog-import-template`, { responseType: "blob" });
    return response.data;
  },

  async activate(id: number, lockVersion: number) {
    const response = await axiosInstance.post<ProjectTemplateDTO>(`${path}/${id}/activate`, { lockVersion });
    return response.data;
  },

  async archive(id: number, lockVersion: number) {
    const response = await axiosInstance.post<ProjectTemplateDTO>(`${path}/${id}/archive`, { lockVersion });
    return response.data;
  },

  async delete(id: number, lockVersion: number) {
    await axiosInstance.delete(`${path}/${id}`, { params: { lockVersion } });
  },
};
