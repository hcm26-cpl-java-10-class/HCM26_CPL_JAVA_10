package com.example.starter_project_2025.system.project;

import java.time.LocalDateTime;
import java.util.List;

/**
 * US-12: strict-mode readiness report for a {@link TeamAllocationSession}.
 *
 * <p>The report answers whether the whole class/cohort is ready to publish:
 * <ul>
 *     <li>every ACTIVE student already belongs to a team of the session,</li>
 *     <li>every team carries a valid {@code ProjectTemplate},</li>
 *     <li>every team size fits the template capacity window,</li>
 *     <li>every member has a valid role and the template role quotas are met.</li>
 * </ul>
 *
 * <p>{@code GET /api/v1/classes/{classId}/allocation-sessions/{sessionId}/readiness}
 * returns this body with HTTP 200 so the UI can render the checks. When a
 * publish is blocked the same data is embedded in the HTTP 422 response.
 */
public record AllocationReadinessResponse(
        Long allocationSessionId,
        Long classId,
        TeamAllocationSessionStatus sessionStatus,
        boolean readyToPublish,
        int totalStudents,
        int assignedStudents,
        int unassignedStudentCount,
        List<UnassignedStudent> unassignedStudents,
        int totalTeams,
        int draftTeamCount,
        int activeTeamCount,
        int teamsWithTemplate,
        List<TeamReadinessIssue> teamIssues,
        List<String> blockers,
        LocalDateTime checkedAt
) {

    /** A free student that has no team in the session yet. */
    public record UnassignedStudent(Long memberId, String fullName) {
    }

    /**
     * One blocker attached to a team.
     *
     * @param code       one of the {@code ERR_*} constants in
     *                   {@link AllocationReadinessService}
     * @param memberIds  members involved (invalid/multi-role); empty otherwise
     * @param violations role quota violations, empty when not a quota issue
     */
    public record TeamReadinessIssue(
            Long teamId,
            String teamName,
            String code,
            String message,
            List<Long> memberIds,
            List<TeamRoleQuotaViolation> violations
    ) {
    }
}
