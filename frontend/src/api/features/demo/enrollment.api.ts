import axiosInstance from "@/api/axios";
import type { DepartmentEnrollmentPreview, DepartmentEnrollmentResult, Enrollment } from "@/types";
import type { DepartmentMemberPage } from "@/types";

interface DepartmentEnrollmentRequest {
    departmentId: number;
    courseId: number;
}

interface StudentEnrollmentRequest {
    studentId: number;
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

    getDepartmentStudentCourses: async (
        departmentId: number,
        studentId: number,
    ): Promise<Enrollment[]> => {
        const response = await axiosInstance.get<Enrollment[]>(
            `/departments/${departmentId}/members/${studentId}/courses`,
        );
        return response.data;
    },

    searchStudents: async (
        page: number,
        search: string,
    ): Promise<DepartmentMemberPage> => {
        const response = await axiosInstance.get<DepartmentMemberPage>(
            "/enrollments/students",
            { params: { page, size: 20, sort: "firstName,asc", search: search || undefined } },
        );
        return response.data;
    },

    getStudentCourses: async (studentId: number): Promise<Enrollment[]> => {
        const response = await axiosInstance.get<Enrollment[]>(
            `/enrollments/students/${studentId}/courses`,
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

    enrollStudent: async (
        request: StudentEnrollmentRequest,
    ): Promise<Enrollment> => {
        const response = await axiosInstance.post<Enrollment>(
            "/enrollments/students",
            request,
        );
        return response.data;
    },
};