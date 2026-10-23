import axiosInstance from "@/api/axios";
import type {
  CreateMilestoneRequest,
  MilestoneCreateOptions,
  MilestoneDetailResponse,
  MilestoneListParams,
  MilestonePageResponse,
  MilestoneResponse,
} from "@/types";

export const milestoneApi = {
  async getList(
    projectId: string,
    params: MilestoneListParams,
  ): Promise<MilestonePageResponse> {
    const response = await axiosInstance.get<MilestonePageResponse>(
      `/projects/${projectId}/milestones`,
      { params },
    );
    return response.data;
  },

  async getCreateOptions(projectId: string): Promise<MilestoneCreateOptions> {
    const response = await axiosInstance.get<MilestoneCreateOptions>(
      `/projects/${projectId}/milestones/create-options`,
    );
    return response.data;
  },

  async create(
    projectId: string,
    payload: CreateMilestoneRequest,
    idempotencyKey: string,
  ): Promise<MilestoneResponse> {
    const response = await axiosInstance.post<MilestoneResponse>(
      `/projects/${projectId}/milestones`,
      payload,
      {
        headers: {
          "Idempotency-Key": idempotencyKey,
        },
      },
    );
    return response.data;
  },

  async getDetail(projectId: string, milestoneId: string): Promise<MilestoneDetailResponse> {
    const response = await axiosInstance.get<MilestoneDetailResponse>(
      `/projects/${projectId}/milestones/${milestoneId}`,
    );
    return response.data;
  },
};
