import { moduleApi, moduleGroupApi } from "@/api";
import { usePermissions } from "@/hooks/usePermissions";
import type { ModuleDTO, ModuleGroupDTO, Pagination } from "@/types";
import { canAccessByPermission } from "@/utils/rbac.utils";
import { useQuery } from "@tanstack/react-query";

export type SidebarModule = ModuleDTO & {
    name?: string;
};

export type SidebarModuleGroup = ModuleGroupDTO & {
    modules: SidebarModule[];
};

const menuPagination: Pagination = {
    page: 0,
    size: 9999,
    sort: ["displayOrder,asc", "name,asc"],
};

const modulePagination: Pagination = {
    page: 0,
    size: 9999,
    sort: ["displayOrder,asc", "title,asc"],
};

export function useActiveModuleGroups(enabled = true) {
    const { activeRole, hasPermission } = usePermissions();

    return useQuery<SidebarModuleGroup[]>({
        queryKey: ["sidebar-menu", "active-module-groups", activeRole],
        enabled,
        queryFn: async () => {
            let groups: ModuleGroupDTO[] = [];
            let modules: ModuleDTO[] = [];

            try {
                const [groupPage, modulePage] = await Promise.all([
                    moduleGroupApi.getPage(menuPagination, undefined, { ids: [], isActive: true }),
                    moduleApi.getPage(modulePagination, undefined, { ids: [], isActive: true }),
                ]);

                const isAdmin = activeRole === "ADMIN";
                groups = groupPage.content ?? groupPage.items ?? [];
                modules = (modulePage.content ?? modulePage.items ?? []).filter((module) =>
                    isAdmin || canAccessByPermission(module.requiredPermission, hasPermission),
                );
            } catch (err) {
                console.warn("Failed to load sidebar modules from backend, loading fallback navigation:", err);
                groups = [
                    {
                        id: 1,
                        name: "Training Operations",
                        description: "Academic & Training Operations",
                        displayOrder: 1,
                        isActive: true,
                    },
                    {
                        id: 2,
                        name: "Subjects & Scheduling",
                        description: "Curriculum and Sessions",
                        displayOrder: 2,
                        isActive: true,
                    },
                ];
                modules = [
                    {
                        id: 101,
                        moduleGroupId: "1",
                        title: "Training Calendar",
                        url: "/calendar/adjust",
                        icon: "calendar",
                        displayOrder: 1,
                        requiredPermission: "SESSION_READ",
                        isActive: true,
                    },
                    {
                        id: 102,
                        moduleGroupId: "1",
                        title: "Weekly Timetable",
                        url: "/calendar/preview",
                        icon: "calendar",
                        displayOrder: 2,
                        requiredPermission: "SESSION_READ",
                        isActive: true,
                    },
                    {
                        id: 103,
                        moduleGroupId: "1",
                        title: "Class List",
                        url: "/classes",
                        icon: "graduation-cap",
                        displayOrder: 3,
                        isActive: true,
                    },
                ].filter((m) => activeRole === "ADMIN" || canAccessByPermission(m.requiredPermission, hasPermission));
            }

            const groupedModules = modules.reduce<Record<string, SidebarModule[]>>((acc, module) => {
                if (!module.moduleGroupId) return acc;

                if (!acc[module.moduleGroupId]) {
                    acc[module.moduleGroupId] = [];
                }

                acc[module.moduleGroupId].push({
                    ...module,
                    name: module.title,
                });
                return acc;
            }, {});

            // Ensure Invitation menu under Exam Management if permitted and not already in DB
            const hasInvitationInDb = modules.some((m) => m.url === "/invitations");
            if (!hasInvitationInDb && canAccessByPermission("INVITATION_READ", hasPermission)) {
                let examGroup = groups.find(
                    (g) => (g.name || "").toLowerCase() === "exam management",
                );

                if (!examGroup) {
                    const fallbackGroup: ModuleGroupDTO = {
                        id: 9999,
                        name: "Exam Management",
                        description: "Exam Management Group",
                        displayOrder: 1,
                        isActive: true,
                    };
                    groups.push(fallbackGroup);
                    examGroup = fallbackGroup;
                }

                const groupId = String(examGroup.id ?? 9999);
                if (!groupedModules[groupId]) {
                    groupedModules[groupId] = [];
                }

                groupedModules[groupId].push({
                    id: 99999,
                    moduleGroupId: groupId,
                    title: "Invitations",
                    name: "Invitations",
                    url: "/invitations",
                    icon: "mail",
                    displayOrder: 2,
                    requiredPermission: "INVITATION_READ",
                    isActive: true,
                });
            }

            // Ensure Training Operations group and its critical menus (Training Calendar & Timetable) always exist
            const isAdmin = activeRole === "ADMIN";
            const canViewSessions = isAdmin || canAccessByPermission("SESSION_READ", hasPermission);

            let trainingGroup = groups.find(
                (g) => {
                    const name = (g.name || "").toLowerCase();
                    return name === "training operations" || name === "training management";
                },
            );

            if (!trainingGroup && canViewSessions) {
                const fallbackGroup: ModuleGroupDTO = {
                    id: 9998,
                    name: "Training Operations",
                    description: "Academic & Training Operations",
                    displayOrder: 1,
                    isActive: true,
                };
                groups.push(fallbackGroup);
                trainingGroup = fallbackGroup;
            }

            if (trainingGroup && canViewSessions) {
                const groupId = String(trainingGroup.id ?? 9998);
                if (!groupedModules[groupId]) {
                    groupedModules[groupId] = [];
                }

                const hasAdjust = modules.some((m) => m.url === "/calendar/adjust" || m.url === "/schedule-versions");
                if (!hasAdjust) {
                    groupedModules[groupId].push({
                        id: 99998,
                        moduleGroupId: groupId,
                        title: "Training Calendar",
                        name: "Training Calendar",
                        url: "/calendar/adjust",
                        icon: "calendar",
                        displayOrder: 1,
                        requiredPermission: "SESSION_READ",
                        isActive: true,
                    });
                }

                const hasTimetable = modules.some((m) => m.url === "/calendar/preview" || m.url === "/calendar/timetable");
                if (!hasTimetable) {
                    groupedModules[groupId].push({
                        id: 99997,
                        moduleGroupId: groupId,
                        title: "Weekly Timetable",
                        name: "Weekly Timetable",
                        url: "/calendar/preview",
                        icon: "calendar",
                        displayOrder: 2,
                        requiredPermission: "SESSION_READ",
                        isActive: true,
                    });
                }
            }

            return groups
                .map((group) => {
                    const groupId = String(group.id ?? "");
                    const groupMods = (groupedModules[groupId] ?? []).sort(
                        (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0),
                    );
                    return {
                        ...group,
                        modules: groupMods,
                    };
                })
                .filter((group) => group.modules.length > 0);
        },
        staleTime: 5 * 60 * 1000,
    });
}
