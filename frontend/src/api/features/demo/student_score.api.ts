import axiosInstance from "@/api/axios";
import { createBaseApiService } from "@/api/base-service.api";
import type { StudentScoreDTO, StudentScoreFilter } from "@/types";

const path = "/student-scores";

const base = createBaseApiService<StudentScoreDTO, StudentScoreFilter>({
  path,
});

export const studentScoreApi = Object.assign({}, base, {
  getMine: async (): Promise<StudentScoreDTO[]> => {
    const res = await axiosInstance.get(`${path}/me`);
    return res.data;
  },
});
