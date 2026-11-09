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

export const normalizePermission = (permission?: string | null): string =>
  (permission ?? "").trim().toUpperCase();

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
  // Views only narrow real account permissions; they never add authorities.
  const granted = uniquePermissions(allPermissions);
  void rolePermissions;
  if (normalizeRole(activeRole) === STUDENT_ROLE) {
    const learnerPermissions = new Set([
      "MENU_READ", "BOOK_READ", "COURSE_READ", "LESSON_READ", "EXAM_TAKE",
      "ENROLLMENT_READ", "ENROLLMENT_CREATE", "ENROLLMENT_DELETE",
      "LEARNER_ACCESS", "LEARNING_SELF_READ",
    ]);
    return granted.filter(p => learnerPermissions.has(p));
  }
  return granted;

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
