import { moduleApi, moduleGroupApi } from "@/api";
import { usePermissions } from "@/hooks/usePermissions";
import type { ModuleDTO, ModuleGroupDTO, Pagination } from "@/types";
import { canAccessByPermission, normalizeRole, STUDENT_ROLE } from "@/utils/rbac.utils";
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
            const modules = (modulePage.content ?? modulePage.items ?? []).filter((module) =>
                canAccessByPermission(module.requiredPermission, hasPermission),
            );

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

            if (canAccessByPermission("PEO_TEAM_ALLOCATE", hasPermission)) {
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
                    requiredPermission: "PEO_TEAM_ALLOCATE",
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

            // US-09: the Project Template module is not seeded in the backend
            // yet, so expose the mock Explore Projects catalogue under the
            // "Project Management" tab for students.
            if (normalizeRole(activeRole) === STUDENT_ROLE) {
                const exploreUrl = "/student/projects/explore";
                const alreadyRegistered = modules.some((module) => module.url === exploreUrl);

                if (!alreadyRegistered) {
                    const projectGroup = groups.find(
                        (group) => (group.name ?? "").toLowerCase() === "project management",
                    );
                    const exploreModule: SidebarModule = {
                        id: 100002,
                        moduleGroupId: String(projectGroup?.id ?? 100000),
                        title: "Explore Projects",
                        name: "Explore Projects",
                        url: exploreUrl,
                        icon: "folder",
                        description: "Browse active project templates for your class",
                        displayOrder: 2,
                        isActive: true,
                    };

                    if (projectGroup) {
                        const groupId = String(projectGroup.id ?? "");
                        if (!groupedModules[groupId]) groupedModules[groupId] = [];
                        groupedModules[groupId].push(exploreModule);
                    } else {
                        const fallbackGroup: ModuleGroupDTO = {
                            id: 100000,
                            name: "Project Management",
                            description: "Project and team allocation",
                            displayOrder: 1,
                            isActive: true,
                        };
                        groups.push(fallbackGroup);
                        groupedModules[String(fallbackGroup.id)] = [exploreModule];
                    }
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
