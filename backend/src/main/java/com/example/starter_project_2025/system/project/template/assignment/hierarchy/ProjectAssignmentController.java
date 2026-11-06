package com.example.starter_project_2025.system.project.template.assignment.hierarchy;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/classes/{classId}/allocation-sessions/{sessionId}/project-assignments")
@PreAuthorize("hasAnyAuthority('PEO_TEAM_ALLOCATE', 'PRJ_WORKSPACE_MANAGE')")
public class ProjectAssignmentController {
    private final ProjectAssignmentService service;

    @GetMapping
    public List<AssignmentDtos.ClassMaster> classMasters(@PathVariable Long classId, @PathVariable Long sessionId,
                                                       Authentication authentication) {
        return service.classMasters(classId, sessionId, authentication);
    }

    @GetMapping("/templates")
    public List<AssignmentDtos.Template> templates(@PathVariable Long classId, @PathVariable Long sessionId,
            @RequestParam(required = false) String search, Authentication authentication) {
        return service.templates(classId, sessionId, search, authentication);
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
