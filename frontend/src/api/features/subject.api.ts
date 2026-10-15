import { createBaseApiService } from "@/api/base-service.api";
import axiosInstance from "../axios";
import type { SubjectDTO, SubjectFilter } from "@/types";

const path = "/subjects";

const base = createBaseApiService<SubjectDTO, SubjectFilter>({
  path: path,
});

export const subjectApi = Object.assign({}, base, {
  getActiveSubjects: async (): Promise<SubjectDTO[]> => {
    const response = await axiosInstance.get<SubjectDTO[]>(`${path}/active`);
    return response.data;
  },

  changeStatus: async (id: number | string, active: boolean): Promise<SubjectDTO> => {
    const response = await axiosInstance.patch<SubjectDTO>(`${path}/${id}/status`, null, {
      params: { active },
    });
    return response.data;
  },
});
