import React from "react";
import { usePermissions } from "@/hooks/usePermissions";

interface PermissionGateProps {
  permission?: string;
  permissions?: string[];
  requireAll?: boolean;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export const PermissionGate: React.FC<PermissionGateProps> = ({
  permission,
  permissions = [],
  requireAll = false,
  fallback = null,
  children,
}) => {
  const { hasAnyPermission, hasAllPermissions } = usePermissions();

  const requiredPermissions = [permission, ...permissions].filter(
    (item): item is string => !!item,
  );

  if (requiredPermissions.length === 0) {
    return <>{children}</>;
  }

  const allowed = requireAll
    ? hasAllPermissions(requiredPermissions)
    : hasAnyPermission(requiredPermissions);

  if (!allowed) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};
