package com.example.starter_project_2025.system.project.milestone.repository;

import com.example.starter_project_2025.system.project.milestone.domain.Milestone;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.Optional;
import java.util.UUID;

public interface MilestoneRepository extends JpaRepository<Milestone, UUID>, JpaSpecificationExecutor<Milestone> {
    java.util.List<Milestone> findByProjectIdAndTenantIdAndActiveTrueOrderByDeadlineAscIdAsc(UUID projectId, UUID tenantId);

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select m from Milestone m where m.id = :id and m.projectId = :projectId and m.tenantId = :tenantId and m.active = true")
    Optional<Milestone> lockForRisk(UUID id, UUID projectId, UUID tenantId);

    boolean existsByTenantIdAndProjectIdAndTitle(UUID tenantId, UUID projectId, String title);

    boolean existsByRubricSnapshotId(UUID rubricSnapshotId);

    long countByRubricSnapshotId(UUID rubricSnapshotId);

    Page<Milestone> findAllByProjectIdAndTenantId(UUID projectId, UUID tenantId, Pageable pageable);

    @EntityGraph(attributePaths = "checklistItems")
    Optional<Milestone> findByIdAndProjectIdAndTenantId(UUID id, UUID projectId, UUID tenantId);
}
