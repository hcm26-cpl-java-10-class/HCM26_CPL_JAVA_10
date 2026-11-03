import axiosInstance from "@/api/axios";
import type {
    DepartmentBatchEnrollmentResult,
    DepartmentEnrollmentPreview,
    DepartmentEnrollmentResult,
    Enrollment,
} from "@/types";
import type { DepartmentMemberPage } from "@/types";
import type {
    AuditFilterOptions,
    AuditLogParams,
    AuditLogRow,
    AuditSummary,
    DepartmentLogStudent,
    PageResponse,
} from "@/types";

interface DepartmentEnrollmentRequest {
    departmentId: number;
    courseId: number;
    /** Sinh viên trong department bị loại khỏi lần assign này. */
    excludedStudentIds?: number[];
}

export interface DepartmentBatchEnrollmentRequest {
    courseId: number;
    departments: { departmentId: number; excludedStudentIds: number[] }[];
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

    /** Id các department đã được assign hết vào course (mọi sinh viên active đã enroll). */
    getAssignedDepartmentIds: async (courseId: number): Promise<number[]> => {
        const response = await axiosInstance.get<number[]>(
            "/enrollments/departments/assigned",
            { params: { courseId } },
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

    /** Xem trước kết quả khi assign nhiều department cùng lúc. */
    previewDepartments: async (
        request: DepartmentBatchEnrollmentRequest,
    ): Promise<DepartmentBatchEnrollmentResult> => {
        const response = await axiosInstance.post<DepartmentBatchEnrollmentResult>(
            "/enrollments/departments/batch/preview",
            request,
        );
        return response.data;
    },

    /** Assign nhiều department cùng lúc, trả về chi tiết từng người đã enroll. */
    enrollDepartments: async (
        request: DepartmentBatchEnrollmentRequest,
    ): Promise<DepartmentBatchEnrollmentResult> => {
        const response = await axiosInstance.post<DepartmentBatchEnrollmentResult>(
            "/enrollments/departments/batch",
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

    getAuditLogs: async (params: AuditLogParams): Promise<PageResponse<AuditLogRow>> => {
        const response = await axiosInstance.get("/audit/enrollments", { params });
        return response.data;
    },

    getAuditSummary: async (params: AuditLogParams): Promise<AuditSummary> => {
        const response = await axiosInstance.get<AuditSummary>("/audit/enrollments/summary", { params });
        return response.data;
    },

    getAuditFilterOptions: async (): Promise<AuditFilterOptions> => {
        const response = await axiosInstance.get<AuditFilterOptions>("/audit/enrollments/filter-options");
        return response.data;
    },

    /** Học viên của một lần assign department -> course (tìm kiếm + phân trang). */
    getDepartmentLogStudents: async (
        departmentId: number,
        courseId: number,
        params: { search?: string; page?: number; size?: number },
    ): Promise<PageResponse<DepartmentLogStudent>> => {
        const response = await axiosInstance.get(
            `/audit/enrollments/departments/${departmentId}/courses/${courseId}/students`,
            { params },
        );
        return response.data;
    },
};
