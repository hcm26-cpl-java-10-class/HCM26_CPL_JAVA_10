import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, useSidebar } from "@/components/ui/sidebar";
import { NavMain, type NavItem } from "@/components/layout/NavMain";
import { TooltipWrapper } from "@/components/datatable/common/TooltipWrapper";
import { Button } from "@/components/ui/button";
import { LogOutIcon } from "lucide-react";
import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { authApi } from "@/api/features/auth.api";
import { useActiveModuleGroups } from "@/hooks/useSidebarMenus";
import { iconMap } from "@/components/datatable/iconMap";

/** Sidebar order of the entries that make up the "Class" section. */
const CLASS_SECTION_URLS = ["/classes"];

function organizeTrainingItems(items: NavItem[], pathname: string): NavItem[] {
    const withoutSessions = items.filter(
        (item) => item.url !== "/sessions" && item.title.toLowerCase() !== "sessions"
    );
    const classItems = CLASS_SECTION_URLS.flatMap((url) => withoutSessions.filter((item) => item.url === url));
    const remaining = withoutSessions.filter((item) => !CLASS_SECTION_URLS.includes(item.url));

    const activeSections: NavItem[] = [
        ...(classItems.length > 0
            ? [{ title: "Class", url: "", icon: iconMap["graduation-cap"], children: classItems }]
            : []),
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
            disabled: !section.url && !section.children?.length,
            isActive: section.children?.some((child) => child.isActive) ||
                (!!section.url && (pathname === section.url || pathname.startsWith(`${section.url}/`))),
        };
    });

    // Teammate actual modules (Subject, Training Program, Topic Mark, etc.)
    const otherRealModules = remaining.filter((item) =>
        !activeSections.some(
            (sec) => sec.title.toLowerCase() === item.title.toLowerCase() || (sec.url && sec.url === item.url),
        ) &&
        !placeholders.some(
            (pl) => pl.title.toLowerCase() === item.title.toLowerCase() || (pl.url && pl.url === item.url),
        ),
    );

    return [...mappedActive, ...otherRealModules, ...placeholders];
}

export function SidebarMenu({
    collapsible = "icon",
}: {
    collapsible?: "icon" | "offcanvas";
} = {}) {
    const location = useLocation();
    const navigate = useNavigate();
    const { toggleSidebar, state } = useSidebar();
    const { data: moduleGroups = [] } = useActiveModuleGroups();

    const navGroups = useMemo(() => {
        const resolveIcon = (iconName?: string) => {
            const key: keyof typeof iconMap =
                iconName && iconName in iconMap
                    ? (iconName as keyof typeof iconMap)
                    : "menu";

            return iconMap[key];
        };

        return moduleGroups
            .map((group) => ({
                id: group.id ?? group.name ?? "group",
                name: group.name ?? "Menu",
                items: group.modules
                    .filter((module) => !!module.url)
                    .filter((module) => {
                        const isUnderSystemManagement = (group.name || "")
                            .toLowerCase()
                            .includes("system");
                        const isModulesMenu =
                            module.url === "/menus" ||
                            (module.title || "").toLowerCase() === "modules";

                        if (isUnderSystemManagement && isModulesMenu) {
                            return false;
                        }
                        return true;
                    })
                    .map((module) => ({
                        title: module.title ?? "Untitled",
                        url: module.url ?? "#",
                        icon: resolveIcon(module.icon),
                        isActive:
                            !!module.url &&
                            (location.pathname === module.url ||
                                location.pathname.startsWith(`${module.url}/`) ||
                                (module.url === "/classes" &&
                                    (location.pathname.startsWith("/training-operations/class-details/") ||
                                        location.pathname.startsWith("/class-details/")))),
                    })),
            }))
            .filter((group) => group.items.length > 0)
            .map((group) => {
                const groupName = (group.name || "").trim().toLowerCase();
                const isTraining = groupName === "training operations" || groupName === "training management";
                return isTraining
                    ? { ...group, items: organizeTrainingItems(group.items, location.pathname) }
                    : group;
            });
    }, [location.pathname, moduleGroups]);

    return (
        <Sidebar variant="inset" collapsible={collapsible}>
            {/* Header */}
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

            {/* Content */}
            <SidebarContent>
                {navGroups.map((group) =>
                    group ? (
                        <NavMain
                            key={group.id}
                            title={group.name}
                            items={group.items}
                            sidebarState={state}
                        />
                    ) : null,
                )}
            </SidebarContent>

            {/* Footer */}
            <SidebarFooter className="p-4 text-xs flex flex-row items-center gap-2 text-muted-foreground group-data-[collapsible=icon]:justify-center">
                {state === "expanded" && (
                    <span className="flex-1 truncate">RBAC System v1.0</span>
                )}

                <TooltipWrapper content="Logout">
                    <Button
                        size="icon"
                        variant="ghost"
                        onClick={async () => {
                            await authApi.logout();
                            navigate("/login");
                        }}
                    >
                        <LogOutIcon className="size-4" />
                    </Button>
                </TooltipWrapper>
            </SidebarFooter>
        </Sidebar>
    );
}
