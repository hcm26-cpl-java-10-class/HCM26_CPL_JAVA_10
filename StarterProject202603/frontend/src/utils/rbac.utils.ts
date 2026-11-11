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
  const role = normalizeRole(activeRole);

  if (role && rolePermissions[role]?.length) {
    return uniquePermissions(rolePermissions[role]);
  }

  if (role === STUDENT_ROLE) {
    return uniquePermissions(
      allPermissions.filter(
        (permission) =>
          permission.endsWith("_READ") || permission === "ENROLL_COURSE",
      ),
    );
  }

  if (role === TEACHER_ROLE) {
    const teacherDefaults = new Set([
      "MENU_READ",
      "BOOK_CREATE",
      "BOOK_READ",
      "BOOK_UPDATE",
      "BOOK_DELETE",
    ]);

    return uniquePermissions(
      allPermissions.filter((permission) => teacherDefaults.has(permission)),
    );
  }

  return uniquePermissions(allPermissions);
};

export const formatRoleLabel = (role: string): string =>
  normalizeRole(role)
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

export const getHomePathByRole = (role?: string | null): string => {
  const normalizedRole = normalizeRole(role);

  if (normalizedRole === STUDENT_ROLE) {
    return "/student";
  }

  if (normalizedRole === TEACHER_ROLE) {
    return "/teacher";
  }

  return "/dashboard";
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
