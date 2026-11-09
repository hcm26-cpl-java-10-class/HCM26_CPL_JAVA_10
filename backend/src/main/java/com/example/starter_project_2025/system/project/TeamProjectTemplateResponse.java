package com.example.starter_project_2025.system.project;

import java.util.List;

/**
 * US-10/US-11: the project template currently attached to a team, the live
 * team size, the template role policy and the current member roles.
 */
public record TeamProjectTemplateResponse(
        Long teamId,
        String teamName,
        ProjectTeamStatus teamStatus,
        Long version,
        Long classId,
        String className,
        Long projectTemplateId,
        String projectTemplateName,
        Integer minMembers,
        Integer maxMembers,
        int memberCount,
        boolean allowMultiRole,
        List<ProjectTemplateConstraints.RoleQuota> roleQuotas,
        List<Member> members,
        /** US-13: project silently created from the brief, {@code null} before provisioning. */
        Long projectId,
        String projectCode
) {
    public record Member(Long memberId, String fullName, String userCode, List<String> roles) {
    }
}
