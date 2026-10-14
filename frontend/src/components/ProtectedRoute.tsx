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
  const { hasPermission, hasAnyPermission, hasAllPermissions, isPreviewMode } = usePermissions();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // In preview mode (e.g. admin previewing the Student view), permission checks
  // run against the previewed role — which the user does not actually hold.
  // Bypass them so authorized previews never land on the 403 page.
  if (isPreviewMode) {
    return <>{children}</>;
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
