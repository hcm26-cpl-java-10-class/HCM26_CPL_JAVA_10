package com.example.starter_project_2025.system.project.template.assignment;

import com.example.starter_project_2025.system.project.ProjectTemplate;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateSnapshot;
import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateSnapshotRepository;
import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateVersionStatus;
import com.example.starter_project_2025.system.project.resources.ProjectResource;
import com.example.starter_project_2025.system.project.resources.ProjectResourceRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class TemplateAssignmentResourceWriter {
    private final ProjectResourceRepository resources;
    private final ProjectTemplateSnapshotRepository versions;
    private final ObjectMapper json;

    @Transactional(propagation = Propagation.MANDATORY)
    public void copy(Project project, ProjectTemplate template, ProjectTemplateSnapshot assignment) {
        List<ProjectTemplate> ancestors = new ArrayList<>();
        Set<Long> seen = new HashSet<>();
        seen.add(template.getId());
        for (ProjectTemplate parent = template.getParentTemplate(); parent != null; parent = parent.getParentTemplate()) {
            if (!seen.add(parent.getId())) throw new IllegalStateException("The template hierarchy contains a cycle");
            if (parent.getTenantId() != null && !Objects.equals(parent.getTenantId(), project.getTenantId()))
                throw new AccessDeniedException("The resource ancestor belongs to another tenant");
            ancestors.add(parent);
        }
        Collections.reverse(ancestors);
        for (ProjectTemplate parent : ancestors) {
            versions.findByTemplateIdOrderByCreatedAtDesc(parent.getId()).stream()
                    .filter(version -> version.getProjectId() == null && version.getStatus() != ProjectTemplateVersionStatus.DRAFT)
                    .findFirst().ifPresent(version -> copyFiles(project, parent.getId(), parent.getCode(), parent.getName(),
                            version.getVersion(), "PARENT", read(version.getContentJson()).path("resources")));
        }
        JsonNode content = read(assignment.getContentJson());
        copyFiles(project, template.getId(), content.path("code").asText(template.getCode()), content.path("name").asText(template.getName()),
                content.path("sourceVersion").asText("v1"), template.getParentTemplateId() == null
                        ? content.path("modules").isArray() && !content.path("modules").isEmpty() ? "PARENT" : "PROJECT" : "SUB_PROJECT",
                content.path("resources"));
        Set<Long> modules = new HashSet<>();
        modules.add(template.getId());
        copyModules(project, content.path("modules"), modules);
        resources.flush();
    }

    private void copyModules(Project project, JsonNode modules, Set<Long> seen) {
        if (!modules.isArray()) return;
        for (JsonNode module : modules) {
            Long id = module.path("templateId").asLong();
            if (!seen.add(id)) throw new IllegalStateException("The saved module hierarchy contains a cycle");
            copyFiles(project, id, module.path("code").asText(), module.path("name").asText(),
                    "v" + module.path("templateVersion").asInt(1), "SUB_PROJECT", module.path("resources"));
            copyModules(project, module.path("modules"), seen);
        }
    }

    private void copyFiles(Project project, Long templateId, String code, String name, String version, String origin, JsonNode files) {
        if (!files.isArray()) return;
        for (JsonNode file : files) {
            boolean link = "LINK".equals(file.path("kind").asText());
            ProjectResource resource = new ProjectResource();
            resource.setProject(project); resource.setTenantId(project.getTenantId());
            resource.setTitle(file.path("title").asText()); resource.setVersion(version);
            resource.setKind(link ? "LINK" : "FILE");
            resource.setFileName(link ? resource.getTitle() : file.path("fileName").asText());
            resource.setContentType(link ? "text/uri-list" : file.path("contentType").asText());
            resource.setSizeBytes(link ? 0 : file.path("sizeBytes").asLong());
            resource.setStorageKey(link ? "" : file.path("storageKey").asText());
            resource.setExternalUrl(link ? file.path("externalUrl").asText() : null);
            resource.setSourceTemplateId(templateId); resource.setSourceTemplateCode(code);
            resource.setSourceResourceId(file.path("id").isNumber() ? file.path("id").asLong() : null);
            resource.setSourceTemplateName(name); resource.setSourceOrigin(origin);
            resources.save(resource);
        }
    }

    private JsonNode read(String value) {
        try { return json.readTree(value); }
        catch (JsonProcessingException exception) { throw new IllegalStateException("The saved resource configuration is invalid", exception); }
    }
}
