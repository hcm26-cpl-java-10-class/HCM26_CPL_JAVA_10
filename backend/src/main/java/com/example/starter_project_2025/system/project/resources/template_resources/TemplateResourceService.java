package com.example.starter_project_2025.system.project.resources.template_resources;

import com.example.starter_project_2025.base.crud.service.BaseCrudService;

import java.util.List;

public interface TemplateResourceService
        extends BaseCrudService<Long, TemplateResourceDTO, TemplateResourceFilter> {

    /**
     * Ordered resources defined on one template version source.
     */
    List<TemplateResourceDTO> getByTemplate(Long templateId);
}
