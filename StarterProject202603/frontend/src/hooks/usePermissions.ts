import type { RootState } from "@/store/store";
import { normalizePermission, resolveEffectivePermissions } from "@/utils/rbac.utils";
import { useMemo } from "react";
import { useSelector } from "react-redux";
import { useRoleSwitch } from "@/contexts/RoleSwitchContext";

export const usePermissions = () => {
  const { permissions, role, roles, rolePermissions, email, firstName, lastName } = useSelector(
    (state: RootState) => state.auth,
  );
  const { activeRole, viewRole, availableRoles, isPreviewMode } = useRoleSwitch();

  const effectivePermissions = useMemo(
    () => resolveEffectivePermissions(activeRole, rolePermissions, permissions),
    [activeRole, rolePermissions, permissions],
  );

  const effectivePermissionSet = useMemo(
    () => new Set(effectivePermissions.map((permission) => normalizePermission(permission))),
    [effectivePermissions],
  );

  const user = {
    email,
    role,
    roles,
    firstName,
    lastName,
    permissions,
    rolePermissions,
  };

  const hasPermission = (permission: string): boolean =>
    effectivePermissionSet.has(normalizePermission(permission));

  const hasAnyPermission = (requiredPermissions: string[]): boolean =>
    requiredPermissions.some((permission) => hasPermission(permission));

  const hasAllPermissions = (requiredPermissions: string[]): boolean =>
    requiredPermissions.every((permission) => hasPermission(permission));

  const canAccessResource = (resource: string, action: string): boolean =>
    hasPermission(`${resource.toUpperCase()}_${action.toUpperCase()}`);

  return {
    user,
    activeRole,
    viewRole,
    availableRoles,
    isPreviewMode,
    effectivePermissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canAccessResource,
  };
};
