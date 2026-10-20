import axiosInstance from "@/api/axios";
import type { DepartmentEnrollmentPreview, DepartmentEnrollmentResult, Enrollment } from "@/types";

interface DepartmentEnrollmentRequest {
    departmentId: number;
    courseId: number;
}

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

    previewDepartment: async (
        request: DepartmentEnrollmentRequest,
    ): Promise<DepartmentEnrollmentPreview> => {
        const response = await axiosInstance.post<DepartmentEnrollmentPreview>(
            "/enrollments/departments/preview",
            request,
        );
        return response.data;
    },

    enrollDepartment: async (
        request: DepartmentEnrollmentRequest,
    ): Promise<DepartmentEnrollmentResult> => {
        const response = await axiosInstance.post<DepartmentEnrollmentResult>(
            "/enrollments/departments",
            request,
        );
        return response.data;
    },
};