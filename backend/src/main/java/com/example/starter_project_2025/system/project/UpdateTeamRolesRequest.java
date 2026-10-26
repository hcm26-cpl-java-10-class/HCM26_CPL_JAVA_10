package com.example.starter_project_2025.system.project;

import java.util.List;

public record UpdateTeamRolesRequest(
        Long expectedVersion,
        List<MemberRoleAssignment> members
) {
    public record MemberRoleAssignment(Long memberId, String role) {
    }
}
