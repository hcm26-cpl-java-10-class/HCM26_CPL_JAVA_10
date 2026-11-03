package com.example.starter_project_2025.system.project;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.example.starter_project_2025.system.project.trainingclass.ClassMember;
import com.example.starter_project_2025.system.project.trainingclass.ClassMemberStatus;
import com.example.starter_project_2025.system.rbac.user.User;
import org.junit.jupiter.api.Test;

class AllocationStudentEligibilityTest {
    @Test
    void lockedAccountWithActiveStudentMembershipIsStillEligible() {
        User student = User.builder().firstName("Student").locked(true).build();
        student.setIsActive(true);
        ClassMember member = ClassMember.builder().user(student)
                .status(ClassMemberStatus.ACTIVE).build();
        assertTrue(AllocationStudentEligibility.isEligible(member));

        student.setIsActive(false);
        assertFalse(AllocationStudentEligibility.isEligible(member));
    }
}
