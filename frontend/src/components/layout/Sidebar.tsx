import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, useSidebar } from "@/components/ui/sidebar";
import { NavMain } from "@/components/layout/NavMain";
import { TooltipWrapper } from "@/components/datatable/common/TooltipWrapper";
import { Button } from "@/components/ui/button";
import { LogOutIcon, MapPin } from "lucide-react";
import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { authApi } from "@/api/features/auth.api";
import { useActiveModuleGroups } from "@/hooks/useSidebarMenus";
import { iconMap } from "@/components/datatable/iconMap";

export function SidebarMenu() {
    const location = useLocation();
    const navigate = useNavigate();
    const { toggleSidebar, state } = useSidebar();
    const { data: moduleGroups = [] } = useActiveModuleGroups();

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

            {/* Content */}
            <SidebarContent>
                {navGroups.map((group) =>
                    group ? (
                        <NavMain key={group.id} title={group.name} items={group.items} sidebarState={state} />
                    ) : null,
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