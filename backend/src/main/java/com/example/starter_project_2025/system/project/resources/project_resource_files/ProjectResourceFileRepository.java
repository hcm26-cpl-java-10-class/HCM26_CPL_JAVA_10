package com.example.starter_project_2025.system.project.resources.project_resource_files;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProjectResourceFileRepository extends BaseCrudRepository<ProjectResourceFile, Long> {

    List<ProjectResourceFile> findAllByResourceIdOrderByIdAsc(Long resourceId);

    long countByResourceId(Long resourceId);

    /** Used when a resource is deleted: its files go with it. */
    long deleteByResourceId(Long resourceId);
}
