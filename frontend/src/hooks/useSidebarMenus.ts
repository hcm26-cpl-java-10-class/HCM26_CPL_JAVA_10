
import { isAuditAdmin } from "@/components/audit/auditAccess";
import { moduleApi, moduleGroupApi } from "@/api";
import { usePermissions } from "@/hooks/usePermissions";
import type { ModuleDTO, ModuleGroupDTO, Pagination } from "@/types";
import {
    canAccessPath,
    canAccessByPermission,
} from "@/utils/rbac.utils";
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
    const { activeRole, hasPermission, user } = usePermissions();

    return useQuery<SidebarModuleGroup[]>({
        queryKey: [
            "sidebar-menu",
            "active-module-groups",
            activeRole,
            user.email,
            user.permissions,
            user.roles,
        ],
        enabled,

        queryFn: async () => {
            let groups: ModuleGroupDTO[] = [];
            let modules: ModuleDTO[] = [];
            let hasAuditLogInDb = false;

            try {
                const [groupPage, modulePage] = await Promise.all([
                    moduleGroupApi.getPage(
                        menuPagination,
                        undefined,
                        { ids: [], isActive: true }
                    ),
                    moduleApi.getPage(
                        modulePagination,
                        undefined,
                        { ids: [], isActive: true }
                    ),
                ]);

                const isAdmin = activeRole === "ADMIN";

                groups = groupPage.content ?? groupPage.items ?? [];

                const rawModules =
                    modulePage.content ?? modulePage.items ?? [];

                hasAuditLogInDb = rawModules.some(
                    (module) => module.url === "/admin/audit-log"
                );

                modules = rawModules.filter((module) => {
                    const path = module.url ?? "";

                    // Audit Log: chỉ dành cho Audit Admin
                    if (path === "/admin/audit-log") {
                        return (
                            isAuditAdmin(user.roles) &&
                            canAccessPath(
                                path,
                                activeRole,
                                user.permissions
                            )
                        );
                    }

                    if (
                        !canAccessPath(
                            path,
                            activeRole,
                            user.permissions
                        )
                    ) {
                        return false;
                    }

                    return (
                        isAdmin ||
                        canAccessByPermission(
                            module.requiredPermission,
                            hasPermission
                        )
                    );
                });

            } catch (err) {
                console.warn(
                    "Failed to load sidebar modules from backend, loading fallback navigation:",
                    err
                );

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
                        title: "Adjust Calendar",
                        url: "/calendar/adjust",
                        icon: "calendar",
                        displayOrder: 1,
                        requiredPermission: "SESSION_READ",
                        isActive: true,
                    },
                    {
                        id: 102,
                        moduleGroupId: "1",
                        title: "Timetable",
                        url: "/calendar/preview",
                        icon: "calendar",
                        displayOrder: 2,
                        requiredPermission: "SESSION_READ",
                        isActive: true,
                    },
                    {
                        id: 103,
                        moduleGroupId: "1",
                        title: "Class Study Plans",
                        url: "/class-setup",
                        icon: "graduation-cap",
                        displayOrder: 3,
                        isActive: true,
                    },
                    {
                        id: 104,
                        moduleGroupId: "1",
                        title: "Teaching Assignments",
                        url: "/teaching-assignments",
                        icon: "users",
                        displayOrder: 4,
                        requiredPermission: "ASSIGNMENT_READ",
                        isActive: true,
                    },
                    {
                        id: 105,
                        moduleGroupId: "1",
                        title: "Training Programs",
                        url: "/programs",
                        icon: "book-open",
                        displayOrder: 5,
                        isActive: true,
                    },
                    {
                        id: 201,
                        moduleGroupId: "2",
                        title: "Study Sessions",
                        url: "/study-sessions",
                        icon: "clock",
                        displayOrder: 1,
                        requiredPermission: "STUDY_SESSION_READ",
                        isActive: true,
                    },
                    {
                        id: 202,
                        moduleGroupId: "2",
                        title: "Subjects",
                        url: "/subjects",
                        icon: "book",
                        displayOrder: 2,
                        isActive: true,
                    },
                ].filter(
                    (module) =>
                        activeRole === "ADMIN" ||
                        canAccessByPermission(
                            module.requiredPermission,
                            hasPermission
                        )
                );
            }

            // Group modules
            const groupedModules = modules.reduce<
                Record<string, SidebarModule[]>
            >((acc, module) => {
                if (!module.moduleGroupId) {
                    return acc;
                }

                const groupId = String(module.moduleGroupId);

                if (!acc[groupId]) {
                    acc[groupId] = [];
                }

                acc[groupId].push({
                    ...module,
                    name: module.title,
                });

                return acc;
            }, {});

            // Ensure Invitation menu under Exam Management
            const hasInvitationInDb = modules.some(
                (module) => module.url === "/invitations"
            );

            if (
                !hasInvitationInDb &&
                canAccessByPermission("INVITATION_READ", hasPermission)
            ) {
                let examGroup = groups.find(
                    (group) =>
                        (group.name || "").toLowerCase() ===
                        "exam management"
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

            // Ensure Audit Log menu under RBAC Management
            if (
                !hasAuditLogInDb &&
                isAuditAdmin(user.roles) &&
                canAccessPath(
                    "/admin/audit-log",
                    activeRole,
                    user.permissions
                )
            ) {
                let rbacGroup = groups.find(
                    (group) =>
                        (group.name || "").toLowerCase() ===
                        "rbac management"
                );

                if (!rbacGroup) {
                    const fallbackGroup: ModuleGroupDTO = {
                        id: 9996,
                        name: "RBAC Management",
                        description: "Role-based Access Control",
                        displayOrder: 3,
                        isActive: true,
                    };

                    groups.push(fallbackGroup);
                    rbacGroup = fallbackGroup;
                }

                const groupId = String(rbacGroup.id ?? 9996);

                if (!groupedModules[groupId]) {
                    groupedModules[groupId] = [];
                }

                groupedModules[groupId].push({
                    id: 99996,
                    moduleGroupId: groupId,
                    title: "Audit Log",
                    name: "Audit Log",
                    url: "/admin/audit-log",
                    icon: "history",
                    displayOrder: 3,
                    isActive: true,
                });
            }

            // Ensure Training Operations and critical menus exist
            const isAdmin = activeRole === "ADMIN";

            const canViewSessions =
                isAdmin ||
                canAccessByPermission("SESSION_READ", hasPermission);

            let trainingGroup = groups.find(
                (group) =>
                    (group.name || "").toLowerCase() ===
                    "training operations"
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

                const hasAdjust = modules.some(
                    (module) =>
                        module.url === "/calendar/adjust" ||
                        module.url === "/schedule-versions"
                );

                if (!hasAdjust) {
                    groupedModules[groupId].push({
                        id: 99998,
                        moduleGroupId: groupId,
                        title: "Adjust Calendar",
                        name: "Adjust Calendar",
                        url: "/calendar/adjust",
                        icon: "calendar",
                        displayOrder: 1,
                        requiredPermission: "SESSION_READ",
                        isActive: true,
                    });
                }

                const hasTimetable = modules.some(
                    (module) =>
                        module.url === "/calendar/preview" ||
                        module.url === "/calendar/timetable"
                );

                if (!hasTimetable) {
                    groupedModules[groupId].push({
                        id: 99997,
                        moduleGroupId: groupId,
                        title: "Timetable",
                        name: "Timetable",
                        url: "/calendar/preview",
                        icon: "calendar",
                        displayOrder: 2,
                        requiredPermission: "SESSION_READ",
                        isActive: true,
                    });
                }
            }

            // Return grouped modules
            return groups
                .map((group) => {
                    const groupId = String(group.id ?? "");

                    const groupMods = (
                        groupedModules[groupId] ?? []
                    ).sort(
                        (a, b) =>
                            (a.displayOrder ?? 0) -
                            (b.displayOrder ?? 0)
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
