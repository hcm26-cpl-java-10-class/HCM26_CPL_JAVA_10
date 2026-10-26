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
        /**
         * Keep the previous role's menu while the new role's menu is loading.
         * The App builds the module driven routes from this data: dropping it
         * for a frame sends the current URL to the catch-all 404 route right
         * after a role switch.
         */
        placeholderData: (previousData) => previousData,
        queryFn: async () => {
            const [groupPage, modulePage] = await Promise.all([
                moduleGroupApi.getPage(menuPagination, undefined, { ids: [], isActive: true }),
                moduleApi.getPage(modulePagination, undefined, { ids: [], isActive: true }),
            ]);

            const groups = groupPage.content ?? groupPage.items ?? [];
            const modules = (modulePage.content ?? modulePage.items ?? []).filter((module) => {
                const url = module.url ?? "";
                const isExcludedPath = [
                    "/management/project-templates",
                    "/project-templates",
                    "/management/project-teams",
                ].some((path) => url.startsWith(path));

                return (
                    !isExcludedPath &&
                    url !== "/team-allocation" &&
                    canAccessByPermission(module.requiredPermission, hasPermission)
                );
            });

            const groupedModules = modules.reduce<Record<string, SidebarModule[]>>((acc, module) => {
                if (!module.moduleGroupId) return acc;

                if (!acc[module.moduleGroupId]) {
                    acc[module.moduleGroupId] = [];
                }

                acc[module.moduleGroupId].push({
                    ...module,
                    title: ["/management/workspaces/candidates", "/workspaces/candidates"].includes(module.url ?? "") ? "Workspace" : module.title,
                    name: ["/management/workspaces/candidates", "/workspaces/candidates"].includes(module.url ?? "") ? "Workspace" : module.title,
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

            if (
                canAccessByPermission("PEO_TEAM_ALLOCATE", hasPermission) ||
                canAccessByPermission("PRJ_WORKSPACE_MANAGE", hasPermission)
            ) {
                const moduleGroup = groups.find(
                    (group) => (group.name ?? "").toLowerCase() === "project management",
                );
                const allocationModule: SidebarModule = {
                    id: 100001,
                    moduleGroupId: String(moduleGroup?.id ?? 100000),
                    title: "Phân nhóm dự án",
                    name: "Phân nhóm dự án",
                    url: "/team-allocation",
                    icon: "users",
                    displayOrder: 1,
                    requiredPermission: canAccessByPermission(
                        "PEO_TEAM_ALLOCATE",
                        hasPermission,
                    )
                        ? "PEO_TEAM_ALLOCATE"
                        : "PRJ_WORKSPACE_MANAGE",
                    isActive: true,
                };
                if (moduleGroup) {
                    const groupId = String(moduleGroup.id ?? "");
                    if (!groupedModules[groupId]) groupedModules[groupId] = [];
                    groupedModules[groupId].push(allocationModule);
                } else {
                    const fallbackGroup: ModuleGroupDTO = {
                        id: 100000,
                        name: "Project Management",
                        description: "Project and team allocation",
                        displayOrder: 1,
                        isActive: true,
                    };
                    groups.push(fallbackGroup);
                    groupedModules[String(fallbackGroup.id)] = [allocationModule];
                }
            }

            // Ensure Workspace Candidate menu is available for testing even when backend menu table is not yet updated
            const hasWorkspaceMenu = modules.some(
                (m) => m.url === "/management/workspaces/candidates" || m.url === "/workspaces/candidates",
            );
            if (!hasWorkspaceMenu && canAccessByPermission("WORKSPACE_READ", hasPermission)) {
                const fallbackGroup = groups.find((g) => (g.name || "").toLowerCase() === "project management")
                    ?? groups.find((g) => (g.name || "").toLowerCase() === "exam management")
                    ?? groups[0];

                const targetGroup = fallbackGroup ?? {
                    id: 99998,
                    name: "Project Management",
                    description: "Project Management Group",
                    displayOrder: 100,
                    isActive: true,
                };

                if (!groups.some((g) => (g.id ?? "") === (targetGroup.id ?? ""))) {
                    groups.push(targetGroup);
                }

                const groupId = String(targetGroup.id ?? 99998);
                if (!groupedModules[groupId]) {
                    groupedModules[groupId] = [];
                }

                groupedModules[groupId].push({
                    id: 99998,
                    moduleGroupId: groupId,
                    title: "Workspace",
                    name: "Workspace",
                    url: "/management/workspaces/candidates",
                    icon: "folder",
                    displayOrder: 999,
                    requiredPermission: "WORKSPACE_READ",
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
