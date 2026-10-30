package com.example.starter_project_2025.system.project.template.version;

import com.example.starter_project_2025.system.project.template.ProjectTemplateRequest;
import com.example.starter_project_2025.system.project.template.TemplateActivationRequest;
import com.example.starter_project_2025.system.project.template.TemplateTeamConstraintsRequest;
import com.example.starter_project_2025.system.project.template.content.TemplateSampleContentRequest;
import com.example.starter_project_2025.system.project.template.milestone.TemplateMilestonePlanRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.http.MediaType;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/project-template-versions/{id}")
@RequiredArgsConstructor
public class TemplateVersionConfigurationController {
    private final TemplateVersionConfigurationService service;

    @GetMapping("/configuration")
    @PreAuthorize("hasAuthority('PROJECT_TEMPLATE_READ') and hasAuthority('PROJECT_TEMPLATE_VERSION_READ')")
    public TemplateVersionConfigurationResponse get(@PathVariable Long id) { return service.get(id); }

    @PutMapping("/configuration/overview")
    @PreAuthorize("hasAuthority('PROJECT_TEMPLATE_UPDATE') and hasAuthority('PROJECT_TEMPLATE_VERSION_UPDATE')")
    public TemplateVersionConfigurationResponse overview(@PathVariable Long id, @RequestBody ProjectTemplateRequest request) {
        return service.saveOverview(id, request);
    }

    @PutMapping("/configuration/team-constraints")
    @PreAuthorize("hasAuthority('PROJECT_TEMPLATE_UPDATE') and hasAuthority('PROJECT_TEMPLATE_VERSION_UPDATE')")
    public TemplateVersionConfigurationResponse team(@PathVariable Long id, @RequestBody TemplateTeamConstraintsRequest request) {
        return service.saveTeam(id, request);
    }

    @PutMapping("/configuration/milestones")
    @PreAuthorize("hasAuthority('PROJECT_TEMPLATE_UPDATE') and hasAuthority('PROJECT_TEMPLATE_VERSION_UPDATE')")
    public TemplateVersionConfigurationResponse milestones(@PathVariable Long id, @RequestBody TemplateMilestonePlanRequest request) {
        return service.saveMilestones(id, request);
    }

    @PutMapping("/configuration/sample-content")
    @PreAuthorize("hasAuthority('PROJECT_TEMPLATE_UPDATE') and hasAuthority('PROJECT_TEMPLATE_VERSION_UPDATE')")
    public TemplateVersionConfigurationResponse backlog(@PathVariable Long id, @RequestBody TemplateSampleContentRequest request) {
        return service.saveBacklog(id, request);
    }

    @PostMapping("/publish")
    @PreAuthorize("hasAuthority('PROJECT_TEMPLATE_ACTIVATE') and hasAuthority('PROJECT_TEMPLATE_VERSION_UPDATE')")
    public TemplateVersionConfigurationResponse publish(@PathVariable Long id, @RequestBody TemplateActivationRequest request) {
        return service.publish(id, request);
    }

    @PostMapping(value = "/backlog-import-preview", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAuthority('PROJECT_TEMPLATE_UPDATE') and hasAuthority('PROJECT_TEMPLATE_VERSION_UPDATE')")
    public List<TemplateSampleContentRequest.BacklogItem> preview(@PathVariable Long id, @RequestPart("file") MultipartFile file) {
        return service.previewImport(id, file);
    }

    @GetMapping("/backlog-import-template")
    @PreAuthorize("hasAuthority('PROJECT_TEMPLATE_UPDATE') and hasAuthority('PROJECT_TEMPLATE_VERSION_UPDATE')")
    public ResponseEntity<byte[]> importTemplate(@PathVariable Long id) {
        return ResponseEntity.ok().header("Content-Disposition", "attachment; filename=template-backlog.xlsx")
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(service.importTemplate(id));
    }
}
