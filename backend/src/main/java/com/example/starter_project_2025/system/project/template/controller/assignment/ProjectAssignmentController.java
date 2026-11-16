package com.example.starter_project_2025.system.project.template.controller.assignment;

import com.example.starter_project_2025.system.project.template.dto.assignment.AssignmentDtos;
import com.example.starter_project_2025.system.project.template.service.assignment.AssignmentCatalogService;
import com.example.starter_project_2025.system.project.template.service.assignment.ProjectAssignmentService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/classes/{classId}/allocation-sessions/{sessionId}/project-assignments")
@PreAuthorize("hasAnyAuthority('PEO_TEAM_ALLOCATE', 'PRJ_WORKSPACE_MANAGE')")
public class ProjectAssignmentController {
    private final ProjectAssignmentService service;
    private final AssignmentCatalogService catalog;

    @GetMapping
    public List<AssignmentDtos.ClassMaster> classMasters(@PathVariable Long classId, @PathVariable Long sessionId,
                                                       Authentication authentication) {
        return service.classMasters(classId, sessionId, authentication);
    }

    @GetMapping("/templates")
    public AssignmentDtos.Catalog templates(@PathVariable Long classId, @PathVariable Long sessionId,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String level,
            @RequestParam(defaultValue = "false") boolean fit,
            @RequestParam(required = false) Long teamId,
            @RequestParam(defaultValue = "NAME") AssignmentCatalogService.Sort sort,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "" + AssignmentCatalogService.DEFAULT_PAGE_SIZE) int size,
            Authentication authentication) {
        return catalog.catalog(classId, sessionId,
                new AssignmentCatalogService.Filter(search, category, level, fit, teamId, sort, page, size), authentication);
    }

    @GetMapping("/templates/{templateId}/brief")
    public AssignmentDtos.Brief brief(@PathVariable Long classId, @PathVariable Long sessionId,
            @PathVariable Long templateId, @RequestParam(required = false) Long versionId, Authentication authentication) {
        return catalog.brief(classId, sessionId, templateId, versionId, authentication);
    }

    @GetMapping("/templates/{templateId}")
    public AssignmentDtos.Preview preview(@PathVariable Long classId, @PathVariable Long sessionId,
            @PathVariable Long templateId, @RequestParam(required = false) Long versionId, Authentication authentication) {
        return service.preview(classId, sessionId, templateId, versionId, authentication);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public AssignmentDtos.Result assign(@PathVariable Long classId, @PathVariable Long sessionId,
            @RequestHeader("X-Idempotency-Key") String requestKey, @Valid @RequestBody AssignmentDtos.Request request,
            Authentication authentication) {
        return service.assign(classId, sessionId, requestKey, request, authentication);
    }
}
