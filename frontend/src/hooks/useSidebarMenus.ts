import { moduleApi, moduleGroupApi } from "@/api";
import { usePermissions } from "@/hooks/usePermissions";
import type { ModuleDTO, ModuleGroupDTO, Pagination } from "@/types";
import {
    canAccessByPermission,
    getMovedMenuGroupName,
    isMenuGroupHiddenInMenu,
    isModuleHiddenInMenu,
    normalizeMenuGroupName,
    normalizeModulePath,
} from "@/utils/rbac.utils";
import { useQuery } from "@tanstack/react-query";

export type SidebarModule = ModuleDTO & {
    name?: string;

    hiddenInMenu?: boolean;

    menuGroupOverride?: string;
};

export type SidebarModuleGroup = ModuleGroupDTO & {
    modules: SidebarModule[];

    hiddenInMenu?: boolean;
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

            const movedModules: SidebarModule[] = [];
            const movedUrls = new Set<string>();

            for (const group of groups) {
                const groupId = String(group.id ?? "");
                const groupMods = groupedModules[groupId] ?? [];

                for (const module of groupMods) {
                    const targetGroupName = getMovedMenuGroupName(module.url, activeRole);

                    if (!targetGroupName) continue;

                    const targetGroup = groups.find(
                        (g) => normalizeMenuGroupName(g.name) === normalizeMenuGroupName(targetGroupName),
                    );

                    if (!targetGroup) continue;

                    movedUrls.add(normalizeModulePath(module.url));
                    movedModules.push({
                        ...module,
                        moduleGroupId: String(targetGroup.id ?? ""),
                        menuGroupOverride: targetGroup.name,
                    });
                }
            }

            if (movedUrls.size > 0) {
                for (const group of groups) {
                    const groupId = String(group.id ?? "");
                    const groupMods = groupedModules[groupId] ?? [];

                    groupedModules[groupId] = groupMods.filter(
                        (m) => !movedUrls.has(normalizeModulePath(m.url)),
                    );
                }

                for (const moved of movedModules) {
                    const targetGroupId = String(moved.moduleGroupId ?? "");
                    if (!targetGroupId) continue;

                    if (!groupedModules[targetGroupId]) {
                        groupedModules[targetGroupId] = [];
                    }

                    if (groupedModules[targetGroupId].some((m) => m.url === moved.url)) {
                        continue;
                    }

                    groupedModules[targetGroupId].push(moved);
                }
            }

            return groups
                .map((group) => {
                    const groupId = String(group.id ?? "");
                    const groupMods = (groupedModules[groupId] ?? [])
                        .map((module) => ({
                            ...module,
                            hiddenInMenu:
                                module.hiddenInMenu ||
                                isModuleHiddenInMenu(module.url, activeRole) ||
                                isMenuGroupHiddenInMenu(group.name, activeRole),
                        }))
                        .sort(
                            (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0),
                        );
                    return {
                        ...group,
                        modules: groupMods,
                        hiddenInMenu: isMenuGroupHiddenInMenu(group.name, activeRole),
                    };
                })
                .filter((group) => group.modules.length > 0);
        },
        staleTime: 5 * 60 * 1000,
    });
}