import axiosInstance from "@/api/axios";
import type {
  CreateMilestoneRequest,
  MilestoneCreateOptions,
  MilestoneDetailResponse,
  MilestoneListParams,
  MilestoneOption,
  MilestonePageResponse,
  MilestoneResponse,
  PageResponse,
} from "@/types";

const backlogMilestoneOptionsPath = "/backlog-items/milestone-options";

export const milestoneApi = {
  async getList(
    projectId: string,
    params: MilestoneListParams,
  ): Promise<MilestonePageResponse> {
    const query = new URLSearchParams({
      page: String(params.page),
      size: String(params.size),
    });
    const sort = Array.isArray(params.sort) ? params.sort : params.sort ? [params.sort] : [];
    sort.forEach((item) => query.append("sort", item.replace(",", ":")));
    if (params.search) query.set("search", params.search);
    params.status?.forEach((status) => query.append("status", status));
    if (params.mandatory !== undefined) query.set("mandatory", String(params.mandatory));
    params.latePolicyType?.forEach((type) => query.append("latePolicyType", type));
    if (params.deadlineFrom) query.set("deadlineFrom", params.deadlineFrom);
    if (params.deadlineTo) query.set("deadlineTo", params.deadlineTo);

    const response = await axiosInstance.get<MilestonePageResponse>(
      `/projects/${projectId}/milestones`,
      { params: query },
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

  /** Compatibility adapter for the temporary backlog relation selector. */
  getPage: async (): Promise<PageResponse<MilestoneOption>> => {
    const response = await axiosInstance.get<MilestoneOption[]>(backlogMilestoneOptionsPath);
    const content = response.data ?? [];

    return {
      content,
      items: content,
      page: 0,
      size: content.length,
      totalPages: 1,
      totalElements: content.length,
      hasNext: false,
      hasPrevious: false,
    };
  },
};
