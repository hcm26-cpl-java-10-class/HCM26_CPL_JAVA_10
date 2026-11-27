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
import { usePendingInvitations } from "@/hooks/usePendingInvitations";
import { cn } from "@/lib/utils";
import { iconMap } from "@/components/datatable/iconMap";
import { getHomePathByRole } from "@/utils/rbac.utils";
import { usePermissions } from "@/hooks/usePermissions";
import { ChevronDown, FileCheck2, GraduationCap, LogOutIcon, Menu, MoreHorizontal, ShieldCheck } from "lucide-react";
import { fittingNavigationCount } from "./student-navigation-overflow";
import { useLayoutEffect, useRef, useState, useMemo } from "react";
import { useDispatch } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { performAppLogout } from "@/utils/auth-logout";
import { useRoleSwitch } from "@/contexts/RoleSwitchContext";
import { StudentExploreMenu } from "./StudentExploreMenu";

const normalizePath = (path?: string) => {
  const trimmed = (path || "/").replace(/\/+$/, "");
  return trimmed || "/";
};

/**
 * The student persona works with a single backlog entry point: the `Sprints`
 * and `Sprint Backlogs` menus collapse into `Backlogs` -> `/backlogs`.
 */
const STUDENT_HIDDEN_URLS = new Set(["/sprint-backlogs", "/project-board"]);

const STUDENT_MENU_OVERRIDES: Record<string, { title: string; url: string }> = {
  "/sprints": { title: "Backlogs", url: "/backlogs" },
};

const BACKLOGS_URL = "/backlogs";
const MY_SUBMISSIONS_URL = "/student/milestone-submissions";

const SYLLABUS_PATH = "/student/syllabuses";
const ADMIN_ONLY_STUDENT_PREVIEW_PATHS = new Set(["/course-report", "/enrollment-logs"]);

const navButtonClass =
    "h-9 shrink-0 rounded-[10px] border border-transparent px-3 text-sm " +
    "bg-transparent shadow-none " +
    "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground";

const activeNavClass =
    "border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100";

export function StudentNavbar() {
  const navRef = useRef<HTMLElement>(null);
  const sizingRef = useRef<HTMLDivElement>(null);
  const [inlineCount, setInlineCount] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const { activeRole, effectivePermissions, hasPermission, canLearn } = usePermissions();
  const { data: moduleGroups = [] } = useActiveModuleGroups();
  const { count: pendingInvitationCount } = usePendingInvitations();
  const pathname = normalizePath(location.pathname);

  const canBrowseSyllabuses =
      hasPermission("COURSE_READ");

  const isSyllabusesActive =
      pathname === SYLLABUS_PATH ||
      pathname.startsWith(`${SYLLABUS_PATH}/`);

  const resolveIcon = (moduleIcon?: string) => {
    const key: keyof typeof iconMap =
      moduleIcon && moduleIcon in iconMap ? (moduleIcon as keyof typeof iconMap) : "menu";
    return iconMap[key];
  };

  const navGroups = useMemo(() => {
    const groups = moduleGroups
      .map((group) => {
        const seenUrls = new Set<string>();

        const items = group.modules
          .filter((module) => !!module.url)
          .filter((module) => !module.hiddenInMenu)
          .filter((module) => !ADMIN_ONLY_STUDENT_PREVIEW_PATHS.has(normalizePath(module.url)))
          .filter((module) => !STUDENT_HIDDEN_URLS.has(normalizePath(module.url)))
          .map((module) => {
            const override = STUDENT_MENU_OVERRIDES[normalizePath(module.url)];
            const url = override?.url ?? module.url!;

            return {
              id: module.id ?? `${group.id ?? group.name}-module`,
              title: override?.title ?? module.title ?? "Untitled",
              url,
              icon: resolveIcon(module.icon),
              isActive:
                pathname === normalizePath(url) ||
                pathname.startsWith(`${normalizePath(url)}/`),
            };
          })
          .filter((item) => {
            if (seenUrls.has(item.url)) {
              return false;
            }

            seenUrls.add(item.url);
            return true;
          });

        return {
          id: group.id ?? group.name ?? "group",
          name: group.name ?? "Menu",
          hiddenInMenu: group.hiddenInMenu,
          items,
        };
      });

    if (hasPermission("ENROLLMENT_CREATE") && !groups.some(g => g.items.some(i => i.url === "/student/recommendations"))) {
      const item = { id: "student-recommendations", title: "For you", url: "/student/recommendations", icon: resolveIcon("menu"), isActive: pathname === "/student/recommendations" };
      const courseGroup = groups.find(g => !g.hiddenInMenu && (g.items.some(i => normalizePath(i.url) === "/courses") || g.name.toLowerCase().trim() === "course online"));
      if (courseGroup) courseGroup.items.push(item);
      else groups.push({ id: "student-courses", name: "Course Online", hiddenInMenu: false, items: [item] });
    }
    // Safety net: when the sprint module is not configured in the database the
    // student still needs the Backlogs entry point.
    const hasBacklogs = groups.some((group) =>
      group.items.some((item) => item.url === BACKLOGS_URL),
    );

    if (!hasBacklogs && hasPermission("SPRINT_READ")) {
      const projectGroup =
        groups.find((group) => /project/i.test(group.name)) ?? groups[0];

      if (projectGroup) {
        projectGroup.items.push({
          id: "student-backlogs",
          title: "Backlogs",
          url: BACKLOGS_URL,
          icon: resolveIcon("menu"),
          isActive:
            pathname === BACKLOGS_URL || pathname.startsWith(`${BACKLOGS_URL}/`),
        });
      }
    }

    // Keep the personal submissions entry with project work, even when the
    // database menu originally places it under the general Student group.
    for (const group of groups) {
      group.items = group.items.filter((item) => normalizePath(item.url) !== MY_SUBMISSIONS_URL);
    }
    const projectGroup = groups.find((group) => !group.hiddenInMenu && group.items.some((item) =>
      normalizePath(item.url).startsWith("/management/workspaces"),
    )) ?? groups.find((group) => !group.hiddenInMenu && /project|dự án/i.test(group.name));
    const submissionsItem = {
        id: "student-my-submissions",
        title: "My Submissions",
        url: MY_SUBMISSIONS_URL,
        icon: FileCheck2,
        isActive: pathname === MY_SUBMISSIONS_URL || pathname.startsWith(`${MY_SUBMISSIONS_URL}/`),
    };
    if (projectGroup) {
      const workspaceIndex = projectGroup.items.findIndex((item) => normalizePath(item.url).startsWith("/management/workspaces"));
      projectGroup.items.splice(workspaceIndex >= 0 ? workspaceIndex + 1 : 0, 0, submissionsItem);
    } else {
      groups.push({ id: "student-project", name: "Project Management", hiddenInMenu: false, items: [submissionsItem] });
    }

    if (canLearn) {
      const insights = {
        id: "student-learning-insights",
        title: "AI Learning Insights",
        url: "/my-learning#learning-insights-heading",
        icon: GraduationCap,
        isActive: pathname === "/my-learning" && location.hash === "#learning-insights-heading",
      };
      const studentGroup = groups.find(group => !group.hiddenInMenu && group.name.trim().toLowerCase() === "student");
      if (studentGroup) studentGroup.items.push(insights);
      else groups.push({ id: "student-learning", name: "Student", hiddenInMenu: false, items: [insights] });

      groups.push({
        id: "student-my-reports",
        name: "My Reports",
        hiddenInMenu: false,
        items: [
          {
            id: "student-report-performance",
            title: "Learning Performance",
            url: "/my-learning/reports/performance",
            icon: FileCheck2,
            isActive: pathname === "/my-learning/reports/performance",
          },
          {
            id: "student-report-goals-habits",
            title: "Goals & Habits Report",
            url: "/my-learning/reports/goals-habits",
            icon: FileCheck2,
            isActive: pathname === "/my-learning/reports/goals-habits",
          },
        ],
      });
    }

    return groups.filter((group) => !group.hiddenInMenu && group.items.length > 0);
  }, [moduleGroups, pathname, hasPermission, canLearn, location.hash]);

  // Pending-invitation badge next to the Invitations entry point.
  const renderPendingBadge = (url: string) => {
    if (normalizePath(url) !== "/invitations" || pendingInvitationCount <= 0) {
      return null;
    }

    return (
      <span
        aria-hidden="true"
        className="ml-auto flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white"
      >
        {pendingInvitationCount > 9 ? "9+" : pendingInvitationCount}
      </span>
    );
  };

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

  // Keep groups after System Management in More; move earlier groups there too
  // when account controls, translations or browser zoom leave less room.
  const systemIndex = navigation.findIndex(e => e.type === "group" && e.group.name.toLowerCase().trim() === "system management");
  const inlineLimit = systemIndex >= 0 ? systemIndex + 1 : navigation.length;
  const sizingKey = navigation.map(e => e.type === "group" ? e.group.name : "Syllabuses").join("|");
  useLayoutEffect(() => {
    const measure = () => {
      if (!navRef.current || !sizingRef.current) return;
      const widths = Array.from(sizingRef.current.children, child => child.getBoundingClientRect().width);
      setInlineCount(fittingNavigationCount(widths, navRef.current.clientWidth, inlineLimit));
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (navRef.current) observer.observe(navRef.current);
    if (sizingRef.current) observer.observe(sizingRef.current);
    // Font loading can change button widths independently of viewport size.
    void document.fonts?.ready.then(measure);
    return () => observer.disconnect();
  }, [sizingKey, inlineLimit]);
  const overflow = navigation.slice(inlineCount);

  const { setViewRole } = useRoleSwitch();
  const handleLogout = async () => {
    await performAppLogout({
      dispatch,
      queryClient,
      navigate,
      clearViewRole: () => setViewRole(null),
    });
  };

  return (
      <header className="border-b border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="flex min-h-16 flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 lg:h-16 lg:flex-nowrap lg:py-0">

          {/* BRAND */}
          <Button
              type="button"
              variant="ghost"
              onClick={() =>
                  navigate(getHomePathByRole(activeRole, effectivePermissions))
              }
              className="flex h-auto shrink-0 items-center justify-start gap-3 px-0 hover:bg-transparent"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-blue-800 text-sm font-semibold text-white">
              RB
            </div>

            <span className="hidden truncate text-lg font-bold text-blue-800 sm:inline">
            RBAC System
          </span>
          </Button>

          <StudentExploreMenu
              canBrowse={hasPermission("COURSE_READ")}
              canRecommend={hasPermission("ENROLLMENT_CREATE")}
          />

          {/* Measure menus in a clipped sizing row so visible navigation stays on one line. */}
          <nav
              ref={navRef}
              aria-label="Student navigation"
              className="relative hidden min-w-0 flex-1 items-center gap-2 lg:flex"
          >
            <div aria-hidden="true" className="pointer-events-none invisible absolute h-0 w-0 overflow-hidden">
              <div ref={sizingRef} className="flex w-max gap-2">
                {navigation.map((entry, i) => <Button key={i} tabIndex={-1} variant="ghost" size="sm" className={navButtonClass}>
                  <span className="max-w-[180px] truncate">{entry.type === "group" ? entry.group.name : "Syllabuses"}</span>
                  {entry.type === "group" && <ChevronDown className="h-4 w-4 opacity-70" />}
                </Button>)}
              </div>
            </div>
            {navigation.slice(0, inlineCount).map((entry) => {
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
                            {renderPendingBadge(item.url)}
                          </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
              );
            })}
            {overflow.length > 0 && <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" aria-label="More navigation" title="More navigation" className={cn(navButtonClass, "w-9 shrink-0 px-0", overflow.some(e => e.type === "group" ? e.group.items.some(item => item.isActive) : isSyllabusesActive) && activeNavClass)}><MoreHorizontal className="size-5" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72 max-w-[calc(100vw-2rem)]">
                {overflow.map((entry, index) => entry.type === "syllabuses" ? <DropdownMenuItem key="more-syllabuses" onClick={() => navigate(SYLLABUS_PATH)} className={cn(isSyllabusesActive && "bg-accent text-accent-foreground")}>Syllabuses</DropdownMenuItem> : <div key={`more-${entry.group.id}`}>
                  {index > 0 && <DropdownMenuSeparator />}
                  <DropdownMenuLabel className="text-xs uppercase tracking-wide text-muted-foreground">{entry.group.name}</DropdownMenuLabel>
                  {entry.group.items.map(item => <DropdownMenuItem key={item.url} onClick={() => navigate(item.url)} className={cn("gap-2", item.isActive && "bg-accent text-accent-foreground")}><item.icon className="size-4" /><span className="min-w-0 break-words">{item.title}</span>{renderPendingBadge(item.url)}</DropdownMenuItem>)}
                </div>)}
              </DropdownMenuContent>
            </DropdownMenu>}
          </nav>

          {/* MOBILE NAVIGATION */}
          <div className="ml-auto flex max-w-full shrink-0 flex-wrap items-center justify-end gap-2">
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
                  className="w-72 max-w-[calc(100vw-2rem)]"
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
                              {renderPendingBadge(item.url)}
                            </DropdownMenuItem>
                        ))}
                      </div>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* EXISTING ROLE SWITCHER */}
            <div className="min-w-0 max-w-full [&>div]:flex-wrap">
              <HeaderRight />
            </div>

            {/* SECURITY & SESSIONS */}
            <TooltipWrapper content="Security & Sessions">
              <Button
                  size="icon-sm"
                  variant="ghost"
                  className="text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  onClick={() => navigate("/account/security")}
              >
                <ShieldCheck className="size-4" />
              </Button>
            </TooltipWrapper>

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
