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
            List<MemberResponse> members,
            /** US-10: template assigned to this DRAFT team (null when unset). */
            Long projectTemplateId,
            String projectTemplateName,
            Integer minMembers,
            Integer maxMembers,
            Integer memberCount,
            /** US-11: template role policy. */
            boolean allowMultiRole,
            List<ProjectTemplateConstraints.RoleQuota> roleQuotas
    ) {
    }

    public record MemberResponse(
            Long memberId,
            String fullName,
            String userCode,
            String role,
            List<String> roles
    ) {
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