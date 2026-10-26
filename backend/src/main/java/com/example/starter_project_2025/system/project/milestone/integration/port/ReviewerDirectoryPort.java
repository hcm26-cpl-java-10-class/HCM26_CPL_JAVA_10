package com.example.starter_project_2025.system.project.milestone.integration.port;

import com.example.starter_project_2025.system.project.milestone.integration.model.ReviewerData;

import java.util.List;
import java.util.UUID;

public interface ReviewerDirectoryPort {
    List<ReviewerData> findEligibleReviewers(Long projectId, UUID actorId, Long tenantId);

    ReviewerData requireEligibleReviewer(UUID reviewerId, Long projectId, UUID actorId, Long tenantId);

    ReviewerData requireReviewerForRead(UUID reviewerId, Long projectId, Long tenantId);
}
