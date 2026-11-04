import { moduleApi, moduleGroupApi } from "@/api";
import { usePermissions } from "@/hooks/usePermissions";
import type { ModuleDTO, ModuleGroupDTO, Pagination } from "@/types";
import {
    ADMIN_ROLE,
    normalizeRole,
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
    const { activeRole, hasPermission } = usePermissions();

    return useQuery<SidebarModuleGroup[]>({
        queryKey: ["sidebar-menu", "active-module-groups", activeRole],
        enabled,
        queryFn: async () => {
            const [groupPage, modulePage] = await Promise.all([
                moduleGroupApi.getPage(menuPagination, undefined, { ids: [], isActive: true }),
                moduleApi.getPage(modulePagination, undefined, { ids: [], isActive: true }),
            ]);

            const groups = groupPage.content ?? groupPage.items ?? [];
            const modules = (modulePage.content ?? modulePage.items ?? []).filter((module) => {
                if (
                    module.url === "/admin/audit-log" &&
                    normalizeRole(activeRole) === ADMIN_ROLE
                ) {
                    return true;
                }

                return canAccessByPermission(module.requiredPermission, hasPermission);
            });

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

            // Ensure Audit Log menu under RBAC Management if permitted and not already in DB
            const hasAuditLogInDb = modules.some((m) => m.url === "/admin/audit-log");

            if (
                !hasAuditLogInDb &&
                normalizeRole(activeRole) === ADMIN_ROLE
            ) {
                let rbacGroup = groups.find(
                    (g) => (g.name || "").toLowerCase() === "rbac management",
                );

                if (!rbacGroup) {
                    const fallbackGroup: ModuleGroupDTO = {
                        id: 10000,
                        name: "RBAC Management",
                        description: "Role-Based Access Control",
                        displayOrder: 5,
                        isActive: true,
                    };

                    groups.push(fallbackGroup);
                    rbacGroup = fallbackGroup;
                }

                const groupId = String(rbacGroup.id ?? 10000);

                if (!groupedModules[groupId]) {
                    groupedModules[groupId] = [];
                }

                groupedModules[groupId].push({
                    id: 100000,
                    moduleGroupId: groupId,
                    title: "Audit Log",
                    name: "Audit Log",
                    url: "/admin/audit-log",
                    icon: "history",
                    displayOrder: 4,
                    requiredPermission: "ADMIN",
                    isActive: true,
                });
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
