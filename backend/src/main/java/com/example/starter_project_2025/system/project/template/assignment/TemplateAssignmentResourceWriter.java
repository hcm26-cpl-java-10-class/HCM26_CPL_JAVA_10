package com.example.starter_project_2025.system.project.template.assignment;

import com.example.starter_project_2025.system.project.ProjectTemplate;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateSnapshot;
import com.example.starter_project_2025.system.project.resources.project_resources.ProjectResourceProvisioningService;
import com.example.starter_project_2025.system.project.template.TemplateConfigurationService;
import com.example.starter_project_2025.system.project.template.TemplateHierarchyService;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import java.util.HashSet;
import java.util.Objects;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class TemplateAssignmentResourceWriter {
    private final ProjectResourceProvisioningService resources;
    private final TemplateConfigurationService configurations;
    private final TemplateHierarchyService hierarchy;

    public int copy(Project project, ProjectTemplate template, ProjectTemplateSnapshot assignment) {
        int count = 0;
        Set<Long> visited = new HashSet<>();
        visited.add(template.getId());
        for (ProjectTemplate parent = template.getParentTemplate(); parent != null; parent = parent.getParentTemplate()) {
            requireSource(project, parent, visited);
            ProjectTemplateSnapshot version = hierarchy.published(parent);
            if (version != null) {
                count += resources.provision(project, resources.capture(parent.getId(), version.getId(), parent.getName(), "PARENT"));
            }
        }

        JsonNode content = configurations.read(assignment.getContentJson());
        JsonNode modules = content.path("modules");
        String origin = template.getParentTemplateId() != null ? "SUB_PROJECT" : modules.isEmpty() ? "PROJECT" : "PARENT";
        count += resources.provision(project, resources.capture(template.getId(), assignment.getParentTemplateId(),
                content.path("name").asText(template.getName()), origin));
        return count + copyModules(project, modules, visited);
    }

    private int copyModules(Project project, JsonNode modules, Set<Long> visited) {
        int count = 0;
        for (JsonNode module : modules) {
            long templateId = module.path("templateId").asLong();
            if (templateId <= 0 || !visited.add(templateId)) {
                throw new IllegalStateException("The saved module hierarchy is invalid");
            }
            if (!module.path("versionId").isIntegralNumber()) continue;
            count += resources.provision(project, resources.capture(templateId, module.path("versionId").asLong(),
                    module.path("name").asText(), "SUB_PROJECT"));
            count += copyModules(project, module.path("modules"), visited);
        }
        return count;
    }

    private void requireSource(Project project, ProjectTemplate source, Set<Long> visited) {
        if (!visited.add(source.getId())) throw new IllegalStateException("The template hierarchy contains a cycle");
        if (source.getTenantId() != null && !Objects.equals(source.getTenantId(), project.getTenantId())) {
            throw new AccessDeniedException("The resource ancestor belongs to another tenant");
        }
    }
}
