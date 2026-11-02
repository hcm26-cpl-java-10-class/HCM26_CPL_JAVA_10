package com.example.starter_project_2025.system.project.resources.template_resource_files;

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
@RequestMapping("/api/template-resource-files")
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Template Resource File", description = "APIs for managing template resource files")
public class TemplateResourceFileController
        extends BaseCrudDataIoController<TemplateResourceFile, Long, TemplateResourceFileDTO, TemplateResourceFileFilter> {

    TemplateResourceFileService templateResourceFileService;
    TemplateResourceFileRepository templateResourceFileRepository;

    @Override
    protected BaseCrudService<Long, TemplateResourceFileDTO, TemplateResourceFileFilter> getService() {
        return templateResourceFileService;
    }

    @Override
    protected BaseCrudRepository<TemplateResourceFile, Long> getRepository() {
        return templateResourceFileRepository;
    }

    @Override
    protected Class<TemplateResourceFile> getEntityClass() {
        return TemplateResourceFile.class;
    }

    /** Files attached to one template resource. */
    @GetMapping("/by-resource/{resourceId}")
    public ResponseEntity<List<TemplateResourceFileDTO>> getByResource(@PathVariable Long resourceId) {
        return ResponseEntity.ok(templateResourceFileService.getByResource(resourceId));
    }
}
