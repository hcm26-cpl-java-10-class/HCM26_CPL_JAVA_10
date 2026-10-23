package com.example.starter_project_2025.system.project.milestone.repository;

import com.example.starter_project_2025.system.project.milestone.domain.Milestone;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface MilestoneRepository extends JpaRepository<Milestone, UUID> {

    @EntityGraph(attributePaths = "checklistItems")
    Optional<Milestone> findByIdAndProjectIdAndTenantId(UUID id, UUID projectId, UUID tenantId);
}
