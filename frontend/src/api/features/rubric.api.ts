import axiosInstance from "@/api/axios";
import type { RubricDetail, RubricListParams, RubricPage, SaveRubricDraftRequest } from "@/types";

export const rubricApi = {
  async getList(params: RubricListParams): Promise<RubricPage> {
    const query = new URLSearchParams({ page: String(params.page), size: String(params.size) });
    if (params.search) query.set("search", params.search);
    if (params.status) query.set("status", params.status);
    const response = await axiosInstance.get<RubricPage>("/rubrics", { params: query });
    return response.data;
  },
  async getDetail(id: string): Promise<RubricDetail> {
    return (await axiosInstance.get<RubricDetail>(`/rubrics/${id}`)).data;
  },
  async create(payload: SaveRubricDraftRequest): Promise<RubricDetail> {
    return (await axiosInstance.post<RubricDetail>("/rubrics", payload)).data;
  },
  async updateDraft(rubricId: string, versionId: string, payload: SaveRubricDraftRequest): Promise<RubricDetail> {
    return (await axiosInstance.put<RubricDetail>(`/rubrics/${rubricId}/versions/${versionId}`, payload)).data;
  },
  async publish(rubricId: string, versionId: string): Promise<RubricDetail> {
    return (await axiosInstance.post<RubricDetail>(`/rubrics/${rubricId}/versions/${versionId}/publish`)).data;
  },
  async archive(rubricId: string, versionId: string): Promise<RubricDetail> {
    return (await axiosInstance.post<RubricDetail>(`/rubrics/${rubricId}/versions/${versionId}/archive`)).data;
  },
  async createVersion(rubricId: string, sourceVersionId: string): Promise<RubricDetail> {
    return (await axiosInstance.post<RubricDetail>(`/rubrics/${rubricId}/versions`, { sourceVersionId })).data;
  },
  async deleteDraft(rubricId: string, versionId: string): Promise<void> {
    await axiosInstance.delete(`/rubrics/${rubricId}/versions/${versionId}`);
  },
};
