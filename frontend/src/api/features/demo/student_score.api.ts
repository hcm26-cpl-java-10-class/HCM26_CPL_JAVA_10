import axiosInstance from "@/api/axios";
import { createBaseApiService } from "@/api/base-service.api";
import type { StudentScoreDTO, StudentScoreFilter } from "@/types";

const path = "/student-scores";

const base = createBaseApiService<StudentScoreDTO, StudentScoreFilter>({
  path,
});

export const studentScoreApi = Object.assign({}, base, {
  review: async (id: number | string): Promise<StudentScoreDTO> => {
    const res = await axiosInstance.post(`${path}/${id}/review`);
    return res.data;
  },
  release: async (id: number | string): Promise<StudentScoreDTO> => {
    const res = await axiosInstance.post(`${path}/${id}/release`);
    return res.data;
  },
  adjust: async (
    id: number | string,
    payload: { reason: string; scores: Record<string, number> },
  ): Promise<StudentScoreDTO> => {
    const res = await axiosInstance.post(`${path}/${id}/adjustments`, payload);
    return res.data;
  },
  getMine: async (): Promise<StudentScoreDTO[]> => {
    const res = await axiosInstance.get(`${path}/me`);
    return res.data;
  },
});
