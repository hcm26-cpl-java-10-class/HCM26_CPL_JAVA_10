package com.example.starter_project_2025.system.project.template;

import com.example.starter_project_2025.system.project.ProjectTemplate;
import com.example.starter_project_2025.system.project.ProjectTemplateRepository;
import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateSnapshot;
import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateSnapshotRepository;
import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateVersionStatus;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TemplateHierarchyService {
    public record Node(Long id, Long parentTemplateId, String code, String name, ProjectTemplateStatus status,
                       Integer templateVersion, Long lockVersion, Long versionId, boolean editable, List<Node> modules) { }

    private final ProjectTemplateRepository templates;
    private final ProjectTemplateSnapshotRepository versions;
    private final ProjectTemplateAccessService access;
    private final ObjectMapper json;

    public Node get(Long id, Long versionId) {
        var user = access.requireUser("READ");
        ProjectTemplate template = templates.findReadableById(id, user.getTenantId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Project template was not found"));
        if (versionId != null) {
            if (!access.can(user, "VERSION_READ")) throw new org.springframework.security.access.AccessDeniedException("Template version permission is required");
            ProjectTemplateSnapshot version = versions.findById(versionId)
                    .filter(value -> id.equals(value.getTemplateId()) && value.getProjectId() == null)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Template version was not found"));
            if (version.getStatus() != ProjectTemplateVersionStatus.DRAFT) {
                ObjectNode content = content(version);
                content.put("templateId", id);
                content.put("versionId", versionId);
                content.put("status", version.getStatus() == ProjectTemplateVersionStatus.ARCHIVED ? "ARCHIVED" : "ACTIVE");
                return historical(content, template.getParentTemplateId());
            }
        }
        return live(template, access.can(user, "UPDATE"), new HashSet<>());
    }

    public ArrayNode captureModules(ProjectTemplate template) {
        ArrayNode result = json.createArrayNode();
        for (ProjectTemplate child : children(template)) {
            ProjectTemplateSnapshot published = published(child);
            ObjectNode node = published == null ? json.createObjectNode() : content(published).deepCopy();
            node.put("templateId", child.getId());
            node.put("parentTemplateId", template.getId());
            node.put("code", child.getCode());
            node.put("name", child.getName());
            node.put("status", child.getStatus().name());
            node.put("templateVersion", child.getTemplateVersion());
            if (published != null) node.put("versionId", published.getId());
            result.add(node);
        }
        return result;
    }

    public void requirePublishedModules(ProjectTemplate template) {
        requirePublishedModules(template, new HashSet<>());
    }

    private void requirePublishedModules(ProjectTemplate template, Set<Long> path) {
        if (!path.add(template.getId())) throw invalidHierarchy();
        for (ProjectTemplate child : children(template)) {
            if (child.getStatus() != ProjectTemplateStatus.ACTIVE || published(child) == null) {
                throw new ProjectTemplateException(422, "Publish the child modules before publishing this template",
                        Map.of("modules", List.of("Module " + child.getCode() + " must have an active published version")));
            }
            requirePublishedModules(child, path);
        }
        path.remove(template.getId());
    }

    public ProjectTemplateSnapshot published(ProjectTemplate template) {
        return versions.findByTemplateIdOrderByCreatedAtDesc(template.getId()).stream()
                .filter(version -> version.getProjectId() == null && Boolean.TRUE.equals(version.getIsActive())
                        && version.getStatus() == ProjectTemplateVersionStatus.PUBLISHED)
                .findFirst().orElse(null);
    }

    private Node live(ProjectTemplate template, boolean canUpdate, Set<Long> path) {
        if (!path.add(template.getId())) throw invalidHierarchy();
        List<Node> modules = children(template).stream().map(child -> live(child, canUpdate, path)).toList();
        path.remove(template.getId());
        ProjectTemplateSnapshot published = published(template);
        return new Node(template.getId(), template.getParentTemplateId(), template.getCode(), template.getName(),
                template.getStatus(), template.getTemplateVersion(), template.getLockVersion(),
                published == null ? null : published.getId(),
                canUpdate && template.getTenantId() != null && template.getStatus() == ProjectTemplateStatus.DRAFT, modules);
    }

    private Node historical(JsonNode content, Long parentId) {
        Long id = content.path("templateId").isNumber() ? content.path("templateId").asLong() : null;
        List<Node> modules = content.path("modules").isArray() ? java.util.stream.StreamSupport
                .stream(content.path("modules").spliterator(), false).map(child -> historical(child, id)).toList() : List.of();
        return new Node(id, parentId, content.path("code").asText(""), content.path("name").asText(""),
                ProjectTemplateStatus.valueOf(content.path("status").asText("ACTIVE")),
                content.path("templateVersion").asInt(1), null,
                content.path("versionId").isNumber() ? content.path("versionId").asLong() : null, false, modules);
    }

    private List<ProjectTemplate> children(ProjectTemplate template) {
        return templates.findAllByParentTemplate_IdAndTenantIdAndIsActiveTrueOrderByCodeAscIdAsc(
                template.getId(), template.getTenantId());
    }

    private ObjectNode content(ProjectTemplateSnapshot version) {
        try {
            if (json.readTree(version.getContentJson()) instanceof ObjectNode value) return value;
        } catch (JsonProcessingException exception) {
            throw invalidHierarchy();
        }
        throw invalidHierarchy();
    }

    private ProjectTemplateException invalidHierarchy() {
        return new ProjectTemplateException(422, "The template hierarchy is invalid", Map.of());
    }
}
