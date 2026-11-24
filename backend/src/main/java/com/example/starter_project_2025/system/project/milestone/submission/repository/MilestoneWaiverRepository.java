package com.example.starter_project_2025.system.project.milestone.submission.repository;

import com.example.starter_project_2025.system.project.milestone.submission.domain.MilestoneWaiver;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;
import java.util.Optional;

public interface MilestoneWaiverRepository extends JpaRepository<MilestoneWaiver, UUID> {
    boolean existsByMilestone_IdAndTeamId(UUID milestoneId, Long teamId);
    Optional<MilestoneWaiver> findByTenantIdAndMilestone_IdAndTeamId(Long tenantId, UUID milestoneId, Long teamId);
    java.util.List<MilestoneWaiver> findAllByTenantIdAndProjectIdAndTeamId(Long tenantId, Long projectId, Long teamId);
}
