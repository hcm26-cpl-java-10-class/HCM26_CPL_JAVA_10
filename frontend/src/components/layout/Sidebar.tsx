import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, useSidebar } from "@/components/ui/sidebar";
import { NavMain, type NavItem } from "@/components/layout/NavMain";
import { TooltipWrapper } from "@/components/datatable/common/TooltipWrapper";
import { Button } from "@/components/ui/button";
import { AlertCircle, LoaderCircle, LogOutIcon, RefreshCw, ShieldCheck } from "lucide-react";
import { useCallback, useLayoutEffect, useMemo, useRef, type UIEvent } from "react";
import { useDispatch } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import { useActiveModuleGroups } from "@/hooks/useSidebarMenus";
import { iconMap } from "@/components/datatable/iconMap";
import { useQueryClient } from "@tanstack/react-query";
import { usePermissions } from "@/hooks/usePermissions";
import { ADMIN_ROLE, TEACHER_ROLE, normalizeRole } from "@/utils/rbac.utils";
import { performAppLogout } from "@/utils/auth-logout";
import { useRoleSwitch } from "@/contexts/RoleSwitchContext";

/** Sidebar order of the entries that make up the "Class" section. */
const CLASS_SECTION_URLS = ["/classes"];

function organizeTrainingItems(items: NavItem[], pathname: string): NavItem[] {
    const withoutSessions = items.filter(
        (item) => item.url !== "/sessions" && item.title.toLowerCase() !== "sessions"
    );
    const hasClassAccess = withoutSessions.some((item) => item.url === "/classes");
    const remaining = withoutSessions.filter((item) => !CLASS_SECTION_URLS.includes(item.url));
    const activeSections: NavItem[] = [
        {
            title: "Class",
            url: "/classes",
            icon: iconMap["graduation-cap"],
            disabled: !hasClassAccess,
        },
        { title: "Training Calendar", url: "/calendar/adjust", icon: iconMap.calendar },
        { title: "Weekly Timetable", url: "/calendar/preview", icon: iconMap.calendar },
        { title: "Topics & Syllabus", url: "/subjects", icon: iconMap["book-open"] },
        { title: "Training Programs", url: "/programs", icon: iconMap.layers },
    ];

    const placeholders: NavItem[] = [
        { title: "Audit", url: "/training/audit", icon: iconMap["clipboard-check"], disabled: true },
        { title: "Trainee", url: "/training/trainee", icon: iconMap.users, disabled: true },
        { title: "Log Work", url: "/training/log-work", icon: iconMap.briefcase, disabled: true },
        { title: "Reports", url: "/training/reports", icon: iconMap["bar-chart"], disabled: true },
    ];

    const mappedActive = activeSections.map((section): NavItem => {
        const existing = remaining.find(
            (item) => item.title.toLowerCase() === section.title.toLowerCase() ||
                (item.url && (item.url === section.url ||
                    (section.url === "/subjects" && (item.url === "/subjects" || item.url === "/training/content" || item.url === "/training/topics")) ||
                    (section.url === "/programs" && (item.url === "/programs" || item.url === "/training/programs"))
                )),
        );
        if (existing) {
            return {
                ...existing,
                title: section.title,
                icon: section.icon,
                url: section.url,
                isActive: pathname === section.url || pathname.startsWith(`${section.url}/`) ||
                    pathname === existing.url || pathname.startsWith(`${existing.url}/`),
            };
        }
        return {
            ...section,
            disabled: section.disabled ?? (!section.url && !section.children?.length),
            isActive:
                section.children?.some((child) => child.isActive) ||
                (!!section.url &&
                    (pathname === section.url ||
                        pathname.startsWith(`${section.url}/`) ||
                        (section.url === "/classes" &&
                            (pathname.startsWith("/training-operations/class-details/") ||
                                pathname.startsWith("/class-details/"))))),
        };
    });

    const otherRealModules = remaining.filter((item) =>
        !activeSections.some(
            (sec) => sec.title.toLowerCase() === item.title.toLowerCase() || (sec.url && sec.url === item.url),
        ) &&
        !placeholders.some(
            (pl) => pl.title.toLowerCase() === item.title.toLowerCase() || (pl.url && pl.url === item.url),
        ) &&
        item.url !== "/content" &&
        item.url !== "/training/content" &&
        item.url !== "/class-setup" &&
        item.title.toLowerCase() !== "content" &&
        !item.title.toLowerCase().includes("kế hoạch môn học")
    );

    return [...mappedActive, ...otherRealModules];
}

const SIDEBAR_SCROLL_KEY = "sidebar_scroll_top";

function readStoredScroll(): number {
    try {
        return Number(sessionStorage.getItem(SIDEBAR_SCROLL_KEY)) || 0;
    } catch {
        return 0;
    }
}

export function SidebarMenu({
    collapsible = "icon",
}: {
    collapsible?: "icon" | "offcanvas";
} = {}) {
    const location = useLocation();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const queryClient = useQueryClient();
    const { toggleSidebar, state } = useSidebar();
    const { activeRole } = usePermissions();
    // Exam Supervisor API chỉ cho phép ADMIN / TEACHER.
    const canSupervise = [ADMIN_ROLE, TEACHER_ROLE].includes(normalizeRole(activeRole));
    const {
        data: moduleGroups = [],
        isPending: isMenuLoading,
        isError: isMenuError,
        refetch: refetchMenu,
    } = useActiveModuleGroups();

    const contentRef = useRef<HTMLDivElement>(null);
    const handleContentScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
        try {
            sessionStorage.setItem(SIDEBAR_SCROLL_KEY, String(event.currentTarget.scrollTop));
        } catch {
            // storage unavailable; scroll position simply won't persist
        }
    }, []);

    const { setViewRole } = useRoleSwitch();
    const handleLogout = async () => {
        await performAppLogout({
            dispatch,
            queryClient,
            navigate,
            clearViewRole: () => setViewRole(null),
        });
    };

    const navGroups = useMemo(() => {
        const resolveIcon = (iconName?: string) => {
            const key: keyof typeof iconMap =
                iconName && iconName in iconMap
                    ? (iconName as keyof typeof iconMap)
                    : "menu";

            return iconMap[key];
        };

        // Consolidate any duplicate training groups into a single "Training Management" group
        const consolidatedGroups: typeof moduleGroups = [];
        let unifiedTrainingGroup: (typeof moduleGroups)[number] | null = null;

        for (const group of moduleGroups) {
            const groupNameLower = (group.name ?? "").toLowerCase();
            const isTraining =
                groupNameLower.includes("training") ||
                groupNameLower.includes("lms") ||
                group.modules.some((m) => m.url === "/subjects" || m.url === "/programs" || m.url === "/classes");

            if (isTraining) {
                if (!unifiedTrainingGroup) {
                    unifiedTrainingGroup = {
                        ...group,
                        id: group.id ?? 99999,
                        name: "Training Management",
                        modules: [...group.modules],
                    };
                    consolidatedGroups.push(unifiedTrainingGroup);
                } else {
                    const existingUrls = new Set(unifiedTrainingGroup.modules.map((m) => m.url));
                    for (const mod of group.modules) {
                        if (!existingUrls.has(mod.url)) {
                            unifiedTrainingGroup.modules.push(mod);
                            existingUrls.add(mod.url);
                        }
                    }
                }
            } else {
                consolidatedGroups.push(group);
            }
        }

        return consolidatedGroups
            .map((group) => {
                const groupNameLower = (group.name ?? "").toLowerCase();
                const isAssessmentGroup =
                    groupNameLower.includes("assessment") ||
                    group.modules.some((m) => m.url === "/exams");
                const isTrainingGroup =
                    groupNameLower.includes("training") ||
                    groupNameLower.includes("lms") ||
                    group.modules.some((m) => m.url === "/subjects" || m.url === "/programs" || m.url === "/classes");

                const baseItems: NavItem[] = group.modules
                    .filter((module) => {
                        const url = module.url?.replace(/\/+$/, "") ?? "";
                        return (
                            !!module.url &&
                            !module.hiddenInMenu &&
                            url !== "/project-board" &&
                            url !== "/project-template-versions" &&
                            url !== "/enrollments" &&
                            url !== "/class-setup"
                        );
                    })
                    .map((module) => {
                        const isExamsRoot = module.url === "/exams";
                        const isMatch =
                            !!module.url &&
                            (location.pathname === module.url ||
                                (location.pathname.startsWith(`${module.url}/`) &&
                                    (!isExamsRoot ||
                                        (!location.pathname.startsWith("/exams/curriculum") &&
                                            !location.pathname.startsWith("/exams/score-management") &&
                                            !location.pathname.startsWith("/exams/supervisor")))));

                        return {
                            title: ["/management/workspaces", "/management/workspaces/candidates"].includes(module.url?.replace(/\/+$/, "") ?? "")
                                ? "Workspaces" : module.title ?? "Untitled",
                            url: module.url ?? "#",
                            icon: resolveIcon(module.icon),
                            isActive: isMatch,
                        };
                    });

                let items = baseItems;
                if (isAssessmentGroup) {
                    const alreadyHas = items.some((i) => i.url === "/exams/curriculum");
                    if (!alreadyHas) {
                        const curriculumItem: NavItem = {
                            title: "Curriculum Mapping",
                            url: "/exams/curriculum",
                            icon: resolveIcon("book-open"),
                            isActive:
                                location.pathname === "/exams/curriculum" ||
                                location.pathname.startsWith("/exams/curriculum"),
                        };
                        const examsIndex = items.findIndex((i) => i.url === "/exams");
                        if (examsIndex >= 0) {
                            items = [
                                ...items.slice(0, examsIndex + 1),
                                curriculumItem,
                                ...items.slice(examsIndex + 1),
                            ];
                        } else {
                            items = [curriculumItem, ...items];
                        }
                    }
                }

                if (isTrainingGroup) {
                    items = organizeTrainingItems(items, location.pathname);
                }

                if (isAssessmentGroup && !items.some((i) => i.url === "/exams/score-management")) {
                    items = [
                        ...items,
                        {
                            title: "Score Management",
                            url: "/exams/score-management",
                            icon: resolveIcon("graduation-cap"),
                            isActive: location.pathname.startsWith("/exams/score-management"),
                        },
                    ];
                }

                if (isAssessmentGroup && canSupervise && !items.some((i) => i.url === "/exams/supervisor")) {
                    items = [
                        ...items,
                        {
                            title: "Exam Supervisor",
                            url: "/exams/supervisor",
                            icon: resolveIcon("shield-check"),
                            isActive: location.pathname.startsWith("/exams/supervisor"),
                        },
                    ];
                }

                return {
                    id: group.id ?? group.name ?? "group",
                    name: group.name ?? "Menu",
                    hiddenInMenu: group.hiddenInMenu,
                    items,
                };
            })
            .filter((group) => !group.hiddenInMenu && group.items.length > 0);
    }, [location.pathname, moduleGroups, canSupervise]);

    // Restore the menu scroll position after remounts (each page renders its own layout),
    // then make sure the active item is visible.
    const menuReady = !isMenuLoading && navGroups.length > 0;
    useLayoutEffect(() => {
        const el = contentRef.current;
        if (!menuReady || !el) return;
        el.scrollTop = readStoredScroll();
        const active = el.querySelector<HTMLElement>('[data-active="true"][data-sidebar="menu-sub-button"], [data-active="true"][data-sidebar="menu-button"]');
        active?.scrollIntoView({ block: "nearest" });
    }, [menuReady, location.pathname, state]);

    return (
        <Sidebar variant="inset" collapsible={collapsible}>
            <SidebarHeader className="py-3 px-0">
                <Button
                    type="button"
                    variant="ghost"
                    onClick={toggleSidebar}
                    className="
            flex h-auto w-full min-w-0 items-center justify-start gap-3
            group-data-[collapsible=icon]:justify-center
            group-data-[collapsible=icon]:px-0
          "
                >
                    <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-blue-800 text-sm font-semibold text-white">
                        RB
                    </div>

                    {state === "expanded" && (
                        <span className="text-lg font-bold text-blue-800 truncate">
                            RBAC System
                        </span>
                    )}
                </Button>
            </SidebarHeader>

            <SidebarContent ref={contentRef} onScroll={handleContentScroll}>
                {isMenuLoading ? (
                    <div className="flex items-center justify-center px-3 py-6 text-muted-foreground">
                        <LoaderCircle className="size-5 animate-spin" />
                        <span className="ml-2 text-sm group-data-[collapsible=icon]:hidden">Loading navigation...</span>
                    </div>
                ) : isMenuError ? (
                    <div className="mx-2 rounded-md border border-destructive/30 p-3 text-destructive group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:p-1">
                        <div className="flex items-center gap-2 text-sm group-data-[collapsible=icon]:justify-center">
                            <AlertCircle className="size-4 shrink-0" />
                            <span className="group-data-[collapsible=icon]:hidden">Navigation could not be loaded.</span>
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => void refetchMenu()}
                            className="mt-2 w-full gap-2 group-data-[collapsible=icon]:mt-1 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0"
                        >
                            <RefreshCw className="size-4" />
                            <span className="group-data-[collapsible=icon]:hidden">Retry</span>
                        </Button>
                    </div>
                ) : navGroups.length === 0 ? (
                    <p className="px-4 py-6 text-center text-sm text-muted-foreground group-data-[collapsible=icon]:hidden">
                        No navigation items are available for this role.
                    </p>
                ) : (
                    navGroups.map((group) => (
                        <NavMain key={group.id} title={group.name} items={group.items} sidebarState={state} />
                    ))
                )}
            </SidebarContent>

            <SidebarFooter className="p-4 text-xs flex flex-row items-center gap-2 text-muted-foreground group-data-[collapsible=icon]:justify-center">
                {state === "expanded" && (
                    <span className="flex-1 truncate">RBAC System v1.0</span>
                )}

                <TooltipWrapper content="Security & Sessions">
                    <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => navigate("/account/security")}
                    >
                        <ShieldCheck className="size-4" />
                    </Button>
                </TooltipWrapper>

                <TooltipWrapper content="Logout">
                    <Button
                        size="icon"
                        variant="ghost"
                        onClick={handleLogout}
                    >
                        <LogOutIcon className="size-4" />
                    </Button>
                </TooltipWrapper>
            </SidebarFooter>
        </Sidebar>
    );
}