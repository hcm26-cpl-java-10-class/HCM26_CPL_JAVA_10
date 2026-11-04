import axios from "@/api/axios";
import type { Enrollment } from "@/types";

export interface LearningRecords {
  enrolledCourses: Enrollment[];
  inProgressCourses: number | null;
  completedCourses: number | null;
  overallProgress: number | null;
  certificates: string[] | null;
  learningActivity: string[] | null;
}
export const learningApi = {
  mine: async (): Promise<LearningRecords> => (await axios.get("/learning/me")).data,
  forUser: async (id: string): Promise<LearningRecords> =>
    (await axios.get(`/users/${encodeURIComponent(id)}/learning`)).data,
};
