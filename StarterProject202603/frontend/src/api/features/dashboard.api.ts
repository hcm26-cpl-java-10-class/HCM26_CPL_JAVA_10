import axiosInstance from "../axios";

export interface DashboardStats {
    totalUsers: number;
    totalRoles: number;
    totalMenus: number;
    totalMenuItems: number;
    activeUsers: number;
    activeRoles: number;
    activeMenus: number;
}

export const dashboardApi = {
    getStats: async (): Promise<DashboardStats> => {
        const response = await axiosInstance.get<DashboardStats>("/dashboard/stats");
        return response.data;
    },
};
