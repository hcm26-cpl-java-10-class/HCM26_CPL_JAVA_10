package com.example.starter_project_2025.system.project.resources.project_resources;

import com.example.starter_project_2025.base.crud.service.BaseCrudService;

import java.util.List;

public interface ProjectResourceService
        extends BaseCrudService<Long, ProjectResourceDTO, ProjectResourceFilter> {

    /**
     * Ordered resources of one project (the main read use case of the module).
     */
    List<ProjectResourceDTO> getByProject(Long projectId);
}
