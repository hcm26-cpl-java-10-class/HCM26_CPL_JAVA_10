package com.example.starter_project_2025.system.project;

import java.util.List;

public record BatchSaveDraftResponse(
        String status,
        Long allocationSessionId,
        List<TeamResponse> teams,
        List<DraftWarning> warnings
) {
    public record TeamResponse(
            Long teamId,
            String teamName,
            ProjectTeamStatus status,
            Long assignedMentorId,
            String assignedMentorName,
            Long version,
            List<Long> memberIds,
            List<MemberResponse> members
    ) {
    }

    public record MemberResponse(Long memberId, String fullName, String role) {
    }

    public record DraftWarning(
            String code,
            Long memberId,
            String memberName,
            List<Long> conflictingTeamIds,
            List<String> conflictingTeamNames,
            String message
    ) {
    }
}