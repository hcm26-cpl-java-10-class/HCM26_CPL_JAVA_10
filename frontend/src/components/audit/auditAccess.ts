/**
 * The audit log is only for users who really have the ADMIN role.
 *
 * Do not use the "active view" (activeRole) for this check: in the role switcher a TEACHER also works in the
 * admin view, so the view says ADMIN even though the account is not an administrator. The backend also
 * requires the real ADMIN role, so the menu, the route and the History button follow the same rule.
 */
export function isAuditAdmin(roles?: string[] | null): boolean {
  return (roles ?? []).some(
    (role) => role?.trim().toUpperCase().replace(/^ROLE_/, "") === "ADMIN",
  );
}
