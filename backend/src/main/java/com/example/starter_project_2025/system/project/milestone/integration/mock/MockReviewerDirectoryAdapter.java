package com.example.starter_project_2025.system.project.milestone.integration.mock;

import com.example.starter_project_2025.system.project.milestone.exception.MilestoneValidationException;
import com.example.starter_project_2025.system.project.milestone.exception.MilestoneDependencyException;
import com.example.starter_project_2025.system.project.milestone.integration.model.ReviewerData;
import com.example.starter_project_2025.system.project.milestone.integration.port.ReviewerDirectoryPort;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Component
@Profile("!milestone-real-integrations")
public class MockReviewerDirectoryAdapter implements ReviewerDirectoryPort {

    private final List<ReviewerData> reviewers = List.of(
            new ReviewerData(MockMilestoneData.REVIEWER_ID, "Mentor Reviewer", true, true),
            new ReviewerData(MockMilestoneData.SECONDARY_REVIEWER_ID, "Academic Reviewer", true, true),
            new ReviewerData(MockMilestoneData.TECHNICAL_REVIEWER_ID, "Technical Lead", true, true)
    );

    @Override
    public List<ReviewerData> findEligibleReviewers(Long projectId, UUID actorId, Long tenantId) {
        return reviewers;
    }

    @Override
    public ReviewerData requireEligibleReviewer(
            UUID reviewerId, Long projectId, UUID actorId, Long tenantId) {
        return reviewers.stream()
                .filter(reviewer -> reviewer.id().equals(reviewerId)
                        && reviewer.active()
                        && reviewer.assignedToProject())
                .findFirst()
                .orElseThrow(() -> new MilestoneValidationException(Map.of(
                        "reviewerId", List.of("Reviewer is not available")
                )));
    }

    @Override
    public ReviewerData requireReviewerForRead(UUID reviewerId, Long projectId, Long tenantId) {
        if (!MockMilestoneData.TENANT_ID.equals(tenantId)) {
            throw new MilestoneDependencyException("Milestone reviewer could not be loaded");
        }
        return reviewers.stream()
                .filter(reviewer -> reviewer.id().equals(reviewerId))
                .findFirst()
                .orElseThrow(() -> new MilestoneDependencyException(
                        "Milestone reviewer could not be loaded"));
    }
}
