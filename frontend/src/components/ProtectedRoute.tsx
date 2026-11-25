import React from "react";
import { Navigate, useLocation } from "react-router-dom";

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
  const { activeRole, hasPermission, hasAnyPermission, hasAllPermissions } = usePermissions();

  const { pathname } = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (activeRole === "STUDENT" && (/^\/exams(?:\/|$)/.test(pathname) || /^\/management\/exam(?:\/|$)/.test(pathname))) {
    return <Navigate to="/student/exams" replace />;
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
