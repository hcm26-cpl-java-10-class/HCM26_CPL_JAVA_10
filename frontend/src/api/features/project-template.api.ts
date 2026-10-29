import axiosInstance from "@/api/axios";
import type { PageResponse, Pagination } from "@/types/common/pageable";
import type { ProjectTemplateOption } from "@/types/features/team-allocation";
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

  /**
   * US-10: project templates that can be assigned to a DRAFT team.
   *
   * The endpoint is intentionally mounted on `/v1/project-templates` (not the
   * versioned `/project-template-versions` CRUD surface) because it only exposes
   * the assignable catalogue with the `min_members` / `max_members` window.
   */
  async getAssignableOptions(signal?: AbortSignal): Promise<ProjectTemplateOption[]> {
    const response = await axiosInstance.get<ProjectTemplateOption[]>(
      "/v1/project-templates/options",
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
