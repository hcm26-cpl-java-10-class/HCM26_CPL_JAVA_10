import axiosInstance from "@/api/axios";
import { createBaseApiService } from "@/api/base-service.api";
import type {
    DepartmentDTO,
    DepartmentFilter,
    DepartmentMemberPage,
    DepartmentStats,
} from "@/types";

const base = createBaseApiService<DepartmentDTO, DepartmentFilter>({
    path: "/departments",
});

export const departmentApi = Object.assign({}, base, {
    getStats: async (departmentId: number): Promise<DepartmentStats> => {
        const response = await axiosInstance.get<DepartmentStats>(
            `/departments/${departmentId}/stats`,
        );
        return response.data;
    },
    getMembers: async (
        departmentId: number,
        page: number,
        search: string,
    ): Promise<DepartmentMemberPage> => {
        const response = await axiosInstance.get<DepartmentMemberPage>(
            `/departments/${departmentId}/members`,
            { params: { page, size: 10, sort: "firstName,asc", search: search || undefined } },
        );
        return response.data;
    },
    getAvailableStudents: async (
        departmentId: number,
        page: number,
        search: string,
    ): Promise<DepartmentMemberPage> => {
        const response = await axiosInstance.get<DepartmentMemberPage>(
            `/departments/${departmentId}/available-students`,
            { params: { page, size: 10, sort: "firstName,asc", search: search || undefined } },
        );
        return response.data;
    },
    assignStudent: async (departmentId: number, userId: number): Promise<void> => {
        await axiosInstance.put(`/departments/${departmentId}/members/${userId}`);
    },
    removeStudent: async (departmentId: number, userId: number): Promise<void> => {
        await axiosInstance.delete(`/departments/${departmentId}/members/${userId}`);
    },
});