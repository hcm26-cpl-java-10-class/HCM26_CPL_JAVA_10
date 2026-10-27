package com.example.starter_project_2025.system.project.milestone.repository;

import com.example.starter_project_2025.system.project.milestone.domain.Milestone;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.Optional;
import java.util.UUID;
import java.util.List;

public interface MilestoneRepository extends JpaRepository<Milestone, UUID>, JpaSpecificationExecutor<Milestone> {
    List<Milestone> findAllByProjectIdIsNull();

    @org.springframework.data.jpa.repository.Modifying(clearAutomatically = true, flushAutomatically = true)
    @org.springframework.data.jpa.repository.Query("""
            update Milestone milestone
               set milestone.projectId = :projectId
             where milestone.id = :milestoneId
               and milestone.tenantId = :tenantId
               and milestone.teamId = :teamId
               and milestone.projectId is null
            """)
    int attachProjectScope(UUID milestoneId, Long tenantId, Long teamId, Long projectId);

    java.util.List<Milestone> findByProjectIdAndTenantIdAndActiveTrueOrderByDeadlineAscIdAsc(Long projectId, Long tenantId);

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select m from Milestone m where m.id = :id and m.projectId = :projectId and m.tenantId = :tenantId and m.active = true")
    Optional<Milestone> lockForRisk(UUID id, Long projectId, Long tenantId);

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select m from Milestone m where m.id = :id and m.projectId = :projectId and m.tenantId = :tenantId and m.active = true")
    Optional<Milestone> lockForSubmission(UUID id, Long projectId, Long tenantId);

    boolean existsByTenantIdAndProjectIdAndTitle(Long tenantId, Long projectId, String title);

    Optional<Milestone> findByTenantIdAndProjectIdAndTitle(Long tenantId, Long projectId, String title);

    boolean existsByRubricSnapshotId(UUID rubricSnapshotId);

    long countByRubricSnapshotId(UUID rubricSnapshotId);

    Page<Milestone> findAllByProjectIdAndTenantId(Long projectId, Long tenantId, Pageable pageable);

    @EntityGraph(attributePaths = "checklistItems")
    Optional<Milestone> findByIdAndProjectIdAndTenantId(UUID id, Long projectId, Long tenantId);

    @EntityGraph(attributePaths = "checklistItems")
    Optional<Milestone> findByIdAndTenantId(UUID id, Long tenantId);

    @EntityGraph(attributePaths = "checklistItems")
    Optional<Milestone> findByIdAndTeamIdAndTenantId(UUID id, Long teamId, Long tenantId);
    boolean existsByTeamIdAndTenantIdAndActiveTrue(Long teamId, Long tenantId);

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select m from Milestone m where m.id = :id and m.teamId = :teamId and m.tenantId = :tenantId and m.active = true")
    Optional<Milestone> lockForTeamSubmission(UUID id, Long teamId, Long tenantId);

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select m from Milestone m where m.id = :id and m.projectId = :projectId and m.tenantId = :tenantId and m.active = true")
    Optional<Milestone> lockForProjectOpen(UUID id, Long projectId, Long tenantId);

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select m from Milestone m where m.id = :id and m.teamId = :teamId and m.tenantId = :tenantId and m.active = true")
    Optional<Milestone> lockForTeamOpen(UUID id, Long teamId, Long tenantId);
}
