package com.example.starter_project_2025.system.project.milestone.integration.mock;

import com.example.starter_project_2025.system.project.milestone.exception.MilestoneValidationException;
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

    private final ReviewerData reviewer = new ReviewerData(
            MockMilestoneData.REVIEWER_ID,
            "Mentor Reviewer",
            true,
            true
    );

    @Override
    public List<ReviewerData> findEligibleReviewers(UUID projectId, UUID actorId, UUID tenantId) {
        return List.of(reviewer);
    }

    @Override
    public ReviewerData requireEligibleReviewer(
            UUID reviewerId, UUID projectId, UUID actorId, UUID tenantId) {
        if (!reviewer.id().equals(reviewerId) || !reviewer.active() || !reviewer.assignedToProject()) {
            throw new MilestoneValidationException(Map.of(
                    "reviewerId", List.of("Reviewer is not available")
            ));
        }
        return reviewer;
    }
}
