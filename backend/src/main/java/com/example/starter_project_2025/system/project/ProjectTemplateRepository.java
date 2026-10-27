package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.stereotype.Repository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProjectTemplateRepository
        extends BaseCrudRepository<ProjectTemplate, Long> {

    Optional<ProjectTemplate> findByIdAndIsActiveTrue(Long id);

    Optional<ProjectTemplate> findByCodeAndTenantIdIsNullAndIsActiveTrue(String code);

    Optional<ProjectTemplate> findByIdAndTenantIdAndIsActiveTrue(Long id, Long tenantId);

    boolean existsByTenantIdAndCodeAndTemplateVersion(Long tenantId, String code, Integer templateVersion);

    boolean existsByTenantIdAndCodeAndTemplateVersionAndIdNot(
            Long tenantId, String code, Integer templateVersion, Long id);

    @Query("select distinct t.category from ProjectTemplate t where t.tenantId = :tenantId "
            + "and t.isActive = true and t.category is not null order by t.category")
    List<String> findCategories(Long tenantId);
}
