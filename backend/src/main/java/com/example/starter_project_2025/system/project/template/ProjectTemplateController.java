package com.example.starter_project_2025.system.project.template;

import com.example.starter_project_2025.system.project.template.milestone.TemplateMilestonePlanRequest;
import com.example.starter_project_2025.system.project.template.milestone.TemplateMilestoneOptions;
import com.example.starter_project_2025.system.project.template.milestone.TemplateMilestonePlanResponse;
import com.example.starter_project_2025.system.project.template.milestone.TemplateMilestoneService;
import com.example.starter_project_2025.system.project.template.content.*;
import lombok.RequiredArgsConstructor;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/project-templates")
@RequiredArgsConstructor
public class ProjectTemplateController {
    private final ProjectTemplateService service;
    private final TemplateMilestoneService milestoneService;
    private final TemplateActivationService activationService;
    private final TemplateSampleContentService sampleContentService;
    private final TemplateBacklogImportService backlogImportService;
    private final ProjectTemplateDeletionService deletionService;

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

    @GetMapping("/{id}/milestone-options")
    @PreAuthorize("hasAuthority('PROJECT_TEMPLATE_READ')")
    public TemplateMilestoneOptions getMilestoneOptions(
            @PathVariable Long id) {
        return milestoneService.getOptions(id);
    }

    @GetMapping("/{id}/activation-checklist")
    @PreAuthorize("hasAuthority('PROJECT_TEMPLATE_READ')")
    public TemplateActivationChecklist getActivationChecklist(@PathVariable Long id) {
        return activationService.getChecklist(id);
    }

    @GetMapping("/{id}/sample-content")
    @PreAuthorize("hasAuthority('PROJECT_TEMPLATE_READ')")
    public TemplateSampleContentResponse getSampleContent(@PathVariable Long id) {
        return sampleContentService.get(id);
    }

    @PutMapping("/{id}/sample-content")
    @PreAuthorize("hasAuthority('PROJECT_TEMPLATE_UPDATE')")
    public TemplateSampleContentResponse saveSampleContent(@PathVariable Long id, @RequestBody TemplateSampleContentRequest request) {
        return sampleContentService.save(id, request);
    }

    @PostMapping(value = "/{id}/backlog-import-preview", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAuthority('PROJECT_TEMPLATE_UPDATE')")
    public List<TemplateSampleContentRequest.BacklogItem> previewBacklogImport(@PathVariable Long id,
            @RequestPart("file") MultipartFile file) {
        return backlogImportService.preview(id, file);
    }

    @GetMapping("/{id}/backlog-import-template")
    @PreAuthorize("hasAuthority('PROJECT_TEMPLATE_UPDATE')")
    public ResponseEntity<byte[]> getBacklogImportTemplate(@PathVariable Long id) {
        return ResponseEntity.ok().header("Content-Disposition", "attachment; filename=template-backlog.xlsx")
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(backlogImportService.template(id));
    }

    @PostMapping("/{id}/activate")
    @PreAuthorize("hasAuthority('PROJECT_TEMPLATE_ACTIVATE')")
    public ProjectTemplateResponse activate(@PathVariable Long id, @RequestBody TemplateActivationRequest request) {
        return activationService.activate(id, request);
    }

    @PostMapping("/{id}/archive")
    @PreAuthorize("hasAuthority('PROJECT_TEMPLATE_ARCHIVE')")
    public ProjectTemplateResponse archive(@PathVariable Long id, @RequestBody TemplateArchiveRequest request) {
        return service.archive(id, request);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('PROJECT_TEMPLATE_ARCHIVE')")
    public ResponseEntity<Void> delete(@PathVariable Long id, @RequestParam Long lockVersion) {
        deletionService.delete(id, lockVersion);
        return ResponseEntity.noContent().build();
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
