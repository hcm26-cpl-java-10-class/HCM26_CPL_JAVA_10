import axiosInstance from "@/api/axios";
import type { PageResponse } from "@/types/common/pageable";
import type { TemplateCandidate, TemplateCandidateFilter, TemplateCandidatePreview } from "@/types/features/template-candidate";

export const teamTemplateApi = {
  async search(classId: number, sessionId: number, teamId: number, filter: TemplateCandidateFilter, signal?: AbortSignal) {
    const params = new URLSearchParams({ page: String(filter.page), size: String(filter.size) });
    if (filter.q) params.set("q", filter.q);
    if (filter.level) params.set("level", filter.level);
    if (filter.category) params.set("category", filter.category);
    return (await axiosInstance.get<PageResponse<TemplateCandidate>>(
      `/v1/classes/${classId}/allocation-sessions/${sessionId}/teams/${teamId}/project-template-candidates`, { params, signal })).data;
  },

  async preview(classId: number, sessionId: number, teamId: number, templateId: number, signal?: AbortSignal) {
    return (await axiosInstance.get<TemplateCandidatePreview>(
      `/v1/classes/${classId}/allocation-sessions/${sessionId}/teams/${teamId}/project-template-candidates/${templateId}`, { signal })).data;
  },
};
