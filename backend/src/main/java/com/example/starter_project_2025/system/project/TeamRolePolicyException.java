package com.example.starter_project_2025.system.project;

import java.util.List;
import lombok.Getter;

/**
 * US-11: a team role configuration violates the project template policy
 * (multi-role disabled or role quota not met). Mapped to HTTP 422 by
 * {@code GlobalExceptionHandler}.
 */
@Getter
public class TeamRolePolicyException extends RuntimeException {

    private final String errorCode;
    private final List<Long> invalidMemberIds;
    private final List<TeamRoleQuotaViolation> violations;
    private final List<Long> multiRoleMemberIds;

    public TeamRolePolicyException(
            String errorCode,
            String message,
            List<Long> invalidMemberIds,
            List<TeamRoleQuotaViolation> violations,
            List<Long> multiRoleMemberIds
    ) {
        super(message);
        this.errorCode = errorCode;
        this.invalidMemberIds = invalidMemberIds == null ? List.of() : List.copyOf(invalidMemberIds);
        this.violations = violations == null ? List.of() : List.copyOf(violations);
        this.multiRoleMemberIds = multiRoleMemberIds == null
                ? List.of()
                : List.copyOf(multiRoleMemberIds);
    }

    public static TeamRolePolicyException multiRoleNotAllowed(List<Long> memberIds) {
        return new TeamRolePolicyException(
                "ERR_MULTI_ROLE_NOT_ALLOWED",
                "Đề bài dự án không cho phép kiêm nhiệm vai trò. "
                        + "Mỗi thành viên chỉ được đảm nhận đúng 1 vai trò.",
                memberIds,
                List.of(),
                memberIds);
    }

    public static TeamRolePolicyException quotaNotMet(
            String message,
            List<TeamRoleQuotaViolation> violations
    ) {
        return new TeamRolePolicyException(
                "ERR_TEAM_ROLE_QUOTA_NOT_MET",
                message,
                List.of(),
                violations,
                List.of());
    }

    public static TeamRolePolicyException leaderRoleRequired(Long memberId) {
        return new TeamRolePolicyException(
                "ERR_TEAM_LEADER_ROLE_REQUIRED",
                "Trưởng nhóm phải giữ vai trò PM để tiếp tục quản lý nhóm.",
                List.of(memberId),
                List.of(),
                List.of());
    }
}
