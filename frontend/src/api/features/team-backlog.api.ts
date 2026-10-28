import axiosInstance from "@/api/axios";
import type { SprintBacklogDTO, SprintDTO } from "@/types";

/**
 * Backlog board of one team workspace: only the sprints and work items that
 * belong to that team (its own sprints plus the sprints of the project it works
 * on).
 */
export interface TeamBacklogBoard {
  teamId: number;
  /** Project of the team, used to scope new items (`null` = team-only). */
  projectId?: number | null;
  sprints: SprintDTO[];
  items: SprintBacklogDTO[];
}

export const teamBacklogApi = {
  /**
   * Reads the workspace-scoped backlog board instead of the tenant-wide
   * `/sprints` and `/sprint-backlogs` pages.
   */
  getBoard: async (teamId: number): Promise<TeamBacklogBoard> => {
    const response = await axiosInstance.get<TeamBacklogBoard>(
      `/teams/${teamId}/backlog-board`,
    );
    return response.data;
  },
};
