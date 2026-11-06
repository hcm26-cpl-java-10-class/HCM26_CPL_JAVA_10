import axiosInstance from "@/api/axios";
import type { EnrollmentProgress, LessonProgressItem } from "@/types";

export const progressApi = {
  getByEnrollment: async (enrollmentId: number): Promise<EnrollmentProgress> => {
    const response = await axiosInstance.get<EnrollmentProgress>(
      `/progress/enrollments/${enrollmentId}`,
    );
    return response.data;
  },

  setCompleted: async (
    enrollmentId: number,
    lessonId: number,
    completed: boolean,
  ): Promise<EnrollmentProgress> => {
    const response = await axiosInstance.put<EnrollmentProgress>(
      `/progress/enrollments/${enrollmentId}/lessons/${lessonId}`,
      { completed },
    );
    return response.data;
  },

  recordAccess: async (
    enrollmentId: number,
    lessonId: number,
  ): Promise<EnrollmentProgress> => {
    const response = await axiosInstance.put<EnrollmentProgress>(
      `/progress/enrollments/${enrollmentId}/lessons/${lessonId}/access`,
    );
    return response.data;
  },

  saveAnswer: async (
    enrollmentId: number,
    lessonId: number,
    answer: string,
  ): Promise<EnrollmentProgress> => {
    const response = await axiosInstance.put<EnrollmentProgress>(
      `/progress/enrollments/${enrollmentId}/lessons/${lessonId}/answer`,
      { answer },
    );
    return response.data;
  },

  getLastLesson: async (enrollmentId: number): Promise<LessonProgressItem> => {
    const response = await axiosInstance.get<LessonProgressItem>(
      `/progress/enrollments/${enrollmentId}/last-lesson`,
    );
    return response.data;
  },
};
