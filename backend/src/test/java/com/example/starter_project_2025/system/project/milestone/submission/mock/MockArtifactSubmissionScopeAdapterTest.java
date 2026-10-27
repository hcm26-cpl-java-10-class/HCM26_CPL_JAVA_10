package com.example.starter_project_2025.system.project.milestone.submission.mock;

import com.example.starter_project_2025.system.project.milestone.integration.mock.MockMilestoneData;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

class MockArtifactSubmissionScopeAdapterTest {

    private final MockArtifactSubmissionScopeAdapter scope =
            new MockArtifactSubmissionScopeAdapter("student@example.com=1", "student@example.com=1");

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void administratorCanAccessArtifactSubmissionWithoutStudentAssignment() {
        authenticate("ROLE_ADMIN");
        UUID adminId = UUID.randomUUID();

        assertDoesNotThrow(() -> scope.requireStudentProjectAccess(99L, adminId, MockMilestoneData.TENANT_ID));
        assertDoesNotThrow(() -> scope.requireStudentTeamAccess(99L, adminId, MockMilestoneData.TENANT_ID));
    }

    @Test
    void studentStillNeedsProjectAndTeamAssignments() {
        authenticate("ROLE_STUDENT");
        UUID studentId = UUID.nameUUIDFromBytes("student@example.com".getBytes(StandardCharsets.UTF_8));

        assertDoesNotThrow(() -> scope.requireStudentProjectAccess(1L, studentId, MockMilestoneData.TENANT_ID));
        assertDoesNotThrow(() -> scope.requireStudentTeamAccess(1L, studentId, MockMilestoneData.TENANT_ID));
        assertThrows(AccessDeniedException.class,
                () -> scope.requireStudentProjectAccess(2L, studentId, MockMilestoneData.TENANT_ID));
        assertThrows(AccessDeniedException.class,
                () -> scope.requireStudentTeamAccess(2L, studentId, MockMilestoneData.TENANT_ID));
    }

    private void authenticate(String authority) {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(
                        "actor", null, List.of(new SimpleGrantedAuthority(authority))));
    }
}
