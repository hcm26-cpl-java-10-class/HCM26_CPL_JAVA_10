/* eslint-disable react-refresh/only-export-components */
import type { RootState } from "@/store/store";
import {
  ADMIN_ROLE,
  STUDENT_ROLE,
  TEACHER_ROLE,
  normalizeRole,
  uniqueRoles,
} from "@/utils/rbac.utils";
import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useSelector } from "react-redux";

interface RoleSwitchContextType {
  viewRole: string | null;
  activeRole: string | null;
  availableRoles: string[];
  isPreviewMode: boolean;
  setViewRole: (role: string | null) => void;
}

const RoleSwitchContext = createContext<RoleSwitchContextType | undefined>(
  undefined,
);

export const RoleSwitchProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isAuthenticated, role, roles, rolePermissions } = useSelector(
    (state: RootState) => state.auth,
  );

  const [viewRole, setViewRoleState] = useState<string | null>(null);

  const primaryRole = normalizeRole(role);

  const availableRoles = useMemo(() => {
    const roleCandidates = uniqueRoles(
      [
        ...Object.keys(rolePermissions ?? {}),
        ...(roles ?? []),
        primaryRole,
      ],
      primaryRole,
    );

    if (primaryRole === ADMIN_ROLE) {
      if (!roleCandidates.includes(STUDENT_ROLE)) {
        roleCandidates.push(STUDENT_ROLE);
      }

      if (!roleCandidates.includes(TEACHER_ROLE)) {
        roleCandidates.push(TEACHER_ROLE);
      }
    }

    return roleCandidates;
  }, [primaryRole, rolePermissions, roles]);

  const setViewRole = useCallback((nextRole: string | null) => {
    const normalizedRole = normalizeRole(nextRole);

    if (!normalizedRole) {
      setViewRoleState(null);
      return;
    }

    if (!availableRoles.includes(normalizedRole)) {
      return;
    }
    setViewRoleState(normalizedRole);
  }, [availableRoles]);

  const activeViewRole =
    isAuthenticated && viewRole && availableRoles.includes(viewRole) ? viewRole : null;
  const activeRole = activeViewRole || primaryRole || availableRoles[0] || null;
  const isPreviewMode = !!activeViewRole && normalizeRole(activeViewRole) !== primaryRole;

  return (
    <RoleSwitchContext.Provider
      value={{
        viewRole: activeViewRole,
        activeRole,
        availableRoles,
        isPreviewMode,
        setViewRole,
      }}
    >
      {children}
    </RoleSwitchContext.Provider>
  );
};

export const useRoleSwitch = () => {
  const ctx = useContext(RoleSwitchContext);
  if (!ctx) throw new Error("useRoleSwitch must be used inside provider");
  return ctx;
};
