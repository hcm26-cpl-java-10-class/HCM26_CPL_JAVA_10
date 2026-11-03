package com.example.starter_project_2025.system.project.resources.project_resource_files;

import com.example.starter_project_2025.base.crud.service.BaseCrudService;

import java.util.List;

public interface ProjectResourceFileService
        extends BaseCrudService<Long, ProjectResourceFileDTO, ProjectResourceFileFilter> {

    /**
     * Files attached to one project resource, in insertion order.
     */
    List<ProjectResourceFileDTO> getByResource(Long resourceId);
}
