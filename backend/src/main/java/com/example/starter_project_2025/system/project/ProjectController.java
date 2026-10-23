package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Read-only project lookup used by the Sprint feature to link a sprint to its
 * project. Writes are intentionally out of scope for UFR-PRJ-003-01.
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/projects")
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Project", description = "Read-only project lookup for sprint linking")
public class ProjectController {

    ProjectRepository projectRepository;

    @GetMapping
    @PreAuthorize("hasAuthority('PROJECT_READ')")
    public ResponseEntity<Page<ProjectDTO>> getAll(@PageableDefault Pageable pageable) {
        return ResponseEntity.ok(projectRepository.findAll(pageable).map(ProjectDTO::from));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('PROJECT_READ')")
    public ResponseEntity<ProjectDTO> getById(@PathVariable Long id) {
        return projectRepository.findById(id)
                .map(ProjectDTO::from)
                .map(ResponseEntity::ok)
                .orElseThrow(() -> new ResourceNotFoundException("Project", "id", id));
    }
}
