import {
  Award,
  BookOpen,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  ClipboardList,
  Code2,
  Database,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Filter,
  Folder,
  FolderGit2,
  FolderKanban,
  GraduationCap,
  HelpCircle,
  KeyRound,
  Layout,
  ListTodo,
  Lock,
  Mail,
  MapPin,
  Menu,
  Milestone,
  Network,
  RotateCcw,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  Tag,
  UserCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { dashboardApi, type DashboardStats } from "../../../api/features/dashboard.api";
import { MainLayout } from "../../../components/layout/MainLayout";
import { usePermissions } from "@/hooks/usePermissions";

export type PermissionActionType = "READ" | "CREATE" | "UPDATE" | "DELETE" | "SPECIAL";
export type ActionFilterType = "ALL" | PermissionActionType;

export interface ParsedPermission {
  code: string;
  label: string;
  module: string;
  type: PermissionActionType;
}

export interface GroupedModuleData {
  module: string;
  moduleName: string;
  category: string;
  icon: LucideIcon;
  allPermissions: ParsedPermission[];
  filteredPermissions: ParsedPermission[];
  totalCount: number;
  filteredCount: number;
}

export interface CategoryGroupData {
  id: string;
  name: string;
  icon: LucideIcon;
  modules: GroupedModuleData[];
  totalPerms: number;
  filteredPerms: number;
}

export const KNOWN_MODULE_PREFIXES = [
  "STUDENT_SCORE",
  "USER_LEARNING",
  "SCORE_APPEAL",
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
  "ARTIFACT",
];

export const MODULE_CATEGORY_MAP: Record<string, string> = {
  // Online Learning
  COURSE: "Online Learning",
  LESSON: "Online Learning",
  LEARNING: "Online Learning",
  LEARNING_SELF: "Online Learning",
  USER_LEARNING: "Online Learning",
  ENROLLMENT: "Online Learning",
  ENROLLMENT_LOG: "Online Learning",
  CERTIFICATE: "Online Learning",
  CURRICULUM: "Online Learning",
  UNANSWERED_QUESTION: "Online Learning",

  // Artifact & Submission Management
  ARTIFACT: "Artifact & Submission Management",
  ARTIFACT_DRAFT: "Artifact & Submission Management",
  ARTIFACT_REVIEW: "Artifact & Submission Management",
  DELIVERABLE_TEMPLATE: "Artifact & Submission Management",
  SUBMISSION_HISTORY: "Artifact & Submission Management",
  SUBMISSION: "Artifact & Submission Management",

  // Exam Management
  EXAM: "Exam Management",
  QUESTION: "Exam Management",
  INVITATION: "Exam Management",
  EXAM_SESSION: "Exam Management",
  EXAM_GRADING: "Exam Management",
  EXAM_RESULT: "Exam Management",
  PROCTOR_LOG: "Exam Management",

  // Book & Library Management
  BOOK: "Book & Library Management",
  CATEGORY: "Book & Library Management",
  AUTHOR: "Book & Library Management",
  PUBLISHER: "Book & Library Management",
  BOOK_LOAN: "Book & Library Management",
  DIGITAL_ASSET: "Book & Library Management",

  // Member, Milestone & Feedback
  STUDENT_SCORE: "Member, Milestone & Feedback",
  SCORE_APPEAL: "Member, Milestone & Feedback",
  PEO: "Member, Milestone & Feedback",
  FEEDBACK: "Member, Milestone & Feedback",
  MILESTONE: "Member, Milestone & Feedback",
  MILESTONE_ALERT: "Member, Milestone & Feedback",
  PROJECT_TEAM: "Member, Milestone & Feedback",
  PROJECT_TEMPLATE: "Member, Milestone & Feedback",
  PROJECT: "Member, Milestone & Feedback",
  TASK: "Member, Milestone & Feedback",
  ATTENDANCE: "Member, Milestone & Feedback",
  BADGE: "Member, Milestone & Feedback",
  WARNING: "Member, Milestone & Feedback",

  // System & Access Control (RBAC)
  USER: "System & Access Control (RBAC)",
  ROLE: "System & Access Control (RBAC)",
  PERMISSION: "System & Access Control (RBAC)",
  DEPARTMENT: "System & Access Control (RBAC)",
  LOCATION: "System & Access Control (RBAC)",
  MENU: "System & Access Control (RBAC)",
  MENU_GROUP: "System & Access Control (RBAC)",
  MODULE: "System & Access Control (RBAC)",
  MODULE_GROUP: "System & Access Control (RBAC)",
  SESSION: "System & Access Control (RBAC)",
  AUDIT_LOG: "System & Access Control (RBAC)",
  SYSTEM: "System & Access Control (RBAC)",
};

export const CATEGORY_ICON_MAP: Record<string, LucideIcon> = {
  "Online Learning": GraduationCap,
  "Artifact & Submission Management": FolderKanban,
  "Exam Management": FileCheck2,
  "Book & Library Management": BookOpen,
  "Member, Milestone & Feedback": Award,
  "System & Access Control (RBAC)": Settings,
  "Other / General": Layout,
};

export const MODULE_ICON_MAP: Record<string, LucideIcon> = {
  ARTIFACT: FolderGit2,
  BOOK: BookOpen,
  COURSE: GraduationCap,
  DEPARTMENT: Network,
  ENROLLMENT: UserCheck,
  EXAM: FileSpreadsheet,
  INVITATION: Mail,
  LEARNING: BookOpen,
  LESSON: FileText,
  MENU: Menu,
  PERMISSION: ShieldAlert,
  QUESTION: HelpCircle,
  ROLE: KeyRound,
  SESSION: Lock,
  STUDENT_SCORE: FileCheck2,
  USER: Users,
  SYSTEM: Layout,
  LOCATION: MapPin,
  TASK: ListTodo,
  PROJECT: Folder,
  MILESTONE: Milestone,
  SCHEDULE: Calendar,
  LOG: ClipboardList,
  DATABASE: Database,
  TAG: Tag,
};

export const ACTION_SORT_ORDER: Record<PermissionActionType, number> = {
  CREATE: 1,
  READ: 2,
  UPDATE: 3,
  DELETE: 4,
  SPECIAL: 5,
};

export const formatModuleName = (moduleKey: string): string => {
  return moduleKey
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

export const getModuleIcon = (moduleKey: string): LucideIcon => {
  if (MODULE_ICON_MAP[moduleKey]) return MODULE_ICON_MAP[moduleKey];
  for (const [key, icon] of Object.entries(MODULE_ICON_MAP)) {
    if (moduleKey.includes(key)) return icon;
  }
  return Folder;
};

export const getCategoryIcon = (categoryName: string): LucideIcon => {
  return CATEGORY_ICON_MAP[categoryName] || CATEGORY_ICON_MAP["Other / General"];
};

export const parsePermission = (code: string): ParsedPermission => {
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

export const getPermBadgeStyle = (type: PermissionActionType): string => {
  switch (type) {
    case "READ":
      return "bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60";
    case "CREATE":
      return "bg-blue-50 text-blue-700 border-blue-200/80 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800/60";
    case "UPDATE":
      return "bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/60";
    case "DELETE":
      return "bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/60";
    case "SPECIAL":
    default:
      return "bg-indigo-50/80 text-indigo-700 border-indigo-200/80 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800/60";
  }
};

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { effectivePermissions } = usePermissions();

  const [searchQuery, setSearchQuery] = useState("");
  const [codeMode, setCodeMode] = useState<"clean" | "raw">("clean");
  const [actionFilter, setActionFilter] = useState<ActionFilterType>("ALL");

  // State đóng mở Category (Level 1) & Module (Level 2)
  const [openCategories, setOpenCategories] = useState<string[]>([]);
  const [openModules, setOpenModules] = useState<string[]>([]);

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

  const sortPerms = (a: ParsedPermission, b: ParsedPermission) => {
    const orderDiff = (ACTION_SORT_ORDER[a.type] || 99) - (ACTION_SORT_ORDER[b.type] || 99);
    if (orderDiff !== 0) return orderDiff;
    return a.code.localeCompare(b.code);
  };

  // Gom nhóm danh sách permissions/modules tự động thành cấu trúc 2 cấp (Category -> Modules -> Perms)
  const categoryGroups = useMemo<CategoryGroupData[]>(() => {
    // 1. Gom permissions theo module
    const moduleMap = new Map<string, ParsedPermission[]>();
    for (const perm of parsedPermissions) {
      if (!moduleMap.has(perm.module)) {
        moduleMap.set(perm.module, []);
      }
      moduleMap.get(perm.module)!.push(perm);
    }

    const query = searchQuery.trim().toLowerCase();

    // 2. Gom modules vào từng Category
    const categoryMap = new Map<string, GroupedModuleData[]>();

    const sortedModuleKeys = Array.from(moduleMap.keys()).sort((a, b) => {
      return formatModuleName(a).localeCompare(formatModuleName(b));
    });

    for (const moduleKey of sortedModuleKeys) {
      const allPerms = (moduleMap.get(moduleKey) || []).sort(sortPerms);
      const modName = formatModuleName(moduleKey);
      const catName = MODULE_CATEGORY_MAP[moduleKey] || "Other / General";

      const moduleMatchesQuery =
        !query ||
        moduleKey.toLowerCase().includes(query) ||
        modName.toLowerCase().includes(query) ||
        catName.toLowerCase().includes(query);

      const filteredPerms = allPerms.filter((perm) => {
        if (actionFilter !== "ALL" && perm.type !== actionFilter) {
          return false;
        }
        if (!query) return true;
        if (moduleMatchesQuery) return true;

        return (
          perm.code.toLowerCase().includes(query) ||
          perm.label.toLowerCase().includes(query)
        );
      });

      const moduleData: GroupedModuleData = {
        module: moduleKey,
        moduleName: modName,
        category: catName,
        icon: getModuleIcon(moduleKey),
        allPermissions: allPerms,
        filteredPermissions: filteredPerms,
        totalCount: allPerms.length,
        filteredCount: filteredPerms.length,
      };

      if (!categoryMap.has(catName)) {
        categoryMap.set(catName, []);
      }
      categoryMap.get(catName)!.push(moduleData);
    }

    // Thứ tự hiển thị ưu tiên chuẩn cho các Category
    const categoryOrder = [
      "Online Learning",
      "Artifact & Submission Management",
      "Exam Management",
      "Book & Library Management",
      "Member, Milestone & Feedback",
      "System & Access Control (RBAC)",
      "Other / General",
    ];

    const sortedCategories: CategoryGroupData[] = [];

    const existingCatNames = Array.from(categoryMap.keys()).sort((a, b) => {
      const indexA = categoryOrder.indexOf(a);
      const indexB = categoryOrder.indexOf(b);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return a.localeCompare(b);
    });

    for (const catName of existingCatNames) {
      const mods = categoryMap.get(catName) || [];
      const visibleMods = mods.filter((m) => m.filteredCount > 0);

      if (visibleMods.length > 0) {
        const totalPerms = visibleMods.reduce((sum, m) => sum + m.totalCount, 0);
        const filteredPerms = visibleMods.reduce((sum, m) => sum + m.filteredCount, 0);

        sortedCategories.push({
          id: `cat-${catName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
          name: catName,
          icon: getCategoryIcon(catName),
          modules: visibleMods,
          totalPerms,
          filteredPerms,
        });
      }
    }

    return sortedCategories;
  }, [parsedPermissions, searchQuery, actionFilter]);

  // Kiểm tra trạng thái đang tìm kiếm hoặc áp dụng filter khác "ALL"
  const isSearchingOrFiltering = searchQuery.trim() !== "" || actionFilter !== "ALL";

  // Thống kê tổng số hiển thị
  const statsSummary = useMemo(() => {
    let modCount = 0;
    let permCount = 0;
    categoryGroups.forEach((c) => {
      modCount += c.modules.length;
      permCount += c.filteredPerms;
    });
    return { modCount, permCount };
  }, [categoryGroups]);

  // Đóng/mở Category
  const toggleCategory = (catId: string) => {
    setOpenCategories((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
    );
  };

  // Đóng/mở Module
  const toggleModule = (modId: string) => {
    setOpenModules((prev) =>
      prev.includes(modId) ? prev.filter((id) => id !== modId) : [...prev, modId]
    );
  };

  // Expand All (Mở toàn bộ Category và Module)
  const handleExpandAll = () => {
    const allCatIds = categoryGroups.map((c) => c.id);
    const allModIds = categoryGroups.flatMap((c) => c.modules.map((m) => m.module));
    setOpenCategories(allCatIds);
    setOpenModules(allModIds);
  };

  // Collapse All (Đóng toàn bộ về trạng thái chỉ hiện Category)
  const handleCollapseAll = () => {
    setOpenCategories([]);
    setOpenModules([]);
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setActionFilter("ALL");
    setOpenCategories([]);
    setOpenModules([]);
  };

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

        {/* SECTION B: 2-LEVEL NESTED CATEGORY ACCORDION */}
        <section className="rounded-2xl border bg-white border-slate-200/90 dark:bg-zinc-900 dark:border-zinc-800 shadow-xs overflow-hidden transition-all">
          {/* HEADER: Title & Global Actions */}
          <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-zinc-800 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-base font-bold tracking-tight text-slate-900 dark:text-zinc-100">
                    Your Permissions
                  </h2>
                  <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/80">
                    {effectivePermissions.length} granted
                  </span>
                  <span className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300 border border-slate-200/60 dark:border-zinc-700/60">
                    {categoryGroups.length} categories • {statsSummary.modCount} modules
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                  Grouped by functional domain — Click a category to view its modules, then click a module to inspect permissions.
                </p>
              </div>

              {/* Action Buttons: Expand All / Collapse All / Clean vs Raw Code */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExpandAll}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                  title="Mở toàn bộ Category và Module"
                >
                  <ChevronsUpDown className="w-3.5 h-3.5 text-slate-400" />
                  <span>Expand All</span>
                </button>
                <button
                  type="button"
                  onClick={handleCollapseAll}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                  title="Thu gọn toàn bộ về danh sách Category"
                >
                  <ChevronsDownUp className="w-3.5 h-3.5 text-slate-400" />
                  <span>Collapse All</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCodeMode((prev) => (prev === "clean" ? "raw" : "clean"))}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                    codeMode === "raw"
                      ? "bg-blue-600 text-white border-blue-600 shadow-2xs"
                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  }`}
                  title="Chuyển đổi giữa nhãn tên dễ đọc và mã quyền kỹ thuật"
                >
                  <Code2 className="w-3.5 h-3.5" />
                  <span>{codeMode === "clean" ? "Clean" : "Raw Code"}</span>
                </button>
              </div>
            </div>

            {/* Search & Action Filter Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
              {/* Search Box */}
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search category, module, or permission (e.g. Lesson, Answer, Artifact)..."
                  aria-label="Search permissions"
                  className="w-full pl-9 pr-8 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50/70 text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-200 transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Action Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                {(
                  [
                    { key: "ALL", label: "All" },
                    { key: "READ", label: "Read" },
                    { key: "CREATE", label: "Create" },
                    { key: "UPDATE", label: "Update" },
                    { key: "DELETE", label: "Delete" },
                    { key: "SPECIAL", label: "Special" },
                  ] as const
                ).map((tab) => {
                  const isActive = actionFilter === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActionFilter(tab.key)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all shrink-0 cursor-pointer ${
                        isActive
                          ? "bg-blue-600 text-white border-blue-600 shadow-2xs font-semibold"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-700"
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* MAIN ACCORDION BODY */}
          <div className="p-4 sm:p-5">
            {categoryGroups.length === 0 ? (
              <div className="text-center py-12">
                <Filter className="w-8 h-8 text-slate-400 dark:text-zinc-500 mx-auto mb-2 opacity-60" />
                <p className="text-sm font-medium text-slate-700 dark:text-zinc-300">
                  Không tìm thấy quyền hoặc module nào khớp điều kiện
                </p>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                  Thử xóa từ khóa tìm kiếm hoặc chuyển bộ lọc về All
                </p>
                {(searchQuery || actionFilter !== "ALL") && (
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset search and filters</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2.5">
                {categoryGroups.map((cat) => {
                  const CategoryIcon = cat.icon;
                  const isCatExpanded =
                    isSearchingOrFiltering || openCategories.includes(cat.id);

                  return (
                    <div
                      key={cat.id}
                      className={`rounded-xl border transition-all overflow-hidden ${
                        isCatExpanded
                          ? "bg-white border-blue-300/90 shadow-xs dark:bg-zinc-950/80 dark:border-blue-900/60"
                          : "bg-slate-50/50 border-slate-200/80 hover:bg-white hover:border-slate-300 dark:bg-zinc-900/40 dark:border-zinc-800 dark:hover:bg-zinc-900/70 dark:hover:border-zinc-700"
                      }`}
                    >
                      {/* CẤP 1: CATEGORY HEADER ROW */}
                      <button
                        type="button"
                        onClick={() => toggleCategory(cat.id)}
                        className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left select-none cursor-pointer group focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border transition-colors ${
                              isCatExpanded
                                ? "bg-blue-600 text-white border-blue-600 shadow-2xs"
                                : "bg-blue-50 border-blue-100 text-blue-600 dark:bg-slate-800 dark:border-slate-700 dark:text-blue-400"
                            }`}
                          >
                            <CategoryIcon className="w-4 h-4" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm tracking-tight text-slate-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                {cat.name}
                              </span>
                              {/* Khi đang đóng Category, hiển thị preview tên các module con */}
                              {!isCatExpanded && (
                                <span className="hidden md:inline-block text-xs truncate max-w-md text-slate-400 dark:text-zinc-500">
                                  — {cat.modules.map((m) => m.moduleName).join(", ")}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="px-2.5 py-0.5 text-[11px] font-medium rounded-full border bg-slate-100 border-slate-200/80 text-slate-600 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300">
                            {cat.modules.length} {cat.modules.length === 1 ? "module" : "modules"}
                          </span>
                          <span
                            className={`px-2.5 py-0.5 text-[11px] font-semibold rounded-full border transition-colors ${
                              isCatExpanded
                                ? "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/80 dark:text-blue-300 dark:border-blue-800"
                                : "bg-white border-slate-200 text-slate-600 dark:bg-zinc-800/70 dark:border-zinc-700 dark:text-zinc-400"
                            }`}
                          >
                            {cat.filteredPerms !== cat.totalPerms
                              ? `${cat.filteredPerms}/${cat.totalPerms} perms`
                              : `${cat.totalPerms} permissions`}
                          </span>
                          <ChevronDown
                            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                              isCatExpanded
                                ? "rotate-180 text-blue-600 dark:text-blue-400"
                                : "group-hover:text-slate-600 dark:group-hover:text-zinc-200"
                            }`}
                          />
                        </div>
                      </button>

                      {/* CẤP 2: LƯỚI 2 CỘT MODULES BÊN TRONG CATEGORY */}
                      {isCatExpanded && (
                        <div className="px-3.5 pb-3.5 pt-2 border-t border-slate-100 dark:border-zinc-800/80 bg-slate-50/40 dark:bg-zinc-950/40 grid grid-cols-1 md:grid-cols-2 gap-2.5 items-start">
                          {cat.modules.map((mod) => {
                            const isModExpanded =
                              isSearchingOrFiltering || openModules.includes(mod.module);
                            const ModIcon = mod.icon;

                            return (
                              <div
                                key={mod.module}
                                className={`rounded-lg border transition-all overflow-hidden ${
                                  isModExpanded
                                    ? "bg-white border-blue-200 shadow-2xs dark:bg-zinc-900 dark:border-blue-900/60"
                                    : "bg-white/90 border-slate-200/70 hover:border-slate-300 dark:bg-zinc-900/60 dark:border-zinc-800 dark:hover:border-zinc-700"
                                }`}
                              >
                                {/* Dòng Module siêu gọn 1 hàng (~42px) */}
                                <button
                                  type="button"
                                  onClick={() => toggleModule(mod.module)}
                                  className="w-full px-3 py-2 flex items-center justify-between gap-2 text-left cursor-pointer group focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/20"
                                >
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <ChevronRight
                                      className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${
                                        isModExpanded
                                          ? "rotate-90 text-blue-600 dark:text-blue-400"
                                          : "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-zinc-300"
                                      }`}
                                    />
                                    <ModIcon className="w-3.5 h-3.5 shrink-0 text-slate-500 dark:text-zinc-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
                                    <span className="text-xs font-semibold truncate text-slate-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                      {mod.moduleName}
                                    </span>

                                    {/* Preview nhanh các quyền khi đóng */}
                                    {!isModExpanded && (
                                      <div className="hidden sm:flex items-center gap-1 ml-1 truncate">
                                        {mod.filteredPermissions.slice(0, 3).map((p, i) => (
                                          <span
                                            key={i}
                                            className="text-[10px] px-1.5 py-0.2 rounded border bg-slate-50 border-slate-200 text-slate-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400"
                                          >
                                            {codeMode === "clean" ? p.label : p.code}
                                          </span>
                                        ))}
                                        {mod.filteredPermissions.length > 3 && (
                                          <span className="text-[10px] text-slate-400 dark:text-zinc-500">
                                            +{mod.filteredPermissions.length - 3}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  <span
                                    className={`px-2 py-0.5 text-[11px] font-medium rounded-md shrink-0 border transition-colors ${
                                      isModExpanded
                                        ? "bg-blue-50 text-blue-600 border-blue-200/80 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800/80"
                                        : "bg-slate-100 text-slate-600 border-slate-200/60 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700"
                                    }`}
                                  >
                                    {mod.filteredCount !== mod.totalCount
                                      ? `${mod.filteredCount}/${mod.totalCount} perms`
                                      : `${mod.totalCount} ${
                                          mod.totalCount === 1 ? "perm" : "perms"
                                        }`}
                                  </span>
                                </button>

                                {/* CHI TIẾT QUYỀN (INLINE COMPACT CHIPS) */}
                                {isModExpanded && (
                                  <div className="px-3 pb-2.5 pt-2 border-t border-slate-100 dark:border-zinc-800/80 flex flex-wrap gap-1.5 bg-slate-50/30 dark:bg-zinc-950/20">
                                    {mod.filteredPermissions.map((perm) => (
                                      <span
                                        key={perm.code}
                                        title={`Code: ${perm.code} | Module: ${mod.moduleName}`}
                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border transition-transform hover:scale-[1.02] ${getPermBadgeStyle(
                                          perm.type
                                        )} ${codeMode === "raw" ? "font-mono text-[10.5px]" : ""}`}
                                      >
                                        <Check className="w-3 h-3 shrink-0 opacity-80" />
                                        <span>{codeMode === "clean" ? perm.label : perm.code}</span>
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </MainLayout>
  );
};
