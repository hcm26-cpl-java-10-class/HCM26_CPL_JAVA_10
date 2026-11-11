package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.system.project.trainingclass.ClassMember;
import com.example.starter_project_2025.system.project.trainingclass.ClassMemberStatus;

public final class AllocationStudentEligibility {
    private AllocationStudentEligibility() { }

    public static boolean isEligible(ClassMember member) {
        return member.getStatus() == ClassMemberStatus.ACTIVE
                && Boolean.TRUE.equals(member.getUser().getIsActive());
    }
}
