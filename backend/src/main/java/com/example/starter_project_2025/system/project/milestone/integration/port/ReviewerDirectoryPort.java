package com.example.starter_project_2025.system.project.milestone.integration.port;

import com.example.starter_project_2025.system.project.milestone.integration.model.ReviewerData;

import java.util.List;
import java.util.UUID;

public interface ReviewerDirectoryPort {
    List<ReviewerData> findEligibleReviewers(UUID projectId, UUID actorId, UUID tenantId);

    ReviewerData requireEligibleReviewer(UUID reviewerId, UUID projectId, UUID actorId, UUID tenantId);
}
