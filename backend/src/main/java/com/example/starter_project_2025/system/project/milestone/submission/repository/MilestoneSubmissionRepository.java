package com.example.starter_project_2025.system.project.milestone.submission.repository;

import com.example.starter_project_2025.system.project.milestone.submission.domain.MilestoneSubmission;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MilestoneSubmissionRepository extends JpaRepository<MilestoneSubmission, UUID>,
        JpaSpecificationExecutor<MilestoneSubmission> {
    @EntityGraph(attributePaths = {"milestone", "milestone.checklistItems"})
    Optional<MilestoneSubmission> findByIdAndTenantId(UUID id, UUID tenantId);

    Optional<MilestoneSubmission> findByMilestoneIdAndTeamId(UUID milestoneId, UUID teamId);

    List<MilestoneSubmission> findAllByProjectIdAndMilestoneMandatoryTrue(UUID projectId);

    boolean existsByMilestoneIdAndTeamIdAndStatus(UUID milestoneId, UUID teamId,
                                                  com.example.starter_project_2025.system.project.milestone.submission.domain.SubmissionStatus status);
}
