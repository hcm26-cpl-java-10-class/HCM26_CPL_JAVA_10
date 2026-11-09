import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, useSidebar } from "@/components/ui/sidebar";
import { NavMain } from "@/components/layout/NavMain";
import { TooltipWrapper } from "@/components/datatable/common/TooltipWrapper";
import { Button } from "@/components/ui/button";
import { AlertCircle, LoaderCircle, LogOutIcon, RefreshCw } from "lucide-react";
import { useMemo } from "react";
import { useDispatch } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import { authApi } from "@/api/features/auth.api";
import { useActiveModuleGroups } from "@/hooks/useSidebarMenus";
import { iconMap } from "@/components/datatable/iconMap";
import { setLogout } from "@/store/slices/auth/authSlice";
import { useQueryClient } from "@tanstack/react-query";

export function SidebarMenu() {
    const location = useLocation();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const queryClient = useQueryClient();
    const { toggleSidebar, state } = useSidebar();
    const {
        data: moduleGroups = [],
        isPending: isMenuLoading,
        isError: isMenuError,
        refetch: refetchMenu,
    } = useActiveModuleGroups();

    const handleLogout = async () => {
        try {
            await authApi.logout();
        } finally {
            queryClient.removeQueries({ queryKey: ["sidebar-menu"] });
            dispatch(setLogout());
            navigate("/login", { replace: true });
        }
    };

    const navGroups = useMemo(() => {
        const resolveIcon = (iconName?: string) => {
            const key: keyof typeof iconMap =
                iconName && iconName in iconMap ? (iconName as keyof typeof iconMap) : "menu";

            return iconMap[key];
        };

        return moduleGroups
            .map((group) => {
                const groupNameLower = (group.name ?? "").toLowerCase();
                const isAssessmentGroup =
                    groupNameLower.includes("assessment") ||
                    group.modules.some((m) => m.url === "/exams");

                const baseItems = group.modules
                    .filter((module) => {
                        const url = module.url?.replace(/\/+$/, "") ?? "";
                        return (
                            !!module.url &&
                            !module.hiddenInMenu &&
                            url !== "/project-template-versions" &&
                            url !== "/enrollments"
                        );
                    })
                    .map((module) => {
                        const isExamsRoot = module.url === "/exams";
                        const isMatch =
                            !!module.url &&
                            (location.pathname === module.url ||
                                (location.pathname.startsWith(`${module.url}/`) &&
                                    (!isExamsRoot || !location.pathname.startsWith("/exams/curriculum"))));

                        return {
                            title: module.title ?? "Untitled",
                            url: module.url ?? "#",
                            icon: resolveIcon(module.icon),
                            isActive: isMatch,
                        };
                    });

                let items = baseItems;
                if (isAssessmentGroup) {
                    const alreadyHas = items.some((i) => i.url === "/exams/curriculum");
                    if (!alreadyHas) {
                        const curriculumItem = {
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

                return {
                    id: group.id ?? group.name ?? "group",
                    name: group.name ?? "Menu",
                    hiddenInMenu: group.hiddenInMenu,
                    items,
                };
            })
            .filter((group) => !group.hiddenInMenu && group.items.length > 0);
    }, [location.pathname, moduleGroups]);

    return (
        <Sidebar variant="inset" collapsible="icon">
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
                        <span className="text-lg font-bold text-blue-800 truncate">RBAC System</span>
                    )}
                </Button>
            </SidebarHeader>

            <SidebarContent>
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
                {state === "expanded" && <span className="flex-1 truncate">RBAC System v1.0</span>}

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
