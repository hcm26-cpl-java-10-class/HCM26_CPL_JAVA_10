
import HeaderRight from "@/components/layout/HeaderRight";
import { TooltipWrapper } from "@/components/datatable/common/TooltipWrapper";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useActiveModuleGroups } from "@/hooks/useSidebarMenus";
import { cn } from "@/lib/utils";
import { authApi } from "@/api/features/auth.api";
import { iconMap } from "@/components/datatable/iconMap";
import { getHomePathByRole } from "@/utils/rbac.utils";
import { usePermissions } from "@/hooks/usePermissions";
import {
  ChevronDown,
  LogOutIcon,
  Menu,
} from "lucide-react";
import {
  useLocation,
  useNavigate,
} from "react-router-dom";

const normalizePath = (path?: string) => {
  const trimmed = (path || "/").replace(/\/+$/, "");
  return trimmed || "/";
};

const SYLLABUS_PATH = "/student/syllabuses";
const ADMIN_ONLY_STUDENT_PREVIEW_PATHS = new Set(["/course-report", "/enrollment-logs"]);

const navButtonClass =
    "h-9 rounded-[10px] border border-transparent px-3 text-sm " +
    "bg-transparent shadow-none " +
    "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground";

const activeNavClass =
    "border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100";

export function StudentNavbar() {
  const location = useLocation();
  const navigate = useNavigate();

  const { activeRole, hasPermission } = usePermissions();

  const { data: moduleGroups = [] } =
      useActiveModuleGroups();

  const pathname = normalizePath(location.pathname);

  const canBrowseSyllabuses =
      hasPermission("COURSE_READ");

  const isSyllabusesActive =
      pathname === SYLLABUS_PATH ||
      pathname.startsWith(`${SYLLABUS_PATH}/`);

  // Use the existing module groups from LMS.
  const resolveIcon = (iconName?: string) => {
    const key: keyof typeof iconMap =
        iconName && iconName in iconMap
            ? (iconName as keyof typeof iconMap)
            : "menu";

    return iconMap[key];
  };

  const navGroups = moduleGroups
      .map((group) => ({
        id: group.id ?? group.name ?? "group",
        name: group.name ?? "Menu",
        items: group.modules
            .filter((module) => !!module.url && !ADMIN_ONLY_STUDENT_PREVIEW_PATHS.has(normalizePath(module.url)))
            .map((module) => ({
              id:
                  module.id ??
                  `${group.id ?? group.name}-module`,
              title: module.title ?? "Untitled",
              url: module.url ?? "#",
              icon: resolveIcon(module.icon),
              isActive:
                  !!module.url &&
                  (
                      pathname === normalizePath(module.url) ||
                      pathname.startsWith(
                          `${normalizePath(module.url)}/`
                      )
                  ),
            })),
      }))
      .filter((group) => group.items.length > 0);

  type NavigationEntry =
      | {
    type: "group";
    group: (typeof navGroups)[number];
  }
      | {
    type: "syllabuses";
  };

  const navigation: NavigationEntry[] = [];

  let syllabusInserted = false;

  // Place Syllabuses after Course Online.
  for (const group of navGroups) {
    navigation.push({
      type: "group",
      group,
    });

    if (
        canBrowseSyllabuses &&
        group.name.toLowerCase().trim() === "course online"
    ) {
      navigation.push({
        type: "syllabuses",
      });

      syllabusInserted = true;
    }
  }

  // Fallback if Course Online is not available.
  if (canBrowseSyllabuses && !syllabusInserted) {
    navigation.push({
      type: "syllabuses",
    });
  }

  const handleLogout = async () => {
    await authApi.logout();
    navigate("/login");
  };

  return (
      <header className="border-b border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="flex h-16 items-center gap-3 px-4">

          {/* BRAND */}
          <Button
              type="button"
              variant="ghost"
              onClick={() =>
                  navigate(getHomePathByRole(activeRole))
              }
              className="flex h-auto min-w-0 items-center justify-start gap-3 px-0 hover:bg-transparent"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-blue-800 text-sm font-semibold text-white">
              RB
            </div>

            <span className="truncate text-lg font-bold text-blue-800">
            RBAC System
          </span>
          </Button>

          {/* DESKTOP NAVIGATION */}
          <nav
              aria-label="Student navigation"
              className="hidden min-w-0 flex-1 items-center gap-2 lg:flex"
          >
            {navigation.map((entry) => {
              if (entry.type === "syllabuses") {
                return (
                    <Button
                        key="student-syllabuses"
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                            navigate(SYLLABUS_PATH)
                        }
                        aria-current={
                          isSyllabusesActive
                              ? "page"
                              : undefined
                        }
                        className={cn(
                            navButtonClass,
                            isSyllabusesActive && activeNavClass
                        )}
                    >
                  <span className="max-w-[180px] truncate">
                    Syllabuses
                  </span>
                    </Button>
                );
              }

              const group = entry.group;

              const groupHasActive =
                  group.items.some(
                      (item) => item.isActive
                  );

              return (
                  <DropdownMenu key={group.id}>
                    <DropdownMenuTrigger asChild>
                      <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className={cn(
                              navButtonClass,
                              groupHasActive && activeNavClass
                          )}
                      >
                    <span className="max-w-[180px] truncate">
                      {group.name}
                    </span>

                        <ChevronDown className="h-4 w-4 opacity-70" />
                      </Button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent
                        align="start"
                        className="min-w-64"
                    >
                      <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        {group.name}
                      </DropdownMenuLabel>

                      <DropdownMenuSeparator />

                      {group.items.map((item) => (
                          <DropdownMenuItem
                              key={`${group.id}-${item.id}-${item.url}`}
                              onClick={() =>
                                  navigate(item.url)
                              }
                              className={cn(
                                  "gap-2",
                                  item.isActive &&
                                  "bg-blue-50 text-blue-800 focus:bg-blue-100 focus:text-blue-800"
                              )}
                          >
                            <item.icon className="h-4 w-4" />
                            <span>{item.title}</span>
                          </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
              );
            })}
          </nav>

          {/* MOBILE NAVIGATION */}
          <div className="ml-auto flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="lg:hidden"
                    aria-label="Open navigation menu"
                >
                  <Menu className="size-4" />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                  align="end"
                  className="w-72"
              >
                {navigation.map((entry, index) => {
                  if (entry.type === "syllabuses") {
                    return (
                        <DropdownMenuItem
                            key="mobile-syllabuses"
                            onClick={() =>
                                navigate(SYLLABUS_PATH)
                            }
                            className={cn(
                                isSyllabusesActive &&
                                "bg-blue-50 text-blue-800"
                            )}
                        >
                          Syllabuses
                        </DropdownMenuItem>
                    );
                  }

                  const group = entry.group;

                  return (
                      <div key={`mobile-${group.id}`}>
                        {index > 0 && (
                            <DropdownMenuSeparator />
                        )}

                        <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          {group.name}
                        </DropdownMenuLabel>

                        {group.items.map((item) => (
                            <DropdownMenuItem
                                key={`mobile-${group.id}-${item.id}-${item.url}`}
                                onClick={() =>
                                    navigate(item.url)
                                }
                                className={cn(
                                    "gap-2",
                                    item.isActive &&
                                    "bg-blue-50 text-blue-800"
                                )}
                            >
                              <item.icon className="h-4 w-4" />
                              <span>{item.title}</span>
                            </DropdownMenuItem>
                        ))}
                      </div>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* EXISTING ROLE SWITCHER */}
            <HeaderRight />

            {/* LOGOUT */}
            <TooltipWrapper content="Logout">
              <Button
                  size="icon-sm"
                  variant="ghost"
                  className="text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  onClick={handleLogout}
              >
                <LogOutIcon className="size-4" />
              </Button>
            </TooltipWrapper>
          </div>
        </div>
      </header>
  );
}
