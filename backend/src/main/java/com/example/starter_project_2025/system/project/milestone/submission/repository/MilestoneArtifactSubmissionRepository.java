package com.example.starter_project_2025.system.project.milestone.submission.repository;

import com.example.starter_project_2025.system.project.milestone.submission.domain.MilestoneArtifactSubmission;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface MilestoneArtifactSubmissionRepository extends JpaRepository<MilestoneArtifactSubmission, UUID> {
    Optional<MilestoneArtifactSubmission> findTopByTenantIdAndProjectIdAndMilestoneIdAndSubmitterIdOrderByVersionDesc(
            Long tenantId, Long projectId, UUID milestoneId, UUID submitterId);
}
