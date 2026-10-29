package com.example.starter_project_2025.system.project.project_template_version;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProjectTemplateSnapshotRepository
        extends BaseCrudRepository<ProjectTemplateSnapshot, Long> {

    List<ProjectTemplateSnapshot> findByTemplateIdOrderByCreatedAtDesc(Long templateId);

    Optional<ProjectTemplateSnapshot> findFirstByTemplateIdAndIsActiveTrueOrderByCreatedAtDesc(Long templateId);

    /**
     * Resolves the version that is currently published/active for a template.
     * Used by the team-assignment flow (US-13) before it copies the brief.
     */
    Optional<ProjectTemplateSnapshot> findFirstByTemplateIdAndStatusAndIsActiveTrueOrderByCreatedAtDesc(
            Long templateId, ProjectTemplateVersionStatus status);

    Optional<ProjectTemplateSnapshot> findFirstByTemplateIdAndStatusAndIsActiveTrueOrderByCreatedAtDescIdDesc(
            Long templateId, ProjectTemplateVersionStatus status);

    List<ProjectTemplateSnapshot> findByTemplateIdInAndStatusAndIsActiveTrueOrderByCreatedAtDescIdDesc(
            List<Long> templateIds, ProjectTemplateVersionStatus status);

    /**
     * Used by the sample data seeder to upsert a version per template without
     * duplicating rows (mirrors {@code SprintRepository#findByName}).
     */
    Optional<ProjectTemplateSnapshot> findFirstByTemplateIdAndVersion(Long templateId, String version);

    boolean existsByTemplateIdAndVersion(Long templateId, String version);

    boolean existsByTemplateIdAndVersionAndIdNot(Long templateId, String version, Long id);
}
