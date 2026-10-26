package com.example.starter_project_2025.system.project.milestone.submission.repository;

import com.example.starter_project_2025.system.project.milestone.submission.domain.MilestoneWaiver;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;
import java.util.Optional;

public interface MilestoneWaiverRepository extends JpaRepository<MilestoneWaiver, UUID> {
    boolean existsByMilestoneIdAndTeamId(UUID milestoneId, UUID teamId);
    Optional<MilestoneWaiver> findByTenantIdAndMilestoneIdAndTeamId(UUID tenantId, UUID milestoneId, UUID teamId);
}
