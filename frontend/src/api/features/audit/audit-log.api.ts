
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
    keyword?: string;
    fromDate?: string;
    toDate?: string;
    page?: number;
    size?: number;
}

export interface AuditLogFilterOptions {
    actions: string[];
    entityTypes: string[];
}

export interface AuditStatsBucket {
    key: string;
    count: number;
}

export interface AuditStatsDay {
    date: string;
    total: number;
    failures: number;
}

export interface AuditStats {
    fromDate: string;
    toDate: string;
    total: number;
    failures: number;
    byDay: AuditStatsDay[];
    byAction: AuditStatsBucket[];
    byEntityType: AuditStatsBucket[];
    byResult: AuditStatsBucket[];
    topActors: AuditStatsBucket[];
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

    getStats: async (params: {
        fromDate?: string;
        toDate?: string;
    }): Promise<AuditStats> => {
        const response = await axiosInstance.get<AuditStats>(
            "/audit-logs/stats",
            { params },
        );

        return response.data;
    },

    getFilterOptions: async (): Promise<AuditLogFilterOptions> => {
        const response = await axiosInstance.get<AuditLogFilterOptions>(
            "/audit-logs/filter-options",
        );

        return response.data;
    },

    getEntityHistory: async (
        entityType: string,
        entityId: string | number,
        page = 0,
        size = 20,
    ): Promise<AuditLogPage> => {
        const response = await axiosInstance.get<AuditLogPage>(
            `/audit-logs/entity/${encodeURIComponent(entityType)}/${encodeURIComponent(String(entityId))}`,
            { params: { page, size } },
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
