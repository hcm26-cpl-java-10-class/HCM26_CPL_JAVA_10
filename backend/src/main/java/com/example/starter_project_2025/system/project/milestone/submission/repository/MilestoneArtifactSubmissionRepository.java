package com.example.starter_project_2025.system.project.milestone.submission.repository;

import com.example.starter_project_2025.system.project.milestone.submission.domain.MilestoneArtifactSubmission;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface MilestoneArtifactSubmissionRepository extends JpaRepository<MilestoneArtifactSubmission, UUID> {
    Optional<MilestoneArtifactSubmission> findTopByTenantIdAndProjectIdAndMilestoneIdAndSubmitterIdOrderByVersionDesc(
            Long tenantId, Long projectId, UUID milestoneId, UUID submitterId);
    Optional<MilestoneArtifactSubmission> findTopByTenantIdAndTeamIdAndMilestoneIdAndSubmitterIdOrderByVersionDesc(
            Long tenantId, Long teamId, UUID milestoneId, UUID submitterId);
    Optional<MilestoneArtifactSubmission> findTopByTenantIdAndProjectIdAndMilestoneIdOrderBySubmittedAtDesc(
            Long tenantId, Long projectId, UUID milestoneId);
    Optional<MilestoneArtifactSubmission> findTopByTenantIdAndTeamIdAndMilestoneIdOrderBySubmittedAtDesc(
            Long tenantId, Long teamId, UUID milestoneId);
    java.util.List<MilestoneArtifactSubmission> findByTenantIdAndTeamIdOrderBySubmittedAtDesc(Long tenantId, Long teamId);
    java.util.List<MilestoneArtifactSubmission> findByTenantIdAndTeamIdAndMilestoneIdOrderBySubmittedAtDesc(Long tenantId, Long teamId, UUID milestoneId);
}
