import { moduleApi, moduleGroupApi } from "@/api";
import { usePermissions } from "@/hooks/usePermissions";
import type { ModuleDTO, ModuleGroupDTO, Pagination } from "@/types";
import { canAccessByPermission, normalizeRole, ADMIN_ROLE, STUDENT_ROLE } from "@/utils/rbac.utils";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

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
    const { activeRole, effectivePermissions, hasPermission } = usePermissions();
    const permissionCacheKey = useMemo(
        () => [...effectivePermissions].sort().join("|"),
        [effectivePermissions],
    );

    return useQuery<SidebarModuleGroup[]>({
        queryKey: ["sidebar-menu", "active-module-groups", activeRole, permissionCacheKey],
        enabled: enabled && !!activeRole,
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

                const menuTitle = module.url === "/tasks"
                    ? "Tasks"
                    : ["/management/workspaces/candidates", "/workspaces/candidates"].includes(module.url ?? "")
                        ? "Workspace"
                        : module.title;

                acc[module.moduleGroupId].push({
                    ...module,
                    title: menuTitle,
                    name: menuTitle,
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

            // US-09: the Project Template module is not seeded in the backend
            // yet, so expose the mock Explore Projects catalogue under the
            // "Project Management" tab for students.
            if (normalizeRole(activeRole) === STUDENT_ROLE) {
                const exploreUrl = "/student/projects/explore";
                const alreadyRegistered = modules.some((module) => module.url === exploreUrl);

                if (!alreadyRegistered) {
                    const exploreGroup = groups.find(
                        (group) => (group.name ?? "").toLowerCase() === "project management",
                    );
                    const exploreModule: SidebarModule = {
                        id: 100005,
                        moduleGroupId: String(exploreGroup?.id ?? 100000),
                        title: "Explore Projects",
                        name: "Explore Projects",
                        url: exploreUrl,
                        icon: "folder",
                        description: "Browse active project templates for your class",
                        displayOrder: 2,
                        isActive: true,
                    };

                    if (exploreGroup) {
                        const groupId = String(exploreGroup.id ?? "");
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

                // US-10: team leaders assign the official project template to
                // their own DRAFT teams.
                const draftTeamUrl = "/student/draft-team";
                const draftTeamRegistered = modules.some(
                    (module) => module.url === draftTeamUrl,
                );

                if (!draftTeamRegistered) {
                    const draftTeamGroup = groups.find(
                        (group) => (group.name ?? "").toLowerCase() === "project management",
                    );
                    const draftTeamModule: SidebarModule = {
                        id: 100007,
                        moduleGroupId: String(draftTeamGroup?.id ?? 100000),
                        title: "Nhóm nháp của tôi",
                        name: "Nhóm nháp của tôi",
                        url: draftTeamUrl,
                        icon: "users",
                        description: "Assign the official project template to your draft team",
                        displayOrder: 3,
                        isActive: true,
                    };

                    if (draftTeamGroup) {
                        const groupId = String(draftTeamGroup.id ?? "");
                        if (!groupedModules[groupId]) groupedModules[groupId] = [];
                        groupedModules[groupId].push(draftTeamModule);
                    } else {
                        const fallbackGroup: ModuleGroupDTO = {
                            id: 100000,
                            name: "Project Management",
                            description: "Project and team allocation",
                            displayOrder: 1,
                            isActive: true,
                        };
                        groups.push(fallbackGroup);
                        groupedModules[String(fallbackGroup.id)] = [draftTeamModule];
                    }
                }
            }

            let projectGroup = groups.find(
                (group) => (group.name ?? "").toLowerCase() === "project management",
            );

            if (!projectGroup) {
                projectGroup = {
                    id: 100000,
                    name: "Project Management",
                    description: "Project management workspace",
                    displayOrder: 1,
                    isActive: true,
                };
                groups.push(projectGroup);
            }

            const projectGroupId = String(projectGroup.id ?? 100000);
            if (!groupedModules[projectGroupId]) {
                groupedModules[projectGroupId] = [];
            }

            if (!modules.some((module) => module.url === "/project-board")) {
                groupedModules[projectGroupId].push({
                    id: 100004,
                    moduleGroupId: projectGroupId,
                    title: "Kanban Board",
                    name: "Kanban Board",
                    url: "/project-board",
                    icon: "layers",
                    displayOrder: 2.5,
                    isActive: true,
                });
            }

            const milestoneProjectId = import.meta.env.VITE_MILESTONE_MOCK_PROJECT_ID
                || "1";
            const projectWorkspaceModules: SidebarModule[] = [
                {
                    id: 100002,
                    moduleGroupId: projectGroupId,
                    title: "Milestones",
                    name: "Milestones",
                    url: `/projects/${milestoneProjectId}/milestones`,
                    icon: "bookmark",
                    displayOrder: 3,
                    isActive: true,
                },
                {
                    id: 100003,
                    moduleGroupId: projectGroupId,
                    title: "Rubrics",
                    name: "Rubrics",
                    url: "/rubrics",
                    icon: "file-text",
                    displayOrder: 4,
                    isActive: true,
                },
            ];

            for (const projectModule of projectWorkspaceModules) {
                const alreadyExists = modules.some((module) => module.url === projectModule.url)
                    || groupedModules[projectGroupId].some((module) => module.url === projectModule.url);

                if (!alreadyExists) {
                    groupedModules[projectGroupId].push(projectModule);
                }
            }

            // US-07 / US-08: `/project-template-versions` is rendered as an entity
            // route, which is module driven - the menu row is what makes the path
            // reachable at all. The backend `@ResourceMenu` on the snapshot entity
            // seeds that row, but databases created before the annotation existed
            // never receive it, so the button is injected here to keep it visible
            // for ADMIN and STUDENT.
            const templateVersionUrl = "/project-template-versions";
            const canBrowseTemplateVersions =
                normalizeRole(activeRole) === ADMIN_ROLE ||
                normalizeRole(activeRole) === STUDENT_ROLE ||
                canAccessByPermission("PROJECT_TEMPLATE_VERSION_READ", hasPermission);
            const hasTemplateVersionMenu =
                modules.some((module) => module.url === templateVersionUrl) ||
                groupedModules[projectGroupId].some((module) => module.url === templateVersionUrl);

            if (canBrowseTemplateVersions && !hasTemplateVersionMenu) {
                groupedModules[projectGroupId].push({
                    id: 100006,
                    moduleGroupId: projectGroupId,
                    title: "Project Template Versions",
                    name: "Project Template Versions",
                    url: templateVersionUrl,
                    icon: "layers",
                    description: "Create, version and publish project templates",
                    displayOrder: 4.5,
                    isActive: true,
                });
            }

            // Ensure Workspace Candidate menu is available for testing even when backend menu table is not yet updated
            const hasWorkspaceMenu = modules.some(
                (m) => m.url === "/management/workspaces/candidates" || m.url === "/workspaces/candidates",
            );
            if (!hasWorkspaceMenu && canAccessByPermission("WORKSPACE_READ", hasPermission)) {
                groupedModules[projectGroupId].push({
                    id: 99998,
                    moduleGroupId: projectGroupId,
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
                    if ((group.name ?? "").toLowerCase() === "project management") {
                        const boardIndex = groupMods.findIndex((module) => module.url === "/project-board");
                        const backlogIndex = groupMods.findIndex((module) => module.url === "/sprint-backlogs");
                        if (boardIndex >= 0 && backlogIndex >= 0 && boardIndex !== backlogIndex + 1) {
                            const [boardModule] = groupMods.splice(boardIndex, 1);
                            groupMods.splice(backlogIndex + (boardIndex < backlogIndex ? 0 : 1), 0, boardModule);
                        }
                    }
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
