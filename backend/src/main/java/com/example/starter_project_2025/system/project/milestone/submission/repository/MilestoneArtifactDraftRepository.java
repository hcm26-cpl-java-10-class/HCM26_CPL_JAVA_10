package com.example.starter_project_2025.system.project.milestone.submission.repository;

import com.example.starter_project_2025.system.project.milestone.submission.domain.MilestoneArtifactDraft;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface MilestoneArtifactDraftRepository extends JpaRepository<MilestoneArtifactDraft, UUID> {
    Optional<MilestoneArtifactDraft> findByMilestoneIdAndProjectIdAndTenantId(
            UUID milestoneId, UUID projectId, UUID tenantId);
}
