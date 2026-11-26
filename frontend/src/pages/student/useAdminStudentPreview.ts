import { usePermissions } from "@/hooks/usePermissions";
import { ADMIN_ROLE, normalizeRole, STUDENT_ROLE } from "@/utils/rbac.utils";

export function useAdminStudentPreview() {
  const { user, activeRole, isPreviewMode } = usePermissions();
  return isPreviewMode
    && normalizeRole(user.role) === ADMIN_ROLE
    && normalizeRole(activeRole) === STUDENT_ROLE;
}
