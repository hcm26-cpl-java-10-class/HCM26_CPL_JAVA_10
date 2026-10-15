import axiosInstance from "@/api/axios";
import type { LessonProgress } from "@/types";

export const progressApi = {
    getByEnrollment: async (enrollmentId: number): Promise<LessonProgress[]> => {
        const response = await axiosInstance.get<LessonProgress[]>(
            `/progress/enrollments/${enrollmentId}`,
        );
        return response.data;
    },

    setCompleted: async (
        enrollmentId: number,
        lessonId: number,
        completed: boolean,
    ): Promise<LessonProgress> => {
        const response = await axiosInstance.put<LessonProgress>(
            `/progress/enrollments/${enrollmentId}/lessons/${lessonId}`,
            { completed },
        );
        return response.data;
    },
};
