import axiosInstance from "@/api/axios";
import type {
  CreateMilestoneRequest,
  ArtifactDraft,
  ArtifactDraftRequest,
  ArtifactSubmission,
  ArtifactSubmissionRequest,
  ArtifactAttachment,
  ArtifactSubmissionWorkspace,
  MilestoneCreateOptions,
  MilestoneDetailResponse,
  MilestoneListParams,
  MilestoneOption,
  MilestonePageResponse,
  MilestoneProjectOption,
  MilestoneResponse,
} from "@/types";

/** Backlog form / detail panel milestone picker (UFR-PRJ-003-02). */
const backlogMilestoneOptionsPath = "/sprint-backlogs/milestone-options";

export const milestoneApi = {
  async getProjectOptions(signal?: AbortSignal): Promise<MilestoneProjectOption[]> {
    const response = await axiosInstance.get<MilestoneProjectOption[]>(
      "/projects/milestone-options",
      { signal },
    );
    return response.data ?? [];
  },

  async getTeamList(teamId: number, params: MilestoneListParams): Promise<MilestonePageResponse> {
    const response = await axiosInstance.get<MilestonePageResponse>(
      `/teams/${teamId}/milestones`,
      { params: { page: params.page, size: params.size, status: params.status } },
    );
    return response.data;
  },
  async getList(
    projectId: string,
    params: MilestoneListParams,
  ): Promise<MilestonePageResponse> {
    const query = new URLSearchParams({
      page: String(params.page),
      size: String(params.size),
    });
    if (params.teamId !== undefined) query.set("teamId", String(params.teamId));
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

  async getTeamCreateOptions(teamId: number): Promise<MilestoneCreateOptions> {
    const response = await axiosInstance.get<MilestoneCreateOptions>(
      `/teams/${teamId}/milestones/create-options`,
    );
    return response.data;
  },

  async openForSubmissions(projectId: string, milestoneId: string): Promise<MilestoneResponse> {
    const response = await axiosInstance.post<MilestoneResponse>(`/projects/${projectId}/milestones/${milestoneId}/open`);
    return response.data;
  },
  async openTeamMilestoneForSubmissions(teamId: number, milestoneId: string): Promise<MilestoneResponse> {
    const response = await axiosInstance.post<MilestoneResponse>(`/teams/${teamId}/milestones/${milestoneId}/open`);
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

  async createForTeam(
    teamId: number,
    payload: CreateMilestoneRequest,
    idempotencyKey: string,
  ): Promise<MilestoneResponse> {
    const response = await axiosInstance.post<MilestoneResponse>(
      `/teams/${teamId}/milestones`,
      payload,
      { headers: { "Idempotency-Key": idempotencyKey } },
    );
    return response.data;
  },

  async getDetail(projectId: string, milestoneId: string, teamId?: number): Promise<MilestoneDetailResponse> {
    const response = await axiosInstance.get<MilestoneDetailResponse>(
      `/projects/${projectId}/milestones/${milestoneId}`,
      { params: teamId === undefined ? undefined : { teamId } },
    );
    return response.data;
  },

  async getTeamDetail(teamId: number, milestoneId: string): Promise<MilestoneDetailResponse> {
    const response = await axiosInstance.get<MilestoneDetailResponse>(
      `/teams/${teamId}/milestones/${milestoneId}`,
    );
    return response.data;
  },

  /**
   * Milestones that can be linked to a backlog item (UFR-PRJ-003-02).
   * Only active milestones of the current tenant are returned. When `teamId`
   * is given the backend limits the list to the milestones of that team, so
   * the Backlog tab of a team workspace never offers milestones of other teams
   * that work on the same project.
   */
  getBacklogOptions: async (teamId?: number | null): Promise<MilestoneOption[]> => {
    const response = await axiosInstance.get<MilestoneOption[]>(
      backlogMilestoneOptionsPath,
      { params: teamId == null ? undefined : { teamId } },
    );
    return response.data ?? [];
  },

  async getTeamArtifactWorkspace(teamId: number, milestoneId: string): Promise<ArtifactSubmissionWorkspace> {
    const response = await axiosInstance.get<ArtifactSubmissionWorkspace>(`/teams/${teamId}/milestones/${milestoneId}/artifact-draft`);
    return response.data;
  },
  async saveTeamArtifactDraft(teamId: number, milestoneId: string, payload: ArtifactDraftRequest): Promise<ArtifactDraft> {
    const response = await axiosInstance.put<ArtifactDraft>(`/teams/${teamId}/milestones/${milestoneId}/artifact-draft`, payload);
    return response.data;
  },
  async submitTeamArtifact(teamId: number, milestoneId: string, payload: ArtifactSubmissionRequest, key: string): Promise<ArtifactSubmission> {
    const response = await axiosInstance.post<ArtifactSubmission>(`/teams/${teamId}/milestones/${milestoneId}/artifact-draft/submissions`, payload, { headers: { "Idempotency-Key": key } });
    return response.data;
  },
  async getTeamArtifactSubmissions(teamId: number, milestoneId?: string): Promise<Array<{ submission: ArtifactSubmission; reviewSubmissionId?: string | null; submitterId: string; submitterName?: string | null; submitterEmail?: string | null }>> {
    const response = await axiosInstance.get<Array<{ submission: ArtifactSubmission; reviewSubmissionId?: string | null; submitterId: string; submitterName?: string | null; submitterEmail?: string | null }>>(`/teams/${teamId}/milestones/submissions`, { params: milestoneId ? { milestoneId } : undefined });
    return response.data;
  },

  async getArtifactWorkspace(projectId: string, milestoneId: string): Promise<ArtifactSubmissionWorkspace> {
    const response = await axiosInstance.get<ArtifactSubmissionWorkspace>(
      `/projects/${projectId}/milestones/${milestoneId}/artifact-draft`,
    );
    return response.data;
  },

  async saveArtifactDraft(projectId: string, milestoneId: string, payload: ArtifactDraftRequest): Promise<ArtifactDraft> {
    const response = await axiosInstance.put<ArtifactDraft>(
      `/projects/${projectId}/milestones/${milestoneId}/artifact-draft`, payload,
    );
    return response.data;
  },

  async uploadArtifact(projectId: string, milestoneId: string, file: File): Promise<ArtifactAttachment> {
    const payload = new FormData();
    payload.append("file", file);
    const response = await axiosInstance.post<ArtifactAttachment>(
      `/projects/${projectId}/milestones/${milestoneId}/artifact-draft/attachments`, payload,
    );
    return response.data;
  },

  async submitArtifact(projectId: string, milestoneId: string, payload: ArtifactSubmissionRequest,
    idempotencyKey: string): Promise<ArtifactSubmission> {
    const response = await axiosInstance.post<ArtifactSubmission>(
      `/projects/${projectId}/milestones/${milestoneId}/artifact-draft/submissions`, payload,
      { headers: { "Idempotency-Key": idempotencyKey } },
    );
    return response.data;
  },
};
