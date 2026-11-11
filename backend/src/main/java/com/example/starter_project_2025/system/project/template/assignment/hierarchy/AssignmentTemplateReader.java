package com.example.starter_project_2025.system.project.template.assignment.hierarchy;

import com.example.starter_project_2025.system.project.ProjectTemplate;
import com.example.starter_project_2025.system.project.ProjectTemplateConstraints;
import com.example.starter_project_2025.system.project.ProjectTemplateRepository;
import com.example.starter_project_2025.system.project.project_template_version.*;
import com.example.starter_project_2025.system.project.template.ProjectTemplateStatus;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class AssignmentTemplateReader {
    public record Node(Long templateId, Long sourceVersionId, String version, ObjectNode content, List<Node> modules) {
        public String name() { return content.path("name").asText(); }
        public String code() { return content.path("code").asText(); }

        public Set<Long> templateIds() {
            Set<Long> ids = new LinkedHashSet<>();
            ids.add(templateId);
            modules.forEach(module -> ids.addAll(module.templateIds()));
            return ids;
        }
    }

    private final ProjectTemplateRepository templates;
    private final ProjectTemplateSnapshotRepository versions;
    private final ObjectMapper json;

    public Node load(Long templateId, Long versionId, Long tenantId) {
        ProjectTemplate master = templates.findByIdAndIsActiveTrue(templateId)
                .filter(value -> tenantId.equals(value.getTenantId()) && value.getParentTemplateId() == null
                        && value.getStatus() == ProjectTemplateStatus.ACTIVE)
                .orElseThrow(() -> AssignmentException.invalid("Select an active master template from this tenant"));
        ProjectTemplateSnapshot published = versions.findFirstByTemplateIdAndStatusAndIsActiveTrueOrderByCreatedAtDesc(
                        master.getId(), ProjectTemplateVersionStatus.PUBLISHED)
                .filter(value -> value.getProjectId() == null)
                .orElseThrow(() -> AssignmentException.invalid("The master template has no published version"));
        if (versionId != null && !published.getId().equals(versionId)) {
            throw new AssignmentException(HttpStatus.CONFLICT, "PROJECT_ASSIGNMENT_VERSION_CHANGED",
                    "The published master version has changed. Reload its preview");
        }
        try {
            ObjectNode content = (ObjectNode) json.readTree(published.getContentJson());
            content.put("templateId", templateId);
            return node(content, published.getId(), published.getVersion(), tenantId, new HashSet<>());
        } catch (com.fasterxml.jackson.core.JsonProcessingException | ClassCastException exception) {
            throw AssignmentException.invalid("The published template configuration is invalid");
        }
    }

    private Node node(ObjectNode content, Long versionId, String version, Long tenantId, Set<Long> visited) {
        Long id = content.path("templateId").asLong();
        if (id <= 0 || !visited.add(id) || visited.size() > 500)
            throw AssignmentException.invalid("The published module hierarchy is invalid or too large");
        ProjectTemplate owner = templates.findById(id).filter(value -> tenantId.equals(value.getTenantId()))
                .orElseThrow(() -> AssignmentException.invalid("A saved module belongs to another tenant"));
        var source = versions.findById(versionId).filter(value -> id.equals(value.getTemplateId())
                && value.getProjectId() == null && value.getStatus() != ProjectTemplateVersionStatus.DRAFT)
                .orElseThrow(() -> AssignmentException.invalid("A module has no immutable published source"));
        List<Node> children = new ArrayList<>();
        if (content.path("modules").isArray()) {
            for (var child : content.path("modules")) {
                if (!(child instanceof ObjectNode saved) || !saved.path("versionId").canConvertToLong())
                    throw AssignmentException.invalid("Publish every module before assigning the master");
                ObjectNode module = saved.deepCopy();
                module.set("category", content.get("category"));
                children.add(node(module, saved.path("versionId").asLong(), null, tenantId, visited));
            }
        }
        return new Node(owner.getId(), versionId, version == null ? source.getVersion() : version,
                content.deepCopy(), List.copyOf(children));
    }

    public ProjectTemplateConstraints.Capacity capacity(Node node) {
        return capacity(node.content());
    }

    /** Team size declared by a published snapshot's content, without resolving its module hierarchy. */
    public ProjectTemplateConstraints.Capacity capacity(ObjectNode content) {
        return ProjectTemplateConstraints.parse(json, constraintsTemplate(content), null);
    }

    public Node loadAssigned(Long templateId, Long versionId, Long tenantId) {
        var version = versions.findById(versionId).filter(value -> templateId.equals(value.getTemplateId())
                && value.getProjectId() == null && value.getStatus() != ProjectTemplateVersionStatus.DRAFT)
                .orElseThrow(() -> AssignmentException.invalid("The assigned template version is unavailable"));
        try {
            ObjectNode content = (ObjectNode) json.readTree(version.getContentJson());
            content.put("templateId", templateId);
            return node(content, version.getId(), version.getVersion(), tenantId, new HashSet<>());
        } catch (com.fasterxml.jackson.core.JsonProcessingException | ClassCastException exception) {
            throw AssignmentException.invalid("The assigned template configuration is invalid");
        }
    }

    public ProjectTemplateConstraints.RolePolicy roles(Node node) {
        return ProjectTemplateConstraints.parseRolePolicy(json, constraintsTemplate(node.content()));
    }

    private ProjectTemplate constraintsTemplate(ObjectNode content) {
        ProjectTemplate template = new ProjectTemplate();
        template.setConstraintsJson(content.path("constraints").toString());
        return template;
    }
}
