import axiosInstance from "@/api/axios";
import type { ReviewSubmissionRequest, SaveSubmissionDraftRequest, SubmissionDetail, SubmissionListParams, SubmissionPage } from "@/types";

export const milestoneSubmissionApi = {
  async getPage(params: SubmissionListParams): Promise<SubmissionPage> {
    const query = new URLSearchParams({ page: String(params.page), size: String(params.size) });
    if (params.projectId) query.set("projectId", String(params.projectId));
    if (params.search) query.set("search", params.search);
    if (params.status) query.set("status", params.status);
    if (params.executionStatus) query.set("executionStatus", params.executionStatus);
    if (params.mandatory !== undefined) query.set("mandatory", String(params.mandatory));
    if (params.late !== undefined) query.set("late", String(params.late));
    if (params.sort) query.set("sort", params.sort.replace(",", ":"));
    if (params.bucket) query.set("bucket", params.bucket);
    return (await axiosInstance.get<SubmissionPage>("/milestone-submissions", { params: query })).data;
  },
  async getDetail(id: string): Promise<SubmissionDetail> {
    return (await axiosInstance.get<SubmissionDetail>(`/milestone-submissions/${id}`)).data;
  },
  async getMyPage(params: SubmissionListParams): Promise<SubmissionPage> {
    const query = new URLSearchParams({ page: String(params.page), size: String(params.size) });
    if (params.projectId) query.set("projectId", String(params.projectId));
    if (params.search) query.set("search", params.search);
    if (params.status) query.set("status", params.status);
    if (params.sort) query.set("sort", params.sort.replace(",", ":"));
    return (await axiosInstance.get<SubmissionPage>("/milestone-submissions/mine", { params: query })).data;
  },
  async getMyDetail(id: string): Promise<SubmissionDetail> {
    return (await axiosInstance.get<SubmissionDetail>(`/milestone-submissions/mine/${id}`)).data;
  },
  async createMyNextVersion(id: string, payload: { title: string; notes?: string; submissionUrl?: string }): Promise<SubmissionDetail> {
    return (await axiosInstance.post<SubmissionDetail>(`/milestone-submissions/mine/${id}/versions`, payload)).data;
  },
  async submitMine(id: string, idempotencyKey: string): Promise<SubmissionDetail> {
    return (await axiosInstance.post<SubmissionDetail>(`/milestone-submissions/mine/${id}/submit`, undefined, {
      headers: { "Idempotency-Key": idempotencyKey },
    })).data;
  },
  async updateMyDraft(id: string, versionId: string, payload: SaveSubmissionDraftRequest): Promise<SubmissionDetail> {
    return (await axiosInstance.put<SubmissionDetail>(`/milestone-submissions/mine/${id}/versions/${versionId}`, payload)).data;
  },
  async review(id: string, payload: ReviewSubmissionRequest, idempotencyKey: string): Promise<SubmissionDetail> {
    return (await axiosInstance.post<SubmissionDetail>(`/milestone-submissions/${id}/review`, payload, {
      headers: { "Idempotency-Key": idempotencyKey },
    })).data;
  },
  async createNextVersion(id: string, payload: { title: string; notes?: string; submissionUrl?: string }): Promise<SubmissionDetail> {
    return (await axiosInstance.post<SubmissionDetail>(`/milestone-submissions/${id}/versions`, payload)).data;
  },
  async submit(id: string, idempotencyKey: string): Promise<SubmissionDetail> {
    return (await axiosInstance.post<SubmissionDetail>(`/milestone-submissions/${id}/submit`, undefined, {
      headers: { "Idempotency-Key": idempotencyKey },
    })).data;
  },
  async updateDraft(id: string, versionId: string, payload: SaveSubmissionDraftRequest): Promise<SubmissionDetail> {
    return (await axiosInstance.put<SubmissionDetail>(`/milestone-submissions/${id}/versions/${versionId}`, payload)).data;
  },
};
