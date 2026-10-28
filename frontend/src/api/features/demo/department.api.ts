import axiosInstance from "@/api/axios";
import { createBaseApiService } from "@/api/base-service.api";
import type {
    DepartmentDTO,
    DepartmentFilter,
    DepartmentMemberPage,
    DepartmentStats,
} from "@/types";

export interface BulkMembershipResult {
    succeeded: number[];
    failed: number[];
}

const BULK_BATCH_SIZE = 5;

async function runBulk(
    userIds: number[],
    request: (userId: number) => Promise<unknown>,
): Promise<BulkMembershipResult> {
    const result: BulkMembershipResult = { succeeded: [], failed: [] };
    for (let i = 0; i < userIds.length; i += BULK_BATCH_SIZE) {
        const batch = userIds.slice(i, i + BULK_BATCH_SIZE);
        const settled = await Promise.allSettled(batch.map(request));
        settled.forEach((outcome, index) => {
            (outcome.status === "fulfilled" ? result.succeeded : result.failed).push(batch[index]);
        });
    }
    return result;
}

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
    /** Thêm nhiều sinh viên cùng lúc (gọi lần lượt từng lô nhỏ, không dừng khi có lỗi). */
    assignStudents: (departmentId: number, userIds: number[]): Promise<BulkMembershipResult> =>
        runBulk(userIds, (userId) =>
            axiosInstance.put(`/departments/${departmentId}/members/${userId}`),
        ),
    /** Xóa nhiều sinh viên khỏi department cùng lúc. */
    removeStudents: (departmentId: number, userIds: number[]): Promise<BulkMembershipResult> =>
        runBulk(userIds, (userId) =>
            axiosInstance.delete(`/departments/${departmentId}/members/${userId}`),
        ),
});