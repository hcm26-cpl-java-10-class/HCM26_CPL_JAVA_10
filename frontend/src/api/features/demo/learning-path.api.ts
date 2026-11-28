import axiosInstance from "@/api/axios";
import type {
  LearningPathDetail,
  LearningPathRequest,
  LearningPathSummary,
} from "@/types/features/demo/learning-path";

const path = "/learning-paths";

export const learningPathApi = {
  list: async (): Promise<LearningPathSummary[]> => (await axiosInstance.get<LearningPathSummary[]>(path)).data,

  get: async (id: number): Promise<LearningPathDetail> =>
    (await axiosInstance.get<LearningPathDetail>(`${path}/${id}`)).data,

  create: async (request: LearningPathRequest): Promise<LearningPathSummary> =>
    (await axiosInstance.post<LearningPathSummary>(path, request)).data,

  update: async (id: number, request: LearningPathRequest): Promise<void> => {
    await axiosInstance.put(`${path}/${id}`, request);
  },

  /** Replaces the courses of a path; the order of courseIds becomes the order of the path. */
  setCourses: async (id: number, courseIds: number[]): Promise<void> => {
    await axiosInstance.put(`${path}/${id}/courses`, { courseIds });
  },

  remove: async (id: number): Promise<void> => {
    await axiosInstance.delete(`${path}/${id}`);
  },
};

export const learningPathKeys = {
  all: ["learning-paths"] as const,
  detail: (id: number) => ["learning-paths", id] as const,
};
