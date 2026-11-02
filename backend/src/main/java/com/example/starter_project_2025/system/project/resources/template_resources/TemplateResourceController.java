package com.example.starter_project_2025.system.project.resources.template_resources;

import com.example.starter_project_2025.base.crud.controller.BaseCrudDataIoController;
import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.service.BaseCrudService;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/template-resources")
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Template Resource", description = "APIs for managing project template resources")
public class TemplateResourceController
        extends BaseCrudDataIoController<TemplateResource, Long, TemplateResourceDTO, TemplateResourceFilter> {

    TemplateResourceService templateResourceService;
    TemplateResourceRepository templateResourceRepository;

    @Override
    protected BaseCrudService<Long, TemplateResourceDTO, TemplateResourceFilter> getService() {
        return templateResourceService;
    }

    @Override
    protected BaseCrudRepository<TemplateResource, Long> getRepository() {
        return templateResourceRepository;
    }

    @Override
    protected Class<TemplateResource> getEntityClass() {
        return TemplateResource.class;
    }

    /** Ordered resources defined on one template. */
    @GetMapping("/by-template/{templateId}")
    public ResponseEntity<List<TemplateResourceDTO>> getByTemplate(@PathVariable Long templateId) {
        return ResponseEntity.ok(templateResourceService.getByTemplate(templateId));
    }
}
