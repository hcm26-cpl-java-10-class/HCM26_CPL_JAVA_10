import type { RootState } from "@/store/store";
import {
  ADMIN_ROLE,
  STUDENT_ROLE,
  TEACHER_ROLE,
  normalizeRole,
  uniqueRoles,
} from "@/utils/rbac.utils";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";

interface RoleSwitchContextType {
  viewRole: string | null;
  activeRole: string | null;
  availableRoles: string[];
  isPreviewMode: boolean;
  setViewRole: (role: string | null) => void;
}

const VIEW_ROLE_STORAGE_KEY = "viewRole";

const RoleSwitchContext = createContext<RoleSwitchContextType | undefined>(
  undefined,
);

export const RoleSwitchProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isAuthenticated, role, roles, rolePermissions } = useSelector(
    (state: RootState) => state.auth,
  );

  const [viewRole, setViewRoleState] = useState<string | null>(() => {
    const storedRole = localStorage.getItem(VIEW_ROLE_STORAGE_KEY);
    const normalizedRole = normalizeRole(storedRole);
    return normalizedRole || null;
  });

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

  useEffect(() => {
    if (!isAuthenticated) {
      setViewRoleState(null);
      localStorage.removeItem(VIEW_ROLE_STORAGE_KEY);
      return;
    }

    setViewRoleState((currentViewRole) => {
      if (!currentViewRole || availableRoles.includes(currentViewRole)) {
        return currentViewRole;
      }

      localStorage.removeItem(VIEW_ROLE_STORAGE_KEY);
      return null;
    });
  }, [availableRoles, isAuthenticated]);

  const setViewRole = (nextRole: string | null) => {
    const normalizedRole = normalizeRole(nextRole);

    if (!normalizedRole) {
      setViewRoleState(null);
      localStorage.removeItem(VIEW_ROLE_STORAGE_KEY);
      return;
    }

    if (!availableRoles.includes(normalizedRole)) {
      return;
    }

    setViewRoleState(normalizedRole);
    localStorage.setItem(VIEW_ROLE_STORAGE_KEY, normalizedRole);
  };

  const activeRole = viewRole || primaryRole || availableRoles[0] || null;
  const isPreviewMode = !!viewRole && normalizeRole(viewRole) !== primaryRole;

  return (
    <RoleSwitchContext.Provider
      value={{
        viewRole,
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
