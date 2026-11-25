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

export interface LearningInsights {
  snapshot: {
    enrolledCourses: number;
    courseProgress: {
      courseId: number;
      courseName: string;
      completedLessons: number;
      totalLessons: number;
    }[];
    recentExamResults: {
      examId: number;
      examTitle: string;
      score: number;
      maxScore: number;
      submittedAt: string;
    }[];
    canReadProgress: boolean;
    canReadExamResults: boolean;
  };
  hasEvidence: boolean;
  nextStep: string | null;
  aiAvailable: boolean;
}

export interface LearningPlan {
  summary: string;
  steps: string[];
}

export const learningApi = {
  mine: async (): Promise<LearningRecords> => (await axios.get("/learning/me")).data,
  forUser: async (id: string): Promise<LearningRecords> =>
    (await axios.get(`/users/${encodeURIComponent(id)}/learning`)).data,
  insights: async (signal?: AbortSignal): Promise<LearningInsights> =>
    (await axios.get<LearningInsights>("/learning/me/insights", { signal })).data,
  generatePlan: async (): Promise<LearningPlan> =>
    (await axios.post<LearningPlan>("/learning/me/insights/plan")).data,
};
