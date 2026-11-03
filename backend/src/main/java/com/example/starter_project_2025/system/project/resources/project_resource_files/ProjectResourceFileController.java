package com.example.starter_project_2025.system.project.resources.project_resource_files;

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
@RequestMapping("/api/project-resource-files")
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Project Resource File", description = "APIs for managing project resource files")
public class ProjectResourceFileController
        extends BaseCrudDataIoController<ProjectResourceFile, Long, ProjectResourceFileDTO, ProjectResourceFileFilter> {

    ProjectResourceFileService projectResourceFileService;
    ProjectResourceFileRepository projectResourceFileRepository;

    @Override
    protected BaseCrudService<Long, ProjectResourceFileDTO, ProjectResourceFileFilter> getService() {
        return projectResourceFileService;
    }

    @Override
    protected BaseCrudRepository<ProjectResourceFile, Long> getRepository() {
        return projectResourceFileRepository;
    }

    @Override
    protected Class<ProjectResourceFile> getEntityClass() {
        return ProjectResourceFile.class;
    }

    /** Files attached to one project resource. */
    @GetMapping("/by-resource/{resourceId}")
    public ResponseEntity<List<ProjectResourceFileDTO>> getByResource(@PathVariable Long resourceId) {
        return ResponseEntity.ok(projectResourceFileService.getByResource(resourceId));
    }
}
