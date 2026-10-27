
import axiosInstance from "@/api/axios";

export interface AuditLogDTO {
    id: number;
    actorId: number | null;
    actorEmail: string | null;
    action: string;
    entityType: string;
    entityId: string | null;
    oldValue: string | null;
    newValue: string | null;
    correlationId: string | null;
    result: string | null;
    createdAt: string;
}

export interface AuditLogFilter {
    actorName?: string;
    action?: string;
    entityType?: string;
    result?: string;
    fromDate?: string;
    toDate?: string;
    page?: number;
    size?: number;
}

export interface AuditLogPage {
    content: AuditLogDTO[];
    totalPages: number;
    totalElements: number;
    number: number;
    size: number;
    first: boolean;
    last: boolean;
    empty: boolean;
}

export const auditLogApi = {
    getPage: async (
        filter: AuditLogFilter = {},
    ): Promise<AuditLogPage> => {
        const params = Object.fromEntries(
            Object.entries(filter).filter(
                ([, value]) => value !== undefined && value !== "",
            ),
        );

        const response = await axiosInstance.get<AuditLogPage>(
            "/audit-logs",
            { params },
        );

        return response.data;
    },

    getAll: async (
        filter: AuditLogFilter = {},
    ): Promise<AuditLogDTO[]> => {
        const firstPage = await auditLogApi.getPage({
            ...filter,
            page: 0,
        });

        const allLogs = [...firstPage.content];

        for (let page = 1; page < firstPage.totalPages; page++) {
            const result = await auditLogApi.getPage({
                ...filter,
                page,
                size: firstPage.size,
            });

            allLogs.push(...result.content);
        }

        return allLogs;
    },
};
