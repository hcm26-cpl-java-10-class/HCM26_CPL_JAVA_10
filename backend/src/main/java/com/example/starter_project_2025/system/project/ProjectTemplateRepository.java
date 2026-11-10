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

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from ProjectTemplate t where t.id = :id and t.tenantId = :tenantId and t.isActive = true")
    Optional<ProjectTemplate> findForTemplateUpdate(Long id, Long tenantId);

    /**
     * Read-only lookup that also resolves the shared catalogue: rows without a
     * tenant ({@code tenant_id is null}, e.g. the demo/sample templates seeded
     * by {@code ProjectTeamTemplateDemoDataInitializer}) are readable by every
     * tenant. Mutations keep using {@link #findByIdAndTenantIdAndIsActiveTrue}.
     */
    @Query("select t from ProjectTemplate t where t.id = :id and (t.isActive = true "
            + "or (t.parentTemplate is not null and t.status = com.example.starter_project_2025.system.project.template.ProjectTemplateStatus.ARCHIVED)) "
            + "and (t.tenantId = :tenantId or t.tenantId is null)")
    Optional<ProjectTemplate> findReadableById(Long id, Long tenantId);

    boolean existsByTenantIdAndCodeAndTemplateVersion(Long tenantId, String code, Integer templateVersion);

    boolean existsByTenantIdAndCodeAndTemplateVersionAndIdNot(
            Long tenantId, String code, Integer templateVersion, Long id);

    boolean existsByTenantIdAndCodeScopeIdAndCodeAndTemplateVersion(
            Long tenantId, Long codeScopeId, String code, Integer templateVersion);

    boolean existsByTenantIdAndCodeScopeIdAndCodeAndTemplateVersionAndIdNot(
            Long tenantId, Long codeScopeId, String code, Integer templateVersion, Long id);

    boolean existsByTenantIdAndCodeScopeIdAndCode(Long tenantId, Long codeScopeId, String code);

    boolean existsByTenantIdAndCodeScopeIdAndCodeAndIdNot(Long tenantId, Long codeScopeId, String code, Long id);

    List<ProjectTemplate> findAllByParentTemplate_IdAndTenantIdAndIsActiveTrueOrderByCodeAscIdAsc(
            Long parentTemplateId, Long tenantId);

    List<ProjectTemplate> findAllByParentTemplateIsNotNullAndIsActiveTrue();

    boolean existsByParentTemplate_IdAndIsActiveTrue(Long parentTemplateId);

    @Query("select distinct t.category from ProjectTemplate t "
            + "where (t.tenantId = :tenantId or t.tenantId is null) "
            + "and t.isActive = true and t.category is not null order by t.category")
    List<String> findCategories(Long tenantId);

    @Query("select distinct t.level from ProjectTemplate t "
            + "where (t.tenantId = :tenantId or t.tenantId is null) "
            + "and t.isActive = true and t.level is not null order by t.level")
    List<String> findLevels(Long tenantId);
}
