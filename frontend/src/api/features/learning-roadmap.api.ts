import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import axios from "@/api/axios";

export type LearningLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";

export interface RoadmapGoal {
  careerGoal: string;
  currentLevel: LearningLevel;
  hoursPerWeek: number;
  durationMonths: number;
  durationWeeks?: number;
}

export type RoadmapCourseStatus = "PLANNED" | "ENROLLED" | "IN_PROGRESS" | "COMPLETED" | "UNAVAILABLE";

export interface RoadmapCourse {
  id: number;
  title: string;
  status: RoadmapCourseStatus;
  enrollmentId: number | null;
  progressPercent: number | null;
  durationMinutes: number | null;
}

export interface LearningRoadmap {
  goal: RoadmapGoal | null;
  revision: number | null;
  targetWeeks: number | null;
  generatedAt: string | null;
  aiAvailable: boolean;
  outdated: boolean;
  source: "AI" | "RULE_BASED" | "RULE_BASED_WITH_AI_ADVICE" | null;
  title: string | null;
  summary: string | null;
  advice: string[];
  enrolledCourses: RoadmapCourse[];
  phases: {
    title: string;
    startWeek: number;
    endWeek: number;
    courses: RoadmapCourse[];
    objective: string | null;
    reasons: Record<string, string> | null;
  }[];
}

const base = "/learning/me/roadmap";

export const learningRoadmapApi = {
  get: async (signal?: AbortSignal) => (await axios.get<LearningRoadmap>(base, { signal })).data,
  saveGoal: async (goal: RoadmapGoal, revision: number | null) =>
    (await axios.put<LearningRoadmap>(`${base}/goal`, { goal, revision })).data,
  generate: async (revision: number, ruleBased = true) =>
    (await axios.post<LearningRoadmap>(`${base}/generate`, { revision, ruleBased })).data,
  advise: async (revision: number) =>
    (await axios.post<LearningRoadmap>(`${base}/advice`, { revision })).data,
};

export const learningRoadmapKey = (account: string) => ["personal-learning-roadmap", account] as const;

export function useLearningRoadmap(account: string, enabled = true) {
  return useQuery({
    queryKey: learningRoadmapKey(account),
    queryFn: ({ signal }) => learningRoadmapApi.get(signal),
    retry: false,
    gcTime: 0,
    enabled,
  });
}

export function roadmapErrorStatus(error: unknown): number | undefined {
  return isAxiosError(error) ? error.response?.status : undefined;
}

export function roadmapErrorMessage(error: unknown): string | undefined {
  if (!isAxiosError(error) || !error.response || ![422, 502, 503].includes(error.response.status)) return;
  const message = error.response.data?.message;
  return typeof message === "string" && message.length <= 240 ? message : undefined;
}

export const learningLevelLabels: Record<LearningLevel, string> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
};
