import axiosInstance from "@/api/axios";

export type SecurityAlertType = "RATE_LIMIT" | "REPEATED_DENIED";
export type SecurityAlertStatus = "OPEN" | "DISMISSED" | "BLOCKED";

export interface SecurityAlertDTO {
    id: number;
    type: SecurityAlertType;
    status: SecurityAlertStatus;
    userId: number | null;
    userEmail: string | null;
    ipAddress: string | null;
    requestCount: number;
    windowSeconds: number;
    lastPath: string | null;
    hits: number;
    createdAt: string;
    lastSeenAt: string;
    resolvedAt: string | null;
    resolvedBy: string | null;
    blockedUntil: string | null;
}

export interface SecurityAlertPage {
    content: SecurityAlertDTO[];
    totalElements: number;
    totalPages: number;
    number: number;
}

export interface BlockedUserDTO {
    userId: number;
    email: string;
    fullName: string | null;
    reason: string | null;
    blockedUntil: string;
}

export interface BlockUserPayload {
    days: number;
    reason?: string;
}

export const securityAlertApi = {
    getAlerts: async (
        status?: SecurityAlertStatus,
        page = 0,
        size = 20,
    ): Promise<SecurityAlertPage> => {
        const response = await axiosInstance.get<SecurityAlertPage>(
            "/security-alerts",
            { params: { status, page, size } },
        );
        return response.data;
    },

    getOpenCount: async (): Promise<number> => {
        const response = await axiosInstance.get<{ count: number }>(
            "/security-alerts/open-count",
        );
        return response.data.count;
    },

    dismiss: async (alertId: number): Promise<void> => {
        await axiosInstance.post(`/security-alerts/${alertId}/dismiss`);
    },

    getBlockedUsers: async (): Promise<BlockedUserDTO[]> => {
        const response = await axiosInstance.get<BlockedUserDTO[]>(
            "/security-alerts/blocked-users",
        );
        return response.data;
    },

    blockUser: async (
        userId: number,
        payload: BlockUserPayload,
    ): Promise<BlockedUserDTO> => {
        const response = await axiosInstance.post<BlockedUserDTO>(
            `/security-alerts/users/${userId}/block`,
            payload,
        );
        return response.data;
    },

    extendBlock: async (
        userId: number,
        payload: BlockUserPayload,
    ): Promise<BlockedUserDTO> => {
        const response = await axiosInstance.post<BlockedUserDTO>(
            `/security-alerts/users/${userId}/extend`,
            payload,
        );
        return response.data;
    },

    unblockUser: async (userId: number): Promise<void> => {
        await axiosInstance.post(`/security-alerts/users/${userId}/unblock`);
    },
};
