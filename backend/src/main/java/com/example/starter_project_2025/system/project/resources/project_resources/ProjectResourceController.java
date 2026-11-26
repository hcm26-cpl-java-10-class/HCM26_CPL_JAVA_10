package com.example.starter_project_2025.system.project.resources.project_resources;

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
@RequestMapping("/api/project-resources")
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Project Resource", description = "APIs for managing project learning resources")
public class ProjectResourceController
        extends BaseCrudDataIoController<ProjectResource, Long, ProjectResourceDTO, ProjectResourceFilter> {

    ProjectResourceService projectResourceService;
    ProjectResourceRepository projectResourceRepository;

    @Override
    protected BaseCrudService<Long, ProjectResourceDTO, ProjectResourceFilter> getService() {
        return projectResourceService;
    }

    @Override
    protected BaseCrudRepository<ProjectResource, Long> getRepository() {
        return projectResourceRepository;
    }

    @Override
    protected Class<ProjectResource> getEntityClass() {
        return ProjectResource.class;
    }

    /** Ordered, active resources of one project. */
    @GetMapping("/by-project/{projectId}")
    public ResponseEntity<List<ProjectResourceDTO>> getByProject(@PathVariable Long projectId) {
        return ResponseEntity.ok(projectResourceService.getByProject(projectId));
    }
}
