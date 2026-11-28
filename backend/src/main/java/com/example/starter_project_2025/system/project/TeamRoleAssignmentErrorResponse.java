package com.example.starter_project_2025.system.project;

import java.time.LocalDateTime;
import java.util.List;

/**
 * US-11: 422 body of {@code ERR_INVALID_TEAM_MEMBER_ROLES},
 * {@code ERR_MULTI_ROLE_NOT_ALLOWED} and {@code ERR_TEAM_ROLE_QUOTA_NOT_MET}.
 */
public record TeamRoleAssignmentErrorResponse(
        int status,
        String errorCode,
        String message,
        List<Long> invalidMemberIds,
        List<TeamRoleQuotaViolation> violations,
        List<Long> multiRoleMemberIds,
        LocalDateTime timestamp
) {
}
