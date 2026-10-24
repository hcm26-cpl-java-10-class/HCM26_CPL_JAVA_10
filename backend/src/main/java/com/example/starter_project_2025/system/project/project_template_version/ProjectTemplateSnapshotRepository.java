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
     * Used by the sample data seeder to upsert a version per template without
     * duplicating rows (mirrors {@code SprintRepository#findByName}).
     */
    Optional<ProjectTemplateSnapshot> findFirstByTemplateIdAndVersion(Long templateId, String version);

    boolean existsByTemplateIdAndVersion(Long templateId, String version);

    boolean existsByTemplateIdAndVersionAndIdNot(Long templateId, String version, Long id);
}
