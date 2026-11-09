import { createBaseApiService } from "@/api/base-service.api";
import axiosInstance from "@/api/axios";
import type { SprintDTO, SprintFilter, SprintPlanning } from "@/types";

const path = "/sprints";

const base = createBaseApiService<SprintDTO, SprintFilter>({
  path: path,
});

export const sprintApi = Object.assign({}, base, {
  /**
   * Sprint Planning board of a sprint (UFR-PRJ-003-03).
   */
  getPlanning: async (sprintId: number | string): Promise<SprintPlanning> => {
    const response = await axiosInstance.get<SprintPlanning>(
      `${path}/${sprintId}/backlog-items`,
    );
    return response.data;
  },

  /**
   * Persists the whole Sprint Backlog in one transaction: assign / unassign
   * items and save their priority order (array position = priority order).
   */
  updateBacklog: async (
    sprintId: number | string,
    taskIds: number[],
  ): Promise<SprintPlanning> => {
    const response = await axiosInstance.put<SprintPlanning>(
      `${path}/${sprintId}/backlog-items`,
      { taskIds },
    );
    return response.data;
  },
});
