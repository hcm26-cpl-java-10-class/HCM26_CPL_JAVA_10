import { createBaseApiService } from "@/api/base-service.api";
import axiosInstance from "@/api/axios";
import type {
  BacklogAssigneeOption,
  SprintBacklogAuditLog,
  SprintBacklogDTO,
  SprintBacklogFilter,
} from "@/types";

const path = "/sprint-backlogs";

const base = createBaseApiService<SprintBacklogDTO, SprintBacklogFilter>({
  path,
});

export const sprintBacklogApi = Object.assign({}, base, {
  /**
   * Every backlog item of one sprint (a sprint owns one or many items).
   */
  getBySprintId: async (
    sprintId: number | string,
  ): Promise<SprintBacklogDTO[]> => {
    const response = await axiosInstance.get<SprintBacklogDTO[]>(
      `${path}/by-sprint/${sprintId}`,
    );
    return response.data;
  },

  /**
   * Audit trail of a backlog item (actor, timestamp, before/after state,
   * correlation id).
   */
  getAuditLogs: async (
    id: number | string,
  ): Promise<SprintBacklogAuditLog[]> => {
    const response = await axiosInstance.get<SprintBacklogAuditLog[]>(
      `${path}/${id}/audit-logs`,
    );
    return response.data;
  },

  /**
   * Active members of the workspace team, offered by the assignee picker of
   * the backlog create bar. `teamId` comes from the open workspace; without it
   * the backend returns an empty list (the `/backlogs` route page is not
   * scoped to a team).
   */
  getAssigneeOptions: async (
    teamId?: number | null,
  ): Promise<BacklogAssigneeOption[]> => {
    const response = await axiosInstance.get<BacklogAssigneeOption[]>(
      `${path}/assignee-options`,
      { params: teamId == null ? undefined : { teamId } },
    );
    return response.data ?? [];
  },
});
