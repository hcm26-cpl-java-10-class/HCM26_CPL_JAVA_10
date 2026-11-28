package com.example.starter_project_2025.system.project.milestone.repository;

import com.example.starter_project_2025.system.project.milestone.domain.MilestoneDraftRevision;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface MilestoneDraftRevisionRepository extends JpaRepository<MilestoneDraftRevision, UUID> {
    List<MilestoneDraftRevision> findByMilestoneIdAndTenantIdOrderByRevisionNumberDesc(UUID milestoneId, Long tenantId);
}
