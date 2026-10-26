import axiosInstance from "@/api/axios";
import type { PageResponse, Pagination } from "@/types/common/pageable";
import type {
  ProjectTemplateDTO,
  ProjectTemplateFilter,
  ProjectTemplateOptions,
  ProjectTemplatePayload,
  TemplateTeamConstraintsPayload,
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
};
