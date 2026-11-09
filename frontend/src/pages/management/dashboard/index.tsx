import {
  Check,
  Code2,
  KeyRound,
  LayoutGrid,
  Menu,
  Search,
  Shield,
  Table,
  Tag,
  Users,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { dashboardApi, type DashboardStats } from "../../../api/features/dashboard.api";
import { MainLayout } from "../../../components/layout/MainLayout";
import { usePermissions } from "@/hooks/usePermissions";

type PermissionActionType = "READ" | "CREATE" | "UPDATE" | "DELETE" | "SPECIAL";
type ViewMode = "grouped" | "matrix" | "compact";
type ActionFilterType = "ALL" | PermissionActionType;

interface ParsedPermission {
  code: string;
  label: string;
  module: string;
  type: PermissionActionType;
}

const KNOWN_MODULE_PREFIXES = [
  "STUDENT_SCORE",
  "USER_LEARNING",
  "BOOK",
  "COURSE",
  "DEPARTMENT",
  "ENROLLMENT",
  "EXAM",
  "INVITATION",
  "LEARNING_SELF",
  "LEARNING",
  "LESSON",
  "MENU",
  "PERMISSION",
  "QUESTION",
  "ROLE",
  "SESSION",
  "USER",
];

const MODULE_CATEGORY_MAP: Record<string, string> = {
  BOOK: "Book Management",
  COURSE: "Course Management",
  DEPARTMENT: "RBAC Management",
  ENROLLMENT: "Course Management",
  EXAM: "Exam Management",
  INVITATION: "Exam Management",
  LEARNING: "Online Learning",
  LESSON: "Online Learning",
  MENU: "System Management",
  PERMISSION: "RBAC Management",
  QUESTION: "Exam Management",
  ROLE: "RBAC Management",
  SESSION: "Online Learning",
  STUDENT_SCORE: "Score Management",
  USER: "RBAC Management",
  SYSTEM: "System Management",
};

const ACTION_SORT_ORDER: Record<PermissionActionType, number> = {
  CREATE: 1,
  READ: 2,
  UPDATE: 3,
  DELETE: 4,
  SPECIAL: 5,
};

const formatModuleName = (moduleKey: string): string => {
  return moduleKey
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

const parsePermission = (code: string): ParsedPermission => {
  const normalized = code.trim().toUpperCase();

  // Special system-level and custom permissions
  if (normalized === "ADMIN_ACCESS") {
    return {
      code: normalized,
      label: "Admin Access",
      module: "SYSTEM",
      type: "SPECIAL",
    };
  }
  if (normalized === "LEARNER_ACCESS") {
    return {
      code: normalized,
      label: "Learner Access",
      module: "SYSTEM",
      type: "SPECIAL",
    };
  }
  if (normalized === "LEARNING_SELF_READ") {
    return {
      code: normalized,
      label: "Self Read",
      module: "LEARNING",
      type: "SPECIAL",
    };
  }
  if (normalized === "EXAM_TAKE") {
    return {
      code: normalized,
      label: "Take Exam",
      module: "EXAM",
      type: "SPECIAL",
    };
  }

  // Check known multi-word or standard prefixes
  for (const prefix of KNOWN_MODULE_PREFIXES) {
    if (normalized.startsWith(prefix + "_")) {
      const action = normalized.slice(prefix.length + 1);
      const moduleKey = prefix === "LEARNING_SELF" ? "LEARNING" : prefix;

      if (action === "READ") {
        return { code: normalized, label: "Read", module: moduleKey, type: "READ" };
      }
      if (action === "CREATE") {
        return { code: normalized, label: "Create", module: moduleKey, type: "CREATE" };
      }
      if (action === "UPDATE") {
        return { code: normalized, label: "Update", module: moduleKey, type: "UPDATE" };
      }
      if (action === "DELETE") {
        return { code: normalized, label: "Delete", module: moduleKey, type: "DELETE" };
      }

      const humanAction = action
        .split("_")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ");
      return { code: normalized, label: humanAction, module: moduleKey, type: "SPECIAL" };
    }
  }

  // Dynamic fallback for any other prefix_action format
  const lastUnderscore = normalized.lastIndexOf("_");
  if (lastUnderscore > 0) {
    const prefix = normalized.slice(0, lastUnderscore);
    const action = normalized.slice(lastUnderscore + 1);

    if (action === "READ") {
      return { code: normalized, label: "Read", module: prefix, type: "READ" };
    }
    if (action === "CREATE") {
      return { code: normalized, label: "Create", module: prefix, type: "CREATE" };
    }
    if (action === "UPDATE") {
      return { code: normalized, label: "Update", module: prefix, type: "UPDATE" };
    }
    if (action === "DELETE") {
      return { code: normalized, label: "Delete", module: prefix, type: "DELETE" };
    }

    const humanAction = action
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
    return { code: normalized, label: humanAction, module: prefix, type: "SPECIAL" };
  }

  return {
    code: normalized,
    label: normalized,
    module: "SYSTEM",
    type: "SPECIAL",
  };
};

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { effectivePermissions } = usePermissions();

  const [searchQuery, setSearchQuery] = useState("");
  const [showRawCode, setShowRawCode] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("grouped");
  const [actionFilter, setActionFilter] = useState<ActionFilterType>("ALL");

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const data = await dashboardApi.getStats();
      setStats(data);
    } catch (error) {
      console.error("Error loading dashboard stats:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const parsedPermissions = useMemo<ParsedPermission[]>(() => {
    return (effectivePermissions || []).map(parsePermission);
  }, [effectivePermissions]);

  const filteredPermissions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return parsedPermissions.filter((perm) => {
      if (actionFilter !== "ALL" && perm.type !== actionFilter) {
        return false;
      }

      if (query) {
        const matchCode = perm.code.toLowerCase().includes(query);
        const matchLabel = perm.label.toLowerCase().includes(query);
        const matchModule = perm.module.toLowerCase().includes(query);
        const matchModuleName = formatModuleName(perm.module).toLowerCase().includes(query);
        const category = MODULE_CATEGORY_MAP[perm.module]?.toLowerCase() || "";
        const matchCategory = category.includes(query);

        return matchCode || matchLabel || matchModule || matchModuleName || matchCategory;
      }

      return true;
    });
  }, [parsedPermissions, searchQuery, actionFilter]);

  const groupedModules = useMemo(() => {
    const allMap = new Map<string, ParsedPermission[]>();
    for (const perm of parsedPermissions) {
      if (!allMap.has(perm.module)) {
        allMap.set(perm.module, []);
      }
      allMap.get(perm.module)!.push(perm);
    }

    const filteredMap = new Map<string, ParsedPermission[]>();
    for (const perm of filteredPermissions) {
      if (!filteredMap.has(perm.module)) {
        filteredMap.set(perm.module, []);
      }
      filteredMap.get(perm.module)!.push(perm);
    }

    const sortPerms = (a: ParsedPermission, b: ParsedPermission) => {
      const orderDiff = (ACTION_SORT_ORDER[a.type] || 99) - (ACTION_SORT_ORDER[b.type] || 99);
      if (orderDiff !== 0) return orderDiff;
      return a.code.localeCompare(b.code);
    };

    const sortedModuleKeys = Array.from(allMap.keys()).sort((a, b) => {
      return formatModuleName(a).localeCompare(formatModuleName(b));
    });

    return sortedModuleKeys.map((moduleKey) => {
      const allPerms = (allMap.get(moduleKey) || []).sort(sortPerms);
      const matchedPerms = (filteredMap.get(moduleKey) || []).sort(sortPerms);

      return {
        module: moduleKey,
        moduleName: formatModuleName(moduleKey),
        category: MODULE_CATEGORY_MAP[moduleKey] || `${formatModuleName(moduleKey)} Management`,
        allPermissions: allPerms,
        filteredPermissions: matchedPerms,
        totalCount: allPerms.length,
        filteredCount: matchedPerms.length,
      };
    });
  }, [parsedPermissions, filteredPermissions]);

  const visibleModules = useMemo(() => {
    return groupedModules.filter((m) => m.filteredCount > 0);
  }, [groupedModules]);

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* SECTION A: 4 KPI STAT CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Users */}
          <div className="rounded-xl border p-5 transition-all bg-white border-slate-200/90 shadow-xs hover:border-blue-300 dark:bg-zinc-900 dark:border-zinc-800 dark:hover:border-blue-500/40">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">Total Users</p>
                <p className="text-3xl font-bold tracking-tight mt-2 text-slate-900 dark:text-zinc-100">
                  {isLoading ? "..." : stats?.totalUsers || 0}
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center border bg-blue-50/80 border-blue-100 text-blue-600 dark:bg-blue-950/50 dark:border-blue-900/60 dark:text-blue-400">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-zinc-400">
                {stats?.activeUsers || 0} active
              </span>
              <span className="px-2 py-0.5 rounded font-medium bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
                100% active
              </span>
            </div>
          </div>

          {/* Card 2: Total Roles */}
          <div className="rounded-xl border p-5 transition-all bg-white border-slate-200/90 shadow-xs hover:border-blue-300 dark:bg-zinc-900 dark:border-zinc-800 dark:hover:border-blue-500/40">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">Total Roles</p>
                <p className="text-3xl font-bold tracking-tight mt-2 text-slate-900 dark:text-zinc-100">
                  {isLoading ? "..." : stats?.totalRoles || 0}
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center border bg-blue-50/80 border-blue-100 text-blue-600 dark:bg-blue-950/50 dark:border-blue-900/60 dark:text-blue-400">
                <KeyRound className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-zinc-400">
                {stats?.activeRoles || 0} active
              </span>
              <span className="px-2 py-0.5 rounded font-medium bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
                RBAC active
              </span>
            </div>
          </div>

          {/* Card 3: Total Menus */}
          <div className="rounded-xl border p-5 transition-all bg-white border-slate-200/90 shadow-xs hover:border-blue-300 dark:bg-zinc-900 dark:border-zinc-800 dark:hover:border-blue-500/40">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">Total Menus</p>
                <p className="text-3xl font-bold tracking-tight mt-2 text-slate-900 dark:text-zinc-100">
                  {isLoading ? "..." : stats?.totalMenus || 0}
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center border bg-blue-50/80 border-blue-100 text-blue-600 dark:bg-blue-950/50 dark:border-blue-900/60 dark:text-blue-400">
                <Menu className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-zinc-400">
                {stats?.activeMenus || 0} active
              </span>
              <span className="px-2 py-0.5 rounded font-medium bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
                Navigation
              </span>
            </div>
          </div>

          {/* Card 4: Granted Permissions */}
          <div className="rounded-xl border p-5 transition-all bg-white border-slate-200/90 shadow-xs hover:border-blue-300 dark:bg-zinc-900 dark:border-zinc-800 dark:hover:border-blue-500/40">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">Granted Permissions</p>
                <p className="text-3xl font-bold tracking-tight mt-2 text-slate-900 dark:text-zinc-100">
                  {isLoading ? "..." : effectivePermissions.length}
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center border bg-blue-50/80 border-blue-100 text-blue-600 dark:bg-blue-950/50 dark:border-blue-900/60 dark:text-blue-400">
                <Shield className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-zinc-400">
                Active session
              </span>
              <span className="px-2 py-0.5 rounded font-medium bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
                Full access
              </span>
            </div>
          </div>
        </div>

        {/* SECTION B & C: YOUR PERMISSIONS CONTAINER & TOOLBAR */}
        <div className="rounded-xl border bg-white border-slate-200/90 dark:bg-zinc-900 dark:border-zinc-800 shadow-xs overflow-hidden">
          {/* ROW 1: Title & View Mode Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 pb-4">
            {/* Left Side (Title & Meta) */}
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">
                  Your Permissions
                </h3>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-blue-50 text-blue-700 border border-blue-200/80 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800/70">
                  {effectivePermissions.length} total
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                Showing {filteredPermissions.length} / {effectivePermissions.length} permissions across {visibleModules.length} modules
              </p>
            </div>

            {/* Right Side (Display/View Controls ONLY) */}
            <div className="flex items-center gap-2">
              {/* Code Format Toggle Button */}
              <button
                type="button"
                onClick={() => setShowRawCode((prev) => !prev)}
                className="h-9 px-3 rounded-lg border text-xs font-medium flex items-center gap-1.5 border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 transition-all cursor-pointer"
                title="Toggle between clean labels and raw database codes"
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>{showRawCode ? "Raw Code" : "Clean"}</span>
              </button>

              {/* View Switcher */}
              <div className="h-9 p-1 rounded-lg bg-slate-100 border border-slate-200/80 dark:bg-zinc-800/90 dark:border-zinc-700/70 flex items-center">
                <button
                  type="button"
                  onClick={() => setViewMode("grouped")}
                  className={`h-full inline-flex items-center gap-1.5 px-2.5 text-xs font-medium transition-all cursor-pointer ${
                    viewMode === "grouped"
                      ? "bg-white text-blue-600 shadow-xs rounded-md dark:bg-zinc-900 dark:text-blue-400"
                      : "text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200"
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Cards</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("matrix")}
                  className={`h-full inline-flex items-center gap-1.5 px-2.5 text-xs font-medium transition-all cursor-pointer ${
                    viewMode === "matrix"
                      ? "bg-white text-blue-600 shadow-xs rounded-md dark:bg-zinc-900 dark:text-blue-400"
                      : "text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200"
                  }`}
                >
                  <Table className="w-3.5 h-3.5" />
                  <span>Table</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("compact")}
                  className={`h-full inline-flex items-center gap-1.5 px-2.5 text-xs font-medium transition-all cursor-pointer ${
                    viewMode === "compact"
                      ? "bg-white text-blue-600 shadow-xs rounded-md dark:bg-zinc-900 dark:text-blue-400"
                      : "text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200"
                  }`}
                >
                  <Tag className="w-3.5 h-3.5" />
                  <span>Tags</span>
                </button>
              </div>
            </div>
          </div>

          {/* ROW 2: Unified Search & Action Filter Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 px-5 py-3 bg-slate-50/70 border-y border-slate-200/80 dark:bg-zinc-900/50 dark:border-zinc-800/80">
            {/* Left Side (Search Input) */}
            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search permissions..."
                className="h-9 w-full pl-9 pr-3 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 transition-all"
              />
            </div>

            {/* Right Side (Action Type Filter Pills) */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {(
                [
                  { key: "ALL", label: "All" },
                  { key: "READ", label: "Read" },
                  { key: "CREATE", label: "Create" },
                  { key: "UPDATE", label: "Update" },
                  { key: "DELETE", label: "Delete" },
                  { key: "SPECIAL", label: "Special" },
                ] as const
              ).map((filter) => {
                const isActive = actionFilter === filter.key;
                return (
                  <button
                    key={filter.key}
                    type="button"
                    onClick={() => setActionFilter(filter.key)}
                    className={`h-8 px-3 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      isActive
                        ? "bg-blue-600 text-white shadow-xs"
                        : "bg-white text-slate-600 border border-slate-200/80 hover:border-blue-300 hover:text-slate-900 dark:bg-zinc-950 dark:text-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-700"
                    }`}
                  >
                    {filter.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mode 1: 'grouped' (Module Cards - DEFAULT) */}
          {viewMode === "grouped" && (
            <div className="p-5">
              {visibleModules.length === 0 ? (
                <div className="p-12 text-center">
                  <Shield className="w-10 h-10 mx-auto text-slate-300 dark:text-zinc-600 mb-3" />
                  <p className="text-sm font-medium text-slate-700 dark:text-zinc-300">
                    No permissions found
                  </p>
                  <p className="text-xs text-slate-500 dark:text-zinc-500 mt-1">
                    Try adjusting your search query or action filter.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {visibleModules.map((m) => (
                    <div
                      key={m.module}
                      className="rounded-lg border p-4 bg-slate-50/50 border-slate-200/80 hover:border-blue-300 hover:bg-white dark:bg-zinc-950/50 dark:border-zinc-800/90 dark:hover:border-blue-500/40 dark:hover:bg-zinc-900 transition-all shadow-2xs"
                    >
                      <div className="border-b pb-2.5 mb-3 flex items-start justify-between border-slate-200/80 dark:border-zinc-800/80">
                        <div>
                          <h4 className="font-semibold text-sm text-slate-900 dark:text-zinc-100">
                            {m.moduleName}
                          </h4>
                          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                            {m.category}
                          </p>
                        </div>
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
                          {m.filteredCount !== m.totalCount
                            ? `${m.filteredCount}/${m.totalCount}`
                            : m.totalCount}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {m.filteredPermissions.map((perm) => (
                          <span
                            key={perm.code}
                            className="px-2.5 py-1 rounded text-xs font-medium border bg-blue-50 text-blue-700 border-blue-200/80 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800/70"
                          >
                            {showRawCode ? (
                              <span className="font-mono">{perm.code}</span>
                            ) : (
                              <span>{perm.label}</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Mode 2: 'matrix' (Minimalist CRUD Table) */}
          {viewMode === "matrix" && (
            <div className="p-5">
              {visibleModules.length === 0 ? (
                <div className="p-12 text-center">
                  <Shield className="w-10 h-10 mx-auto text-slate-300 dark:text-zinc-600 mb-3" />
                  <p className="text-sm font-medium text-slate-700 dark:text-zinc-300">
                    No permissions found
                  </p>
                  <p className="text-xs text-slate-500 dark:text-zinc-500 mt-1">
                    Try adjusting your search query or action filter.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-200/80 dark:border-zinc-800">
                  <table className="w-full text-left text-sm border-collapse min-w-[640px]">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/50 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
                        <th className="px-4 py-3 text-left">Module</th>
                        <th className="px-4 py-3 text-center w-24">Read</th>
                        <th className="px-4 py-3 text-center w-24">Create</th>
                        <th className="px-4 py-3 text-center w-24">Update</th>
                        <th className="px-4 py-3 text-center w-24">Delete</th>
                        <th className="px-4 py-3 text-left">Other</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
                      {visibleModules.map((m) => {
                        const hasRead = m.filteredPermissions.some((p) => p.type === "READ");
                        const hasCreate = m.filteredPermissions.some((p) => p.type === "CREATE");
                        const hasUpdate = m.filteredPermissions.some((p) => p.type === "UPDATE");
                        const hasDelete = m.filteredPermissions.some((p) => p.type === "DELETE");
                        const otherPerms = m.filteredPermissions.filter((p) => p.type === "SPECIAL");

                        return (
                          <tr
                            key={m.module}
                            className="hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 transition-colors"
                          >
                            <td className="px-4 py-3 align-middle">
                              <div className="font-medium text-slate-900 dark:text-zinc-100">
                                {m.moduleName}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-zinc-400">
                                {m.category}
                              </div>
                            </td>
                            <td className="px-4 py-3 align-middle text-center">
                              {hasRead ? (
                                <div className="flex justify-center">
                                  <div className="w-6 h-6 rounded flex items-center justify-center border bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/70 dark:text-blue-400 dark:border-blue-800/70">
                                    <Check className="w-3.5 h-3.5" />
                                  </div>
                                </div>
                              ) : (
                                <span className="text-slate-400 dark:text-zinc-600 text-sm block text-center select-none">
                                  -
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 align-middle text-center">
                              {hasCreate ? (
                                <div className="flex justify-center">
                                  <div className="w-6 h-6 rounded flex items-center justify-center border bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/70 dark:text-blue-400 dark:border-blue-800/70">
                                    <Check className="w-3.5 h-3.5" />
                                  </div>
                                </div>
                              ) : (
                                <span className="text-slate-400 dark:text-zinc-600 text-sm block text-center select-none">
                                  -
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 align-middle text-center">
                              {hasUpdate ? (
                                <div className="flex justify-center">
                                  <div className="w-6 h-6 rounded flex items-center justify-center border bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/70 dark:text-blue-400 dark:border-blue-800/70">
                                    <Check className="w-3.5 h-3.5" />
                                  </div>
                                </div>
                              ) : (
                                <span className="text-slate-400 dark:text-zinc-600 text-sm block text-center select-none">
                                  -
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 align-middle text-center">
                              {hasDelete ? (
                                <div className="flex justify-center">
                                  <div className="w-6 h-6 rounded flex items-center justify-center border bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/70 dark:text-blue-400 dark:border-blue-800/70">
                                    <Check className="w-3.5 h-3.5" />
                                  </div>
                                </div>
                              ) : (
                                <span className="text-slate-400 dark:text-zinc-600 text-sm block text-center select-none">
                                  -
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 align-middle">
                              {otherPerms.length > 0 ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {otherPerms.map((perm) => (
                                    <span
                                      key={perm.code}
                                      className="px-2.5 py-0.5 rounded text-xs font-medium border bg-blue-50 text-blue-700 border-blue-200/80 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800/70"
                                    >
                                      {showRawCode ? (
                                        <span className="font-mono">{perm.code}</span>
                                      ) : (
                                        perm.label
                                      )}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-slate-400 dark:text-zinc-600 text-sm select-none">
                                  -
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Mode 3: 'compact' (Filtered Tag Cloud) */}
          {viewMode === "compact" && (
            <div className="p-5">
              {filteredPermissions.length === 0 ? (
                <div className="p-12 text-center">
                  <Shield className="w-10 h-10 mx-auto text-slate-300 dark:text-zinc-600 mb-3" />
                  <p className="text-sm font-medium text-slate-700 dark:text-zinc-300">
                    No permissions found
                  </p>
                  <p className="text-xs text-slate-500 dark:text-zinc-500 mt-1">
                    Try adjusting your search query or action filter.
                  </p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {filteredPermissions.map((perm) => (
                    <span
                      key={perm.code}
                      className="bg-blue-50 text-blue-700 border-blue-200/90 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800/70 font-mono text-xs px-3 py-1.5 rounded-md border inline-flex items-center gap-1.5"
                    >
                      {showRawCode ? (
                        perm.code
                      ) : (
                        <>
                          <span className="font-semibold text-blue-800 dark:text-blue-200 font-sans">
                            {formatModuleName(perm.module)}:
                          </span>
                          <span>{perm.label}</span>
                        </>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};
