package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ProjectRepository extends BaseCrudRepository<Project, Long> {

    java.util.Optional<Project> findByCode(String code);

    java.util.List<Project> findAllByTenantIdAndIdInAndIsActiveTrueOrderByNameAsc(
            Long tenantId,
            java.util.Collection<Long> ids
    );
}
