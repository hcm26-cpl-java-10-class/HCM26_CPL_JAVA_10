import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, useSidebar } from "@/components/ui/sidebar";
import { NavMain } from "@/components/layout/NavMain";
import { TooltipWrapper } from "@/components/datatable/common/TooltipWrapper";
import { Button } from "@/components/ui/button";
import { LogOutIcon, MapPin } from "lucide-react";
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
                const groupNameLower = (group.name || "").toLowerCase();
                const isRbacGroup = groupNameLower.includes("rbac");

                const items = group.modules
                    .filter((module) => !!module.url)
                    .filter((module) => {
                        const isUnderSystemManagement =
                            (group.name || "").toLowerCase().includes("system");
                        const isModulesMenu =
                            module.url === "/menus" || (module.title || "").toLowerCase() === "modules";

                        if (isUnderSystemManagement && isModulesMenu) {
                            return false;
                        }
                        return true;
                    })
                    .map((module) => {
                        const moduleUrl = module.url?.replace(/\/+$/, "");
                        const normalizedTitle = (module.title ?? "").trim().toLocaleLowerCase();
                        const isRoleManagement =
                            moduleUrl === "/roles" ||
                            moduleUrl === "/role" ||
                            normalizedTitle === "roles" ||
                            normalizedTitle === "quản lý vai trò" ||
                            normalizedTitle === "role management";
                        const url = isRoleManagement
                            ? "/fams/role-permission-matrix"
                            : module.url ?? "#";

                        return {
                            title: module.title ?? "Untitled",
                            url,
                            icon: resolveIcon(module.icon),
                            isActive:
                                location.pathname === url ||
                                location.pathname.startsWith(`${url}/`),
                        };
                    });

                if (isRbacGroup) {
                    const hasLocation = items.some(
                        (item) => item.url.includes("location")
                    );
                    if (!hasLocation) {
                        items.push({
                            title: "Locations",
                            url: "/locations",
                            icon: MapPin,
                            isActive:
                                location.pathname === "/locations" ||
                                location.pathname.startsWith("/locations/"),
                        });
                    }
                }

                return {
                    id: group.id ?? group.name ?? "group",
                    name: group.name ?? "Menu",
                    items,
                };
            })
            .filter((group) => group.items.length > 0);
    }, [location.pathname, moduleGroups]);

    return (
        <Sidebar
            variant="inset"
            collapsible="icon"
            className="[--sidebar:#0F172A] [--sidebar-foreground:#F8FAFC] [--sidebar-accent:#1E293B] [--sidebar-accent-foreground:#F8FAFC] [--sidebar-border:#334155] [--sidebar-ring:#EA580C] [&_[data-slot=sidebar-inner]]:!bg-slate-900"
        >
            {/* Header */}
            <SidebarHeader className="py-3 px-0">
                <Button
                    type="button"
                    variant="ghost"
                    onClick={toggleSidebar}
                    className="flex h-auto w-full min-w-0 items-center justify-start gap-3 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
                >
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-600 text-sm font-semibold text-white">
                        F
                    </div>

                    {state === "expanded" && (
                        <span className="truncate text-lg font-bold text-white">FAMS</span>
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

            {/* Footer */}
            <SidebarFooter className="flex flex-col items-start gap-1 p-4 text-xs text-slate-400 group-data-[collapsible=icon]:items-center">
                {state === "expanded" && (
                    <span className="flex-1 truncate">
                        FAMS v2.4.0 / Training Operations
                    </span>
                )}

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