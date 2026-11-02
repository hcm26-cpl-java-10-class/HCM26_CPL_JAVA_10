package com.example.starter_project_2025.system.project.resources.template_resource_files;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TemplateResourceFileRepository extends BaseCrudRepository<TemplateResourceFile, Long> {

    List<TemplateResourceFile> findAllByResourceIdOrderByIdAsc(Long resourceId);

    long countByResourceId(Long resourceId);

    /** Used when a template resource is deleted: its files go with it. */
    long deleteByResourceId(Long resourceId);
}
