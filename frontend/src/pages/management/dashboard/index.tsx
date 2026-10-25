import { KeyRound, ListChevronsUpDown, Menu, Users } from "lucide-react";
import React, { useEffect, useState } from "react";
import { dashboardApi, type DashboardStats } from "../../../api/features/dashboard.api";
import { MainLayout } from "../../../components/layout/MainLayout";
import { usePermissions } from "@/hooks/usePermissions";

export const Dashboard: React.FC = () => {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const { effectivePermissions } = usePermissions();

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        try {
            const data = await dashboardApi.getStats();
            setStats(data);
        } catch (error) {
            console.error("Error loading dashboard stats:", error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <MainLayout>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-4">
                <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-600">Total Users</p>
                            <p className="text-3xl font-bold text-gray-900 mt-2">
                                {isLoading ? "..." : stats?.totalUsers || 0}
                            </p>
                            <p className="text-sm text-gray-500 mt-1">{stats?.activeUsers || 0} active</p>
                        </div>
                        <div className="text-4xl">
                            <Users />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-600">Total Roles</p>
                            <p className="text-3xl font-bold text-gray-900 mt-2">
                                {isLoading ? "..." : stats?.totalRoles || 0}
                            </p>
                            <p className="text-sm text-gray-500 mt-1">{stats?.activeRoles || 0} active</p>
                        </div>
                        <div className="text-4xl">
                            <KeyRound />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-600">Total Menus</p>
                            <p className="text-3xl font-bold text-gray-900 mt-2">
                                {isLoading ? "..." : stats?.totalMenus || 0}
                            </p>
                            <p className="text-sm text-gray-500 mt-1">{stats?.activeMenus || 0} active</p>
                        </div>
                        <div className="text-4xl">
                            <Menu />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-600">Menu Items</p>
                            <p className="text-3xl font-bold text-gray-900 mt-2">
                                {isLoading ? "..." : stats?.totalMenuItems || 0}
                            </p>
                            <p className="text-sm text-gray-500 mt-1">Navigation items</p>
                        </div>
                        <div className="text-4xl">
                            <ListChevronsUpDown />
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-8 bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Permissions</h3>
                <div className="flex flex-wrap gap-2">
                    {effectivePermissions.map((permission) => (
                        <span key={permission} className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                            {permission}
                        </span>
                    ))}
                </div>
            </div>
        </MainLayout>
    );
};
