import axiosInstance from "@/api/axios";
import type { CompletionRule, CoursePrerequisite } from "@/types/features/demo/course-policy";

const base = (courseId: number) => `/courses/${courseId}/policy`;

export const coursePolicyApi = {
  getCompletionRule: async (courseId: number): Promise<CompletionRule> =>
    (await axiosInstance.get<CompletionRule>(`${base(courseId)}/completion-rule`)).data,

  saveCompletionRule: async (
    courseId: number,
    rule: Pick<CompletionRule, "minLessonPercent" | "requireAssessmentsPass">,
  ): Promise<CompletionRule> =>
    (await axiosInstance.put<CompletionRule>(`${base(courseId)}/completion-rule`, rule)).data,

  getPrerequisites: async (courseId: number): Promise<CoursePrerequisite[]> =>
    (await axiosInstance.get<CoursePrerequisite[]>(`${base(courseId)}/prerequisites`)).data,

  addPrerequisite: async (courseId: number, prerequisiteCourseId: number): Promise<CoursePrerequisite[]> =>
    (await axiosInstance.post<CoursePrerequisite[]>(`${base(courseId)}/prerequisites`, { prerequisiteCourseId })).data,

  removePrerequisite: async (courseId: number, prerequisiteCourseId: number): Promise<void> => {
    await axiosInstance.delete(`${base(courseId)}/prerequisites/${prerequisiteCourseId}`);
  },
};

export const prerequisitesQueryKey = (courseId: number) => ["course-prerequisites", courseId] as const;
