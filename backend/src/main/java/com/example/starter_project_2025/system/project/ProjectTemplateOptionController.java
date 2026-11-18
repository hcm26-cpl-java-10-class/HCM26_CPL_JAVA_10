package com.example.starter_project_2025.system.project;

import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * US-10: template picker source for the "assign project template to DRAFT team"
 * screens. Every authenticated user may read the list (students only see the
 * capacity window, and the assign endpoints enforce the real permissions).
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/project-templates")
public class ProjectTemplateOptionController {

    private final ProjectTeamTemplateService teamTemplateService;

    @GetMapping("/options")
    @PreAuthorize("isAuthenticated()")
    public List<ProjectTemplateOptionResponse> getOptions() {
        return teamTemplateService.getAssignableTemplates();
    }
}
