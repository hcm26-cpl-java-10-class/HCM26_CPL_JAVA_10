package com.example.starter_project_2025.system.project.resources;

import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.workspace.domain.Workspace;
import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateSnapshotRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class ProjectResourceSnapshotService {
    public record File(Long id, String title, String description, String version, String fileName,
                       String contentType, long sizeBytes, String storageKey, String kind, String externalUrl) { }
    public record Group(Long projectId, String projectCode, String projectName, String origin, List<File> resources, Long sourceTemplateId) { }
    private record Source(Project project, String origin) { }

    private final ProjectResourceRepository resources;
    private final TeamSubprojectAssignmentRepository assignments;
    private final WorkspaceResourceSnapshotRepository snapshots;
    private final ObjectMapper json;
    private final ProjectTemplateSnapshotRepository templateSnapshots;

    @Transactional(propagation = Propagation.MANDATORY)
    public void capture(Workspace workspace) {
        if (workspace.getProject() == null || snapshots.findByWorkspaceId(workspace.getId()).isPresent()) return;
        Long tenantId = workspace.getTenant().getId();
        List<Project> assigned = assignments.findAllByTeam_IdAndIsActiveTrueOrderByIdAsc(workspace.getTeam().getId())
                .stream().map(TeamSubprojectAssignment::getProject).toList();
        Map<Long, Source> sources = new LinkedHashMap<>();
        List<Project> children = assigned.isEmpty() ? List.of(workspace.getProject()) : assigned;
        for (Project child : children) {
            requireSource(child, tenantId);
            if (child.getParentProject() != null) {
                Project parent = child.getParentProject();
                requireSource(parent, tenantId);
                if (Objects.equals(parent.getId(), child.getId())) throw invalidSource();
                sources.putIfAbsent(parent.getId(), new Source(parent, "PARENT"));
            }
        }
        for (Project child : children) {
            sources.putIfAbsent(child.getId(), new Source(child,
                    assigned.isEmpty() && child.getParentProject() == null ? "PROJECT" : "SUB_PROJECT"));
        }
        List<ProjectResource> files = resources.findAllByTenantIdAndProject_IdInAndIsActiveTrueOrderByIdAsc(
                tenantId, sources.keySet());
        if (!assigned.isEmpty()) {
            Set<Long> allowedTemplates = new java.util.HashSet<>();
            for (Project child : assigned) {
                if (child.getTemplateSnapshotId() == null) continue;
                templateSnapshots.findById(child.getTemplateSnapshotId()).ifPresent(version -> {
                    if (version.getProjectId() != null && !Objects.equals(version.getProjectId(), child.getId()))
                        throw new org.springframework.security.access.AccessDeniedException("The assigned project snapshot does not match its project");
                    try { collectTemplateIds(json.readTree(version.getContentJson()), allowedTemplates); }
                    catch (JsonProcessingException exception) { throw new IllegalStateException("Invalid assigned module snapshot", exception); }
                });
            }
            files = files.stream().filter(file -> file.getSourceTemplateId() == null
                    || !"SUB_PROJECT".equals(file.getSourceOrigin()) || allowedTemplates.contains(file.getSourceTemplateId())).toList();
        }
        Map<String, List<ProjectResource>> grouped = new LinkedHashMap<>();
        for (ProjectResource file : files) {
            String key = file.getSourceTemplateId() == null ? "project-" + file.getProject().getId() : "template-" + file.getSourceTemplateId();
            grouped.computeIfAbsent(key, ignored -> new java.util.ArrayList<>()).add(file);
        }
        List<Group> groups = grouped.values().stream().map(group -> {
            ProjectResource first = group.getFirst();
            Source source = sources.get(first.getProject().getId());
            boolean inherited = first.getSourceTemplateId() != null;
            return new Group(first.getProject().getId(), inherited ? first.getSourceTemplateCode() : source.project().getCode(),
                    inherited ? first.getSourceTemplateName() : source.project().getName(), inherited ? first.getSourceOrigin() : source.origin(),
                    group.stream().map(file -> new File(file.getId(), file.getTitle(), file.getDescription(), file.getVersion(),
                            file.getFileName(), file.getContentType(), file.getSizeBytes(), file.getStorageKey(),
                            file.getKind(), file.getExternalUrl())).toList(), first.getSourceTemplateId());
        }).toList();
        WorkspaceResourceSnapshot snapshot = new WorkspaceResourceSnapshot();
        snapshot.setWorkspaceId(workspace.getId());
        snapshot.setTeamId(workspace.getTeam().getId());
        snapshot.setProjectId(workspace.getProject().getId());
        snapshot.setTenantId(tenantId);
        try {
            snapshot.setContentJson(json.writeValueAsString(groups));
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Unable to capture project resources", exception);
        }
        snapshots.saveAndFlush(snapshot);
    }

    public List<Group> groups(WorkspaceResourceSnapshot snapshot) {
        try {
            List<Group> result = json.readValue(snapshot.getContentJson(), new TypeReference<List<Group>>() { });
            if (result == null) throw new IllegalStateException("Invalid project resource snapshot");
            return result;
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Unable to read project resource snapshot", exception);
        }
    }

    private void collectTemplateIds(com.fasterxml.jackson.databind.JsonNode content, Set<Long> result) {
        if (content.path("templateId").isNumber()) result.add(content.path("templateId").asLong());
        if (content.path("modules").isArray()) content.path("modules").forEach(child -> collectTemplateIds(child, result));
    }

    private void requireSource(Project project, Long tenantId) {
        if (!Objects.equals(project.getTenantId(), tenantId) || !Boolean.TRUE.equals(project.getIsActive()))
            throw invalidSource();
    }

    private ResponseStatusException invalidSource() {
        return new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                "Assigned resource projects must be active and belong to this tenant");
    }
}
