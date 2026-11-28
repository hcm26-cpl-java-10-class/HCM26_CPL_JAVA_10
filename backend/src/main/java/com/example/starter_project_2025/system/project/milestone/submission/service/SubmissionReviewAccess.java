package com.example.starter_project_2025.system.project.milestone.submission.service;

import com.example.starter_project_2025.system.project.milestone.integration.port.CurrentActorProvider;
import com.example.starter_project_2025.system.project.milestone.submission.domain.MilestoneSubmission;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class SubmissionReviewAccess {
    private final CurrentActorProvider actors;

    public boolean canReview(MilestoneSubmission submission) {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) return false;
        boolean permission = authentication.getAuthorities().stream()
                .anyMatch(authority -> "ARTIFACT_REVIEW".equals(authority.getAuthority()));
        if (!permission) return false;
        boolean admin = authentication.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_ADMIN".equals(authority.getAuthority()) || "ROLE_SUPER_ADMIN".equals(authority.getAuthority()));
        // Shared master scope is checked by SubmissionQueryService.require before this policy.
        return admin || submission.getTeamId() == null
                || actors.requireCurrentActorId().equals(submission.getAssignedReviewerId());
    }

    public void require(MilestoneSubmission submission) {
        if (!canReview(submission)) throw new AccessDeniedException("Only an authorized reviewer assigned to this submission can review it");
    }
}
