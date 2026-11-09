export const ADMIN_ROLE = "ADMIN";
export const STUDENT_ROLE = "STUDENT";
export const TEACHER_ROLE = "TEACHER";

export type RolePermissionsMap = Record<string, string[]>;

type AuthRolePayload = {
  role?: string | null;
  roles?: string[] | null;
  permissions?: string[] | null;
  rolePermissions?: Record<string, unknown> | null;
};

export const normalizeRole = (role?: string | null): string =>
  (role ?? "").trim().toUpperCase();

export const normalizePermission = (permission?: string | null): string => {
  const normalized = (permission ?? "").trim().toUpperCase();
  return ({ VIEW_PROJECT_WORKSPACE: "WORKSPACE_READ", CREATE_PROJECT_WORKSPACE: "WORKSPACE_CREATE" } as Record<string, string>)[normalized] ?? normalized;
};

export const uniquePermissions = (permissions?: string[] | null): string[] => {
  const seen = new Set<string>();
  const normalized: string[] = [];
  const source = Array.isArray(permissions) ? permissions : [];

  for (const permission of source) {
    const item = normalizePermission(permission);
    if (!item || seen.has(item)) {
      continue;
    }

    seen.add(item);
    normalized.push(item);
  }

  return normalized;
};

export const uniqueRoles = (roles?: string[] | null, fallbackRole?: string): string[] => {
  const seen = new Set<string>();
  const normalized: string[] = [];
  const source = Array.isArray(roles) ? roles : [];

  for (const role of source) {
    const item = normalizeRole(role);
    if (!item || seen.has(item)) {
      continue;
    }

    seen.add(item);
    normalized.push(item);
  }

  const fallback = normalizeRole(fallbackRole);
  if (fallback && !seen.has(fallback)) {
    normalized.unshift(fallback);
  }

  return normalized;
};

export const normalizeRolePermissionsMap = (
  rolePermissions?: Record<string, unknown> | null,
): RolePermissionsMap => {
  const normalizedMap: RolePermissionsMap = {};

  for (const [role, permissions] of Object.entries(rolePermissions ?? {})) {
    const roleName = normalizeRole(role);
    if (!roleName) {
      continue;
    }

    normalizedMap[roleName] = uniquePermissions(
      Array.isArray(permissions) ? permissions : [],
    );
  }

  return normalizedMap;
};

export const normalizeAuthRolePayload = (payload: AuthRolePayload) => {
  const permissions = uniquePermissions(payload.permissions ?? []);
  const role = normalizeRole(payload.role);
  const roles = uniqueRoles(payload.roles ?? [], role);
  const rolePermissions = normalizeRolePermissionsMap(payload.rolePermissions);

  if (role && !rolePermissions[role]) {
    rolePermissions[role] = [...permissions];
  }

  for (const item of roles) {
    if (!rolePermissions[item]) {
      rolePermissions[item] = item === role ? [...permissions] : [];
    }
  }

  const resolvedRole = role || roles[0] || "";
  if (resolvedRole && !roles.includes(resolvedRole)) {
    roles.unshift(resolvedRole);
  }

  if (resolvedRole && !rolePermissions[resolvedRole]) {
    rolePermissions[resolvedRole] = [...permissions];
  }

  return {
    role: resolvedRole,
    roles,
    permissions,
    rolePermissions,
  };
};

export const resolveEffectivePermissions = (
  activeRole: string | null,
  rolePermissions: RolePermissionsMap,
  allPermissions: string[],
): string[] => {
  const role = normalizeRole(activeRole);

  if (role === TEACHER_ROLE) {
    const teacherDefaults = new Set([
      "MENU_READ",
      "BOOK_CREATE",
      "BOOK_READ",
      "BOOK_UPDATE",
      "BOOK_DELETE",
      "EXAM_CREATE",
      "EXAM_READ",
      "EXAM_UPDATE",
      "EXAM_DELETE",
      "COURSE_CREATE",
      "COURSE_READ",
      "COURSE_UPDATE",
      "COURSE_DELETE",
      "ADMIN_ACCESS",
    ]);

    return uniquePermissions([
      ...(rolePermissions[role] ?? []),
      ...allPermissions.filter((permission) => teacherDefaults.has(permission)),
    ]);
  }

  if (role && rolePermissions[role]?.length) {
    return uniquePermissions(rolePermissions[role]);
  }

  if (role === STUDENT_ROLE) {
    const learnerPermissions = new Set([
      "MENU_READ", "BOOK_READ", "COURSE_READ", "LESSON_READ", "EXAM_TAKE",
      "ENROLLMENT_READ", "ENROLLMENT_CREATE", "ENROLLMENT_DELETE",
      "LEARNER_ACCESS", "LEARNING_SELF_READ", "ENROLL_COURSE",
    ]);
    return uniquePermissions(
      allPermissions.filter(
        (permission) =>
          permission.endsWith("_READ") || learnerPermissions.has(permission),
      ),
    );
  }

  return uniquePermissions(allPermissions);
};

export const formatRoleLabel = (role: string): string =>
  (normalizeRole(role) === STUDENT_ROLE ? "LEARNER" : normalizeRole(role))
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

export const getHomePathByRole = (role?: string | null, permissions?: string[]): string => {
  const normalizedRole = normalizeRole(role);
  if (!normalizedRole) return "/profile";

  if (normalizedRole === STUDENT_ROLE) {
    return !permissions || permissions.includes("LEARNING_SELF_READ") ? "/my-learning" : permissions.includes("COURSE_READ") ? "/courses" : "/profile";
  }

  if (normalizedRole === TEACHER_ROLE) {
    return "/teacher";
  }

  const grantedPermissions = new Set(uniquePermissions(permissions));
  if (!grantedPermissions.has("USER_READ") && grantedPermissions.has("WORKSPACE_READ")) {
    return "/management/workspaces/candidates";
  }

  if (!permissions || permissions.includes("USER_READ")) return "/dashboard";
  if (permissions.includes("BOOK_UPDATE")) return "/teacher";
  const landing = [["COURSE_READ", "/courses"], ["BOOK_READ", "/books"], ["EXAM_READ", "/exams"], ["ROLE_READ", "/roles"]]
    .find(([permission]) => permissions.includes(permission));
  return landing?.[1] ?? "/profile";
};

export const canAccessByPermission = (
  requiredPermission: string | undefined,
  hasPermission: (permission: string) => boolean,
): boolean => {
  if (!requiredPermission) {
    return true;
  }

  return hasPermission(requiredPermission);
};

// Shared by navigation and route guards, independent of server-provided menu labels.
export const canAccessPath = (path: string, activeRole: string | null, permissions: string[]): boolean => {
  const granted = new Set(uniquePermissions(permissions));
  path = path.replace(/\/+$/, "") || "/";
  if (["/profile", "/fams/profile", "/fams/ho-so-ca-nhan-oi-mat-khau", "/fams/ho-so-ca-nhan-doi-mat-khau"].includes(path)) return true;
  if (path === "/dashboard") return activeRole !== STUDENT_ROLE && granted.has("ADMIN_ACCESS") && granted.has("USER_READ");
  if (path === "/student" || path === "/student/exams") return activeRole === STUDENT_ROLE && granted.has("LEARNER_ACCESS");
  if (["/my-learning", "/fams/my-learning", "/learning", "/enrollments"].includes(path)) {
    return granted.has("LEARNER_ACCESS") && granted.has("LEARNING_SELF_READ");
  }
  if (["/courses", "/books"].some(p => path === p)) {
    return activeRole === STUDENT_ROLE ? granted.has("LEARNER_ACCESS") : granted.has("ADMIN_ACCESS");
  }
  return activeRole !== STUDENT_ROLE && granted.has("ADMIN_ACCESS");
};

export const availableAccountViews = (permissions: string[]): string[] => {
  const granted = new Set(uniquePermissions(permissions));
  return [
    ...(granted.has("ADMIN_ACCESS") ? [ADMIN_ROLE] : []),
    ...(granted.has("LEARNER_ACCESS") ? [STUDENT_ROLE] : []),
  ];
};

export const ROLE_HIDDEN_MODULE_URLS: Record<string, string[]> = {
  [STUDENT_ROLE]: ["/exams"],
};

export const ROLE_HIDDEN_MENU_GROUP_NAMES: Record<string, string[]> = {
  [STUDENT_ROLE]: ["Exam Management"],
};

export const ROLE_MOVED_MENU_MODULES: Record<string, Record<string, string>> = {
  [STUDENT_ROLE]: {
    "/invitations": "Student",
  },
};

export const normalizeModulePath = (url?: string | null): string =>
  (url ?? "").trim().toLowerCase().replace(/\/+$/, "");

export const normalizeMenuGroupName = (name?: string | null): string =>
  (name ?? "").trim().toLowerCase();

export const isModuleHiddenInMenu = (
  url: string | undefined,
  role: string | null | undefined,
): boolean => {
  if (!url) {
    return false;
  }

  const hidden = ROLE_HIDDEN_MODULE_URLS[normalizeRole(role)] ?? [];
  return hidden.includes(normalizeModulePath(url));
};

export const isMenuGroupHiddenInMenu = (
  groupName: string | undefined,
  role: string | null | undefined,
): boolean => {
  if (!groupName) {
    return false;
  }

  const hidden = ROLE_HIDDEN_MENU_GROUP_NAMES[normalizeRole(role)] ?? [];
  return hidden.some((name) => normalizeMenuGroupName(name) === normalizeMenuGroupName(groupName));
};

export const getMovedMenuGroupName = (
  url: string | undefined,
  role: string | null | undefined,
): string | undefined => {
  if (!url) {
    return undefined;
  }

  const moves = ROLE_MOVED_MENU_MODULES[normalizeRole(role)] ?? {};
  return moves[normalizeModulePath(url)];
};
