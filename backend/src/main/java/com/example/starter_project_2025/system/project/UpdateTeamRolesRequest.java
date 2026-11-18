package com.example.starter_project_2025.system.project;

import java.util.List;

/**
 * US-11: save the role configuration of a team.
 *
 * <p>{@code roles} is the preferred field and supports multi-role templates
 * ({@code ["PM","BA"]}). {@code role} is kept for backward compatibility with
 * the original single-role payload and with existing clients/tests.</p>
 */
public record UpdateTeamRolesRequest(
        Long expectedVersion,
        List<MemberRoleAssignment> members
) {
    public record MemberRoleAssignment(
            Long memberId,
            String role,
            List<String> roles
    ) {

        /** Backward compatible single-role constructor. */
        public MemberRoleAssignment(Long memberId, String role) {
            this(memberId, role, null);
        }

        /** Resolves the requested roles from either {@code roles} or {@code role}. */
        public List<String> resolveRoles() {
            if (roles != null && !roles.isEmpty()) {
                return roles;
            }
            if (role != null && !role.isBlank()) {
                return List.of(role);
            }
            return List.of();
        }
    }
}
