package com.example.starter_project_2025.system.project.resources.template_resource_files;

import com.example.starter_project_2025.base.crud.service.BaseCrudService;

import java.util.List;

public interface TemplateResourceFileService
        extends BaseCrudService<Long, TemplateResourceFileDTO, TemplateResourceFileFilter> {

    /**
     * Files attached to one template resource, in insertion order.
     */
    List<TemplateResourceFileDTO> getByResource(Long resourceId);
}
