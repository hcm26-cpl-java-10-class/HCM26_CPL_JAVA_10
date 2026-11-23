package com.example.starter_project_2025.system.project.milestone.submission.repository;

import com.example.starter_project_2025.system.project.milestone.submission.domain.MilestoneArtifactSubmission;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface MilestoneArtifactSubmissionRepository extends JpaRepository<MilestoneArtifactSubmission, UUID> {
    Optional<MilestoneArtifactSubmission> findTopByTenantIdAndProjectIdAndMilestone_IdAndSubmitterIdOrderByVersionDesc(
            Long tenantId, Long projectId, UUID milestoneId, UUID submitterId);
    Optional<MilestoneArtifactSubmission> findTopByTenantIdAndTeamIdAndMilestone_IdAndSubmitterIdOrderByVersionDesc(
            Long tenantId, Long teamId, UUID milestoneId, UUID submitterId);
    java.util.List<MilestoneArtifactSubmission> findByTenantIdAndTeamIdAndMilestone_IdAndSubmitterIdOrderByVersionDesc(
            Long tenantId, Long teamId, UUID milestoneId, UUID submitterId);
    Optional<MilestoneArtifactSubmission> findTopByTenantIdAndProjectIdAndMilestone_IdOrderBySubmittedAtDesc(
            Long tenantId, Long projectId, UUID milestoneId);
    Optional<MilestoneArtifactSubmission> findTopByTenantIdAndTeamIdAndMilestone_IdOrderBySubmittedAtDesc(
            Long tenantId, Long teamId, UUID milestoneId);
    java.util.List<MilestoneArtifactSubmission> findByTenantIdAndTeamIdOrderBySubmittedAtDesc(Long tenantId, Long teamId);
    java.util.List<MilestoneArtifactSubmission> findByTenantIdAndTeamIdAndMilestone_IdOrderBySubmittedAtDesc(Long tenantId, Long teamId, UUID milestoneId);
}
