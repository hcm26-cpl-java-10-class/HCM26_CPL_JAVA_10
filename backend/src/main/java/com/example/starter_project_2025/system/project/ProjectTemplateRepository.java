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

    /**
     * Import-only lookup: resolves the template referenced by name in a
     * {@code project-template-versions} file. Created/updated records still use
     * the id based methods below, so a duplicated name only affects the import
     * row that supplied it (the ambiguous lookup fails that row).
     */
    Optional<ProjectTemplate> findByName(String name);

    Optional<ProjectTemplate> findByCodeAndTenantIdIsNullAndIsActiveTrue(String code);

    Optional<ProjectTemplate> findByIdAndTenantIdAndIsActiveTrue(Long id, Long tenantId);

    /**
     * Read-only lookup that also resolves the shared catalogue: rows without a
     * tenant ({@code tenant_id is null}, e.g. the demo/sample templates seeded
     * by {@code ProjectTeamTemplateDemoDataInitializer}) are readable by every
     * tenant. Mutations keep using {@link #findByIdAndTenantIdAndIsActiveTrue}.
     */
    @Query("select t from ProjectTemplate t where t.id = :id and t.isActive = true "
            + "and (t.tenantId = :tenantId or t.tenantId is null)")
    Optional<ProjectTemplate> findReadableById(Long id, Long tenantId);

    boolean existsByTenantIdAndCodeAndTemplateVersion(Long tenantId, String code, Integer templateVersion);

    boolean existsByTenantIdAndCodeAndTemplateVersionAndIdNot(
            Long tenantId, String code, Integer templateVersion, Long id);

    @Query("select distinct t.category from ProjectTemplate t "
            + "where (t.tenantId = :tenantId or t.tenantId is null) "
            + "and t.isActive = true and t.category is not null order by t.category")
    List<String> findCategories(Long tenantId);
}
