package com.example.starter_project_2025.system.project.rubric.repository;

import com.example.starter_project_2025.system.project.rubric.domain.Rubric;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import java.util.Optional;
import java.util.UUID;

public interface RubricRepository extends JpaRepository<Rubric, UUID>, JpaSpecificationExecutor<Rubric> {
    @EntityGraph(attributePaths = {"versions"})
    Optional<Rubric> findByIdAndTenantId(UUID id, UUID tenantId);

    boolean existsByTenantIdAndNameIgnoreCase(UUID tenantId, String name);

    boolean existsByTenantIdAndNameIgnoreCaseAndIdNot(UUID tenantId, String name, UUID id);

}
