package com.example.starter_project_2025.system.project;

import java.time.LocalDateTime;

public record ProjectTeamMemberHistoryResponse(
        Long id,
        Long classId,
        Long cohortId,
        Long allocationSessionId,
        Long memberId,
        String memberName,
        Long fromTeamId,
        String fromTeamName,
        Long toTeamId,
        String toTeamName,
        String fromRole,
        String toRole,
        String action,
        String reason,
        Long actorId,
        String actorName,
        LocalDateTime occurredAt
) {
    public static ProjectTeamMemberHistoryResponse from(ProjectTeamMemberHistory history) {
        return new ProjectTeamMemberHistoryResponse(
                history.getId(),
                history.getClassId(),
                history.getCohortId(),
                history.getAllocationSessionId(),
                history.getMemberId(),
                history.getMemberName(),
                history.getFromTeamId(),
                history.getFromTeamName(),
                history.getToTeamId(),
                history.getToTeamName(),
                history.getFromRole(),
                history.getToRole(),
                history.getAction(),
                history.getReason(),
                history.getActorId(),
                history.getActorName(),
                history.getCreatedAt());
    }
}
