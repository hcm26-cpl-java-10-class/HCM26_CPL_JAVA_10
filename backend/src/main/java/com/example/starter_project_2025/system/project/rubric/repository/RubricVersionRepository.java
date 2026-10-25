package com.example.starter_project_2025.system.project.rubric.repository;

import com.example.starter_project_2025.system.project.rubric.domain.RubricVersion;
import com.example.starter_project_2025.system.project.rubric.domain.RubricVersionStatus;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RubricVersionRepository extends JpaRepository<RubricVersion, UUID> {
    @EntityGraph(attributePaths = {"rubric", "criteria"})
    Optional<RubricVersion> findByIdAndRubricTenantId(UUID id, UUID tenantId);

    @EntityGraph(attributePaths = {"rubric", "criteria"})
    Optional<RubricVersion> findByIdAndRubricIdAndRubricTenantId(UUID id, UUID rubricId, UUID tenantId);

    @EntityGraph(attributePaths = {"rubric", "criteria"})
    List<RubricVersion> findAllByRubricTenantIdAndStatusOrderByNameSnapshotAscVersionNumberDesc(
            UUID tenantId, RubricVersionStatus status);

    boolean existsByRubricIdAndStatus(UUID rubricId, RubricVersionStatus status);
}
