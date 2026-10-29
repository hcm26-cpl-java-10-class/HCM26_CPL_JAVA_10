package com.example.starter_project_2025.system.project.rubric.repository;

import com.example.starter_project_2025.system.project.rubric.domain.RubricVersion;
import com.example.starter_project_2025.system.project.rubric.domain.RubricVersionStatus;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

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

    @Query("""
            select v from RubricVersion v
            where v.rubric.tenantId = :tenantId
              and (:status is null or v.status = :status)
              and (:search = '' or lower(v.nameSnapshot) like lower(concat('%', :search, '%'))
                   or lower(coalesce(v.descriptionSnapshot, '')) like lower(concat('%', :search, '%')))
            """)
    List<RubricVersion> searchAll(@Param("tenantId") UUID tenantId,
                                  @Param("search") String search,
                                  @Param("status") RubricVersionStatus status);
}
