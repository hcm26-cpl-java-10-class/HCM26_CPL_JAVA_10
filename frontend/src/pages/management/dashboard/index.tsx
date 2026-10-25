import { ArrowRight, FileCheck2, Flag, KeyRound, ListChevronsUpDown, Menu, Users } from "lucide-react";
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { dashboardApi, type DashboardStats } from "../../../api/features/dashboard.api";
import { MainLayout } from "../../../components/layout/MainLayout";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";

export const Dashboard: React.FC = () => {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const { effectivePermissions } = usePermissions();
    const milestoneProjectId = import.meta.env.VITE_MILESTONE_MOCK_PROJECT_ID
        || "11111111-1111-1111-1111-111111111111";

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

            <section className="mt-8">
                <div className="mb-4">
                    <h2 className="text-lg font-semibold text-gray-900">Project workspace</h2>
                    <p className="mt-1 text-sm text-gray-500">
                        Milestones and rubrics are available to every signed-in team member.
                    </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                    <article className="rounded-xl border bg-white p-5 shadow-sm">
                        <div className="flex size-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                            <Flag className="size-5" />
                        </div>
                        <h3 className="mt-4 font-semibold text-gray-900">Milestones</h3>
                        <p className="mt-1 text-sm text-gray-500">
                            Plan delivery deadlines, acceptance checklists, and evaluation settings.
                        </p>
                        <Button asChild className="mt-4">
                            <Link to={`/projects/${milestoneProjectId}/milestones`}>
                                Open milestones <ArrowRight className="size-4" />
                            </Link>
                        </Button>
                    </article>

                    <article className="rounded-xl border bg-white p-5 shadow-sm">
                        <div className="flex size-10 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
                            <FileCheck2 className="size-5" />
                        </div>
                        <h3 className="mt-4 font-semibold text-gray-900">Rubrics</h3>
                        <p className="mt-1 text-sm text-gray-500">
                            Create, publish, and manage reusable milestone evaluation criteria.
                        </p>
                        <Button asChild className="mt-4">
                            <Link to="/rubrics">
                                Open rubrics <ArrowRight className="size-4" />
                            </Link>
                        </Button>
                    </article>
                </div>
            </section>

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
