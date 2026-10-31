package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.system.project.trainingclass.ClassMemberStatus;

/** Shared eligibility for the work-item detail picker and the workspace board. */
public final class ProjectMemberEligibility {
    private ProjectMemberEligibility() { }

    public static boolean canAssign(ProjectMember member) {
        if (member == null || !Boolean.TRUE.equals(member.getIsActive())) return false;
        var classMember = member.getClassMember();
        if (classMember == null || !Boolean.TRUE.equals(classMember.getIsActive())
                || classMember.getStatus() != ClassMemberStatus.ACTIVE) return false;
        var user = classMember.getUser();
        return user != null && Boolean.TRUE.equals(user.getIsActive()) && !Boolean.TRUE.equals(user.getLocked());
    }
}
