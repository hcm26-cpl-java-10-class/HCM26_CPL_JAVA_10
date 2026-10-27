import axiosInstance from "@/api/axios";
import type {
  AllocationSession,
  ClassMember,
  ClassRosterMember,
  MentorOption,
  PublishTeamsResponse,
  SaveDraftRequest,
  TeamListResponse,
  TeamMemberHistoryPage,
  TeamProjectTemplate,
  TransferTeamMemberRequest,
  UpdateTeamRolesRequest,
  UpdateDraftTeamRequest,
} from "@/types/features/team-allocation";

const classPath = (classId: number) => `/v1/classes/${classId}`;

export const teamAllocationApi = {
  async getSessions(classId: number): Promise<AllocationSession[]> {
    const response = await axiosInstance.get<AllocationSession[]>(
      `${classPath(classId)}/allocation-sessions`,
    );
    return response.data;
  },

  async openSession(
    classId: number,
    payload: { maxMembers?: number },
  ): Promise<AllocationSession> {
    const response = await axiosInstance.post<AllocationSession>(
      `${classPath(classId)}/allocation-sessions`,
      payload,
    );
    return response.data;
  },

  async updateSessionCapacity(
    classId: number,
    sessionId: number,
    maxMembers: number,
  ): Promise<AllocationSession> {
    const response = await axiosInstance.patch<AllocationSession>(
      `${classPath(classId)}/allocation-sessions/${sessionId}`,
      { maxMembers },
    );
    return response.data;
  },

  async cancelSession(classId: number, sessionId: number): Promise<AllocationSession> {
    const response = await axiosInstance.post<AllocationSession>(
      `${classPath(classId)}/allocation-sessions/${sessionId}/cancel`,
    );
    return response.data;
  },

  async getUnassignedMembers(classId: number, sessionId: number): Promise<ClassMember[]> {
    const response = await axiosInstance.get<ClassMember[]>(
      `${classPath(classId)}/members/unassigned`,
      { params: { sessionId } },
    );
    return response.data;
  },

  async getClassRoster(
    classId: number,
    sessionId: number | null,
  ): Promise<ClassRosterMember[]> {
    const response = await axiosInstance.get<ClassRosterMember[]>(
      `${classPath(classId)}/members`,
      { params: sessionId === null ? undefined : { sessionId } },
    );
    return response.data;
  },

  async getTeams(classId: number, sessionId: number): Promise<TeamListResponse> {
    const response = await axiosInstance.get<TeamListResponse>(
      `${classPath(classId)}/allocation-sessions/${sessionId}/teams`,
    );
    return response.data;
  },

  async getClassMentors(classId: number): Promise<MentorOption[]> {
    const response = await axiosInstance.get<MentorOption[]>(
      `${classPath(classId)}/allocation-sessions/mentors`,
    );
    return response.data;
  },

  async saveDraft(
    classId: number,
    sessionId: number,
    payload: SaveDraftRequest,
    idempotencyKey: string,
  ): Promise<TeamListResponse> {
    const response = await axiosInstance.post<TeamListResponse>(
      `${classPath(classId)}/allocation-sessions/${sessionId}/teams/batch`,
      payload,
      { headers: { "X-Idempotency-Key": idempotencyKey } },
    );
    return response.data;
  },

  async updateDraftTeam(
    classId: number,
    sessionId: number,
    teamId: number,
    payload: UpdateDraftTeamRequest,
  ): Promise<void> {
    await axiosInstance.put(
      `${classPath(classId)}/allocation-sessions/${sessionId}/teams/${teamId}/draft`,
      payload,
    );
  },

  async updateTeamMentor(
    classId: number,
    sessionId: number,
    teamId: number,
    assignedMentorId: number | null,
    reason?: string,
  ): Promise<void> {
    await axiosInstance.put(
      `${classPath(classId)}/allocation-sessions/${sessionId}/teams/${teamId}/mentor`,
      { assignedMentorId, reason },
    );
  },

  async updateTeamRoles(
    classId: number,
    sessionId: number,
    teamId: number,
    payload: UpdateTeamRolesRequest,
  ): Promise<void> {
    await axiosInstance.put(
      `${classPath(classId)}/allocation-sessions/${sessionId}/teams/${teamId}/roles`,
      payload,
    );
  },

  async transferActiveTeamMember(
    classId: number,
    sessionId: number,
    sourceTeamId: number,
    memberId: number,
    payload: TransferTeamMemberRequest,
  ): Promise<void> {
    await axiosInstance.post(
      `${classPath(classId)}/allocation-sessions/${sessionId}/teams/${sourceTeamId}/members/${memberId}/transfer`,
      payload,
    );
  },

  async swapActiveTeamMember(
    classId: number,
    sessionId: number,
    sourceTeamId: number,
    memberId: number,
    payload: {
      replacementMemberId: number;
      replacementTeamId: number;
      reason: string;
    },
  ): Promise<void> {
    await axiosInstance.post(
      `${classPath(classId)}/allocation-sessions/${sessionId}/teams/${sourceTeamId}/members/${memberId}/swap`,
      payload,
    );
  },

  async getMemberHistory(filters: {
    classId?: number;
    cohortId?: number;
    memberId?: number;
    teamId?: number;
    page?: number;
    size?: number;
  }): Promise<TeamMemberHistoryPage> {
    const response = await axiosInstance.get<TeamMemberHistoryPage>(
      "/v1/team-member-history",
      { params: filters },
    );
    return response.data;
  },

  async addActiveTeamMember(
    classId: number,
    sessionId: number,
    teamId: number,
    memberId: number,
  ): Promise<void> {
    await axiosInstance.post(
      `${classPath(classId)}/allocation-sessions/${sessionId}/teams/${teamId}/members`,
      { memberId },
    );
  },

  async removeActiveTeamMember(
    classId: number,
    sessionId: number,
    teamId: number,
    memberId: number,
    reason: string,
  ): Promise<void> {
    await axiosInstance.delete(
      `${classPath(classId)}/allocation-sessions/${sessionId}/teams/${teamId}/members/${memberId}`,
      { data: { reason } },
    );
  },

  async publishTeams(
    classId: number,
    sessionId: number,
    teamIds: number[],
    idempotencyKey: string,
  ): Promise<PublishTeamsResponse> {
    const response = await axiosInstance.post<PublishTeamsResponse>(
      `${classPath(classId)}/allocation-sessions/${sessionId}/teams/publish`,
      { teamIds },
      { headers: { "X-Idempotency-Key": idempotencyKey } },
    );
    return response.data;
  },

  // ------------------------------------------------------------------
  // US-10 — assign a project template to a DRAFT team
  // ------------------------------------------------------------------

  /** Mentor / program-manager path. */
  async assignProjectTemplate(
    classId: number,
    sessionId: number,
    teamId: number,
    projectTemplateId: number,
  ): Promise<TeamProjectTemplate> {
    const response = await axiosInstance.put<TeamProjectTemplate>(
      `${classPath(classId)}/allocation-sessions/${sessionId}/teams/${teamId}/project-template`,
      { projectTemplateId },
    );
    return response.data;
  },

  async getTeamProjectTemplate(
    classId: number,
    sessionId: number,
    teamId: number,
  ): Promise<TeamProjectTemplate> {
    const response = await axiosInstance.get<TeamProjectTemplate>(
      `${classPath(classId)}/allocation-sessions/${sessionId}/teams/${teamId}/project-template`,
    );
    return response.data;
  },

  /** Student team-leader path: the DRAFT teams the signed-in user leads. */
  async getMyDraftTeams(): Promise<TeamProjectTemplate[]> {
    const response = await axiosInstance.get<TeamProjectTemplate[]>(
      "/v1/students/me/draft-teams",
    );
    return response.data;
  },

  async assignMyDraftTeamTemplate(
    teamId: number,
    projectTemplateId: number,
  ): Promise<TeamProjectTemplate> {
    const response = await axiosInstance.put<TeamProjectTemplate>(
      `/v1/students/me/draft-teams/${teamId}/project-template`,
      { projectTemplateId },
    );
    return response.data;
  },
};
