import { canAccessByPermission } from "@/utils/rbac.utils";

export const canAccessMenuItem = (
    requiredPermission?: string,
    hasPermission?: (p: string) => boolean
) => {
    if (!hasPermission) return !requiredPermission
    return canAccessByPermission(requiredPermission, hasPermission)
}
