package com.example.starter_project_2025.system.project;

public record AllocationSessionResponse(
        Long id,
        Long classId,
        Integer sessionNumber,
        Long projectTemplateId,
        Integer maxMembers,
        TeamAllocationSessionStatus status,
        Long version
) {
    public static AllocationSessionResponse from(TeamAllocationSession session, int sessionNumber) {
        return new AllocationSessionResponse(
                session.getId(),
                session.getTrainingClass().getId(),
                sessionNumber,
                session.getProjectTemplate().getId(),
                session.getMaxMembers(),
                session.getStatus(),
                session.getVersion()
        );
    }
}