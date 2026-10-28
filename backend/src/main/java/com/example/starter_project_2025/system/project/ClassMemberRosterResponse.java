package com.example.starter_project_2025.system.project;

public record ClassMemberRosterResponse(
        Long memberId,
        String fullName,
        String userCode,
        boolean assignedToActiveTeam
) {
}
