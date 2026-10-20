import { createBaseApiService } from "@/api/base-service.api";
import axiosInstance from "../axios";
import type { SubjectDTO, SubjectFilter, SubjectSummaryDTO } from "@/types";

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

  isSubjectReferenced: async (id: number | string): Promise<boolean> => {
    const response = await axiosInstance.get<boolean>(`${path}/${id}/is-referenced`);
    return response.data;
  },

  checkCodeAvailable: async (
    code: string,
    version = "1.0",
    excludeId?: number | string
  ): Promise<{ code: string; version: string; available: boolean }> => {
    const response = await axiosInstance.get<{ code: string; version: string; available: boolean }>(
      `${path}/check-code`,
      {
        params: { code, version, excludeId },
      }
    );
    return response.data;
  },

  getSummary: async (): Promise<SubjectSummaryDTO> => {
    const response = await axiosInstance.get<SubjectSummaryDTO>(`${path}/summary`);
    return response.data;
  },
});
