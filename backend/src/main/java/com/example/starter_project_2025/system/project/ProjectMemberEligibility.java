package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.system.project.trainingclass.ClassMemberStatus;
import java.util.Objects;

/** Shared eligibility for the work-item detail picker and the workspace board. */
public final class ProjectMemberEligibility {
    private ProjectMemberEligibility() { }

    public static boolean canAssign(ProjectMember member) {
        if (!belongsToTeamRoster(member) || !Boolean.TRUE.equals(member.getIsActive())) return false;
        var classMember = member.getClassMember();
        if (classMember == null || !Boolean.TRUE.equals(classMember.getIsActive())
                || classMember.getStatus() != ClassMemberStatus.ACTIVE) return false;
        var user = classMember.getUser();
        return user != null && Boolean.TRUE.equals(user.getIsActive()) && !Boolean.TRUE.equals(user.getLocked());
    }

    /** Also applied to historical display names; inactive users may still be named. */
    public static boolean belongsToTeamRoster(ProjectMember member) {
        if (member == null || member.getTeam() == null || member.getTeam().getTrainingClass() == null
                || member.getClassMember() == null || member.getClassMember().getTrainingClass() == null
                || member.getClassMember().getUser() == null) return false;
        var trainingClass = member.getTeam().getTrainingClass();
        return trainingClass.getTenantId() != null
                && Objects.equals(trainingClass.getId(), member.getClassMember().getTrainingClass().getId())
                && Objects.equals(trainingClass.getTenantId(), member.getClassMember().getUser().getTenantId());
    }
}
