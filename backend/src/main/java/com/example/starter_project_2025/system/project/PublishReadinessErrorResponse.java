package com.example.starter_project_2025.system.project;

import java.time.LocalDateTime;
import java.util.List;

/**
 * US-12: HTTP 422 body returned when a publish is blocked by strict mode.
 *
 * <p>The body contains both the free students (id + name so the UI can
 * highlight them) and every team-level readiness issue. The legacy
 * {@code unassignedMemberIds} list is kept for existing clients.
 */
public record PublishReadinessErrorResponse(
        int status,
        String errorCode,
        String message,
        int unassignedCount,
        List<Long> unassignedMemberIds,
        List<AllocationReadinessResponse.UnassignedStudent> unassignedMembers,
        List<AllocationReadinessResponse.TeamReadinessIssue> teamIssues,
        List<String> blockers,
        LocalDateTime timestamp
) {

    public static PublishReadinessErrorResponse from(
            AllocationReadinessResponse readiness,
            String errorCode,
            String message
    ) {
        return new PublishReadinessErrorResponse(
                org.springframework.http.HttpStatus.UNPROCESSABLE_ENTITY.value(),
                errorCode,
                message,
                readiness.unassignedStudentCount(),
                readiness.unassignedStudents().stream()
                        .map(AllocationReadinessResponse.UnassignedStudent::memberId)
                        .toList(),
                readiness.unassignedStudents(),
                readiness.teamIssues(),
                readiness.blockers(),
                LocalDateTime.now());
    }
}
