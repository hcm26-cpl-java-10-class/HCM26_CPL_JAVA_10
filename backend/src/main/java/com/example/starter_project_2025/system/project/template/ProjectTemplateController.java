package com.example.starter_project_2025.system.project.template;

import com.example.starter_project_2025.system.project.template.milestone.TemplateMilestonePlanRequest;
import com.example.starter_project_2025.system.project.template.milestone.TemplateMilestonePlanResponse;
import com.example.starter_project_2025.system.project.template.milestone.TemplateMilestoneService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/project-templates")
@RequiredArgsConstructor
public class ProjectTemplateController {
    private final ProjectTemplateService service;
    private final TemplateMilestoneService milestoneService;
    private final TemplateActivationService activationService;

    @GetMapping("/options")
    @PreAuthorize("hasAuthority('PROJECT_TEMPLATE_READ')")
    public ProjectTemplateOptions getOptions() {
        return service.getOptions();
    }

    @GetMapping("/available")
    @PreAuthorize("hasAuthority('PROJECT_TEMPLATE_READ')")
    public Page<ProjectTemplateResponse> getAvailable(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) ProjectTemplateLevel level,
            @RequestParam(required = false) String category,
            @RequestParam(defaultValue = "0") String page,
            @RequestParam(defaultValue = "10") String size,
            Pageable pageable) {
        Sort sort = pageable.getSort().isSorted() ? pageable.getSort() : Sort.by(Sort.Direction.DESC, "createdAt");
        return service.getPage(search, ProjectTemplateStatus.ACTIVE, level, category,
                PageRequest.of(number(page, "page", 0, Integer.MAX_VALUE), number(size, "size", 1, 100), sort));
    }

    @GetMapping
    @PreAuthorize("hasAuthority('PROJECT_TEMPLATE_READ')")
    public Page<ProjectTemplateResponse> getPage(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) ProjectTemplateStatus status,
            @RequestParam(required = false) ProjectTemplateLevel level,
            @RequestParam(required = false) String category,
            @RequestParam(defaultValue = "0") String page,
            @RequestParam(defaultValue = "10") String size,
            Pageable pageable) {
        Sort sort = pageable.getSort().isSorted() ? pageable.getSort() : Sort.by(Sort.Direction.DESC, "createdAt");
        return service.getPage(search, status, level, category,
                PageRequest.of(number(page, "page", 0, Integer.MAX_VALUE), number(size, "size", 1, 100), sort));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('PROJECT_TEMPLATE_READ')")
    public ProjectTemplateResponse getById(@PathVariable Long id) {
        return service.getById(id);
    }

    @PostMapping
    @PreAuthorize("hasAuthority('PROJECT_TEMPLATE_CREATE')")
    public ResponseEntity<ProjectTemplateResponse> create(@RequestBody ProjectTemplateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('PROJECT_TEMPLATE_UPDATE')")
    public ProjectTemplateResponse update(@PathVariable Long id, @RequestBody ProjectTemplateRequest request) {
        return service.update(id, request);
    }

    @PutMapping("/{id}/team-constraints")
    @PreAuthorize("hasAuthority('PROJECT_TEMPLATE_UPDATE')")
    public ProjectTemplateResponse updateTeamConstraints(
            @PathVariable Long id, @RequestBody TemplateTeamConstraintsRequest request) {
        return service.updateTeamConstraints(id, request);
    }

    @GetMapping("/{id}/milestones")
    @PreAuthorize("hasAuthority('PROJECT_TEMPLATE_READ')")
    public TemplateMilestonePlanResponse getMilestones(@PathVariable Long id) {
        return milestoneService.getPlan(id);
    }

    @PutMapping("/{id}/milestones")
    @PreAuthorize("hasAuthority('PROJECT_TEMPLATE_UPDATE')")
    public TemplateMilestonePlanResponse saveMilestones(
            @PathVariable Long id, @RequestBody TemplateMilestonePlanRequest request) {
        return milestoneService.savePlan(id, request);
    }

    @GetMapping("/{id}/activation-checklist")
    @PreAuthorize("hasAuthority('PROJECT_TEMPLATE_READ')")
    public TemplateActivationChecklist getActivationChecklist(@PathVariable Long id) {
        return activationService.getChecklist(id);
    }

    @PostMapping("/{id}/activate")
    @PreAuthorize("hasAuthority('PROJECT_TEMPLATE_ACTIVATE')")
    public ProjectTemplateResponse activate(@PathVariable Long id, @RequestBody TemplateActivationRequest request) {
        return activationService.activate(id, request);
    }

    private int number(String value, String field, int minimum, int maximum) {
        try {
            int parsed = Integer.parseInt(value);
            if (parsed >= minimum && parsed <= maximum) return parsed;
        } catch (NumberFormatException exception) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Invalid " + field);
        }
        throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Invalid " + field);
    }
}
