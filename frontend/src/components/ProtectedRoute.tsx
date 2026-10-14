import React from "react";
import { Navigate } from "react-router-dom";

import { useSelector } from "react-redux";
import type { RootState } from "@/store/store";
import { usePermissions } from "@/hooks/usePermissions";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: string;
  requiredPermissions?: string[];
  requireAll?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredPermission,
  requiredPermissions,
  requireAll = false,
}) => {
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  const { hasPermission, hasAnyPermission, hasAllPermissions } = usePermissions();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (requiredPermissions?.length) {
    const hasAccess = requireAll
      ? hasAllPermissions(requiredPermissions)
      : hasAnyPermission(requiredPermissions);

    if (!hasAccess) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return <>{children}</>;
};
