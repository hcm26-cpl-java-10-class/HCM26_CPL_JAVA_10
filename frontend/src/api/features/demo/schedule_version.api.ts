import { createBaseApiService } from "@/api/base-service.api";
import axiosInstance from "@/api/axios";
import type { ScheduleVersionDTO, ScheduleVersionFilter } from "@/types";

const path = "/schedule-versions";

const base = createBaseApiService<ScheduleVersionDTO, ScheduleVersionFilter>({
  path: path,
});

export const scheduleVersionApi = Object.assign({}, base, {
  clone: async (id: number | string, note?: string): Promise<ScheduleVersionDTO> => {
    const response = await axiosInstance.post<ScheduleVersionDTO>(
      `${path}/${id}/clone`,
      null,
      { params: { note } }
    );
    return response.data;
  },
  activate: async (id: number | string): Promise<ScheduleVersionDTO> => {
    const response = await axiosInstance.put<ScheduleVersionDTO>(
      `${path}/${id}/activate`
    );
    return response.data;
  },
});
