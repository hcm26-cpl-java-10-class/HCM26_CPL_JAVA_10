package com.example.starter_project_2025.system.project.milestone.repository;

import com.example.starter_project_2025.system.project.milestone.domain.Milestone;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.Optional;
import java.util.UUID;

public interface MilestoneRepository extends JpaRepository<Milestone, UUID> {

    Page<Milestone> findAllByProjectIdAndTenantId(UUID projectId, UUID tenantId, Pageable pageable);

    @EntityGraph(attributePaths = "checklistItems")
    Optional<Milestone> findByIdAndProjectIdAndTenantId(UUID id, UUID projectId, UUID tenantId);
}
