package com.example.starter_project_2025.system.project.rubric.repository;

import com.example.starter_project_2025.system.project.rubric.domain.Rubric;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import com.example.starter_project_2025.system.project.rubric.domain.RubricVersionStatus;

import java.util.Optional;
import java.util.List;
import java.util.UUID;

public interface RubricRepository extends JpaRepository<Rubric, UUID>, JpaSpecificationExecutor<Rubric> {
    @EntityGraph(attributePaths = {"versions"})
    Optional<Rubric> findByIdAndTenantId(UUID id, UUID tenantId);

    boolean existsByTenantIdAndNameIgnoreCase(UUID tenantId, String name);

    boolean existsByTenantIdAndNameIgnoreCaseAndIdNot(UUID tenantId, String name, UUID id);

    @Query("""
            select distinct r from Rubric r join r.versions v
            where r.tenantId = :tenantId
              and v.versionNumber = (select max(v2.versionNumber) from RubricVersion v2 where v2.rubric = r)
              and (:search = '' or lower(r.name) like lower(concat('%', :search, '%'))
                   or lower(coalesce(r.description, '')) like lower(concat('%', :search, '%')))
              and (:status is null or v.status = :status)
            """)
    List<Rubric> searchAll(@Param("tenantId") UUID tenantId,
                           @Param("search") String search,
                           @Param("status") RubricVersionStatus status);
}
