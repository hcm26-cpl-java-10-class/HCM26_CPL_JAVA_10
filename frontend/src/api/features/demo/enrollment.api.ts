import axiosInstance from "@/api/axios";
import type { Enrollment } from "@/types";

export const enrollmentApi = {
    enroll: async (courseId: number): Promise<Enrollment> => {
        const response = await axiosInstance.post<Enrollment>(
            "/enrollments",
            { courseId },
        );
        return response.data;
    },

    getMyCourses: async (): Promise<Enrollment[]> => {
        const response = await axiosInstance.get<Enrollment[]>(
            "/enrollments/my-courses",
        );
        return response.data;
    },

    cancel: async (enrollmentId: number): Promise<void> => {
        await axiosInstance.delete(`/enrollments/${enrollmentId}`);
    },
};