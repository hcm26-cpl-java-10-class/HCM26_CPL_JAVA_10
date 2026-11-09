package com.example.starter_project_2025.system.project.resources.workspace_resources;

import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.resources.TemplateResourceFileStorage;
import com.example.starter_project_2025.system.project.resources.project_resource_files.ProjectResourceFile;
import com.example.starter_project_2025.system.project.resources.project_resource_files.ProjectResourceFileRepository;
import com.example.starter_project_2025.system.project.resources.project_resources.ProjectResource;
import com.example.starter_project_2025.system.project.resources.project_resources.ProjectResourceRepository;
import com.example.starter_project_2025.system.project.workspace.domain.Workspace;
import com.example.starter_project_2025.system.project.workspace.service.WorkspaceAccessService;
import com.example.starter_project_2025.system.project.workspace.service.WorkspaceContextService;
import com.example.starter_project_2025.system.project.workspace.service.WorkspaceProjectScope;
import com.example.starter_project_2025.system.rbac.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class WorkspaceResourceQueryService {
    private record Source(Long templateId, Long resourceId) { }

    private final WorkspaceAccessService access;
    private final WorkspaceContextService contexts;
    private final WorkspaceProjectScope scope;
    private final ProjectResourceRepository resources;
    private final ProjectResourceFileRepository files;
    private final TemplateResourceFileStorage storage;
    private final WorkspaceResourceDownloadTokenService tokens;
    private final WorkspaceResourceEditorPolicy editorPolicy;

    public WorkspaceResourceDtos.ResourceCollection list(Long workspaceId, Long selectedProjectId) {
        User user = access.requireUser(false);
        Workspace workspace = contexts.require(user, workspaceId);
        Map<Long, Project> visible = visibleProjects(workspace);
        Long primaryId = workspace.getProject() == null ? null : workspace.getProject().getId();
        Project target = visible.get(selectedProjectId == null ? primaryId : selectedProjectId);
        if (selectedProjectId != null && target == null) throw outsideScope();

        var seen = new HashSet<Source>();
        List<WorkspaceResourceDtos.ResourceItem> items = visible.isEmpty() ? List.of() :
                resources.findAllByProjectIdInOrderByOrderIndexAscIdAsc(visible.keySet()).stream()
                        .filter(row -> Objects.equals(row.getTenantId(), workspace.getTenant().getId()))
                        .filter(row -> row.getSourceTemplateId() == null || row.getSourceTemplateResourceId() == null
                                || seen.add(new Source(row.getSourceTemplateId(), row.getSourceTemplateResourceId())))
                        .filter(row -> Boolean.TRUE.equals(row.getIsActive()))
                        .map(row -> toItem(user, workspace, visible.get(row.getProjectId()), row)).toList();
        return new WorkspaceResourceDtos.ResourceCollection(workspaceId, primaryId, workspace.getTeam().getId(),
                items.size(), editorPolicy.canManage(user, workspace, target), storage.maxBytes(),
                storage.allowedExtensions(), items);
    }

    public WorkspaceResourceDtos.DownloadTicket createTicket(Long workspaceId, Long resourceId, Long fileId) {
        User user = access.requireUser(false);
        Workspace workspace = contexts.require(user, workspaceId);
        ProjectResourceFile file = requireWorkspaceFile(workspace, resourceId, fileId);
        var ticket = tokens.issue(workspaceId, resourceId, fileId, user.getId());
        String url = "/workspaces/" + workspaceId + "/resources/" + resourceId + "/files/" + fileId
                + "/download?token=" + ticket.token();
        return new WorkspaceResourceDtos.DownloadTicket(url, file.getOriginalName(), ticket.expiresAt().toString());
    }

    public WorkspaceResourceDtos.Download downloadForMember(Long workspaceId, Long resourceId, Long fileId, String token) {
        var payload = tokens.verify(token);
        if (!workspaceId.equals(payload.workspaceId()) || !resourceId.equals(payload.resourceId())
                || !fileId.equals(payload.fileId())) throw outsideScope();
        return download(payload);
    }

    public WorkspaceResourceDtos.Download downloadWithToken(String token) {
        return download(tokens.verify(token));
    }

    private WorkspaceResourceDtos.Download download(WorkspaceResourceDownloadTokenService.TokenPayload payload) {
        User user = access.requireUser(false);
        if (!user.getId().equals(payload.userId())) throw outsideScope();
        Workspace workspace = contexts.require(user, payload.workspaceId());
        ProjectResourceFile file = requireWorkspaceFile(workspace, payload.resourceId(), payload.fileId());
        return new WorkspaceResourceDtos.Download(file.getOriginalName(), file.getContentType(),
                storage.read(file.getStorageKey()));
    }

    private ProjectResourceFile requireWorkspaceFile(Workspace workspace, Long resourceId, Long fileId) {
        ProjectResource resource = resources.findById(resourceId)
                .filter(value -> Boolean.TRUE.equals(value.getIsActive()))
                .orElseThrow(WorkspaceResourceQueryService::notFound);
        if (!Objects.equals(resource.getTenantId(), workspace.getTenant().getId())
                || !visibleProjects(workspace).containsKey(resource.getProjectId())) throw outsideScope();

        return files.findById(fileId)
                .filter(value -> Boolean.TRUE.equals(value.getIsActive()) && resourceId.equals(value.getResourceId()))
                .orElseThrow(WorkspaceResourceQueryService::notFound);
    }

    private Map<Long, Project> visibleProjects(Workspace workspace) {
        return scope.projects(workspace).stream()
                .filter(project -> Objects.equals(project.getTenantId(), workspace.getTenant().getId())
                        && Boolean.TRUE.equals(project.getIsActive()))
                .collect(Collectors.toMap(Project::getId, Function.identity(), (first, duplicate) -> first));
    }

    private WorkspaceResourceDtos.ResourceItem toItem(User user, Workspace workspace, Project project, ProjectResource resource) {
        List<WorkspaceResourceDtos.FileItem> attached = files.findAllByResourceIdOrderByIdAsc(resource.getId()).stream()
                .filter(file -> Boolean.TRUE.equals(file.getIsActive()))
                .map(file -> new WorkspaceResourceDtos.FileItem(file.getId(), file.getOriginalName(),
                        file.getContentType(), file.getSizeBytes())).toList();
        String origin = resource.getSourceOrigin();
        if (origin == null) origin = project.getParentProject() != null ? "SUB_PROJECT" : "PROJECT";
        return new WorkspaceResourceDtos.ResourceItem(resource.getId(), resource.getTitle(),
                resource.getDescription(), resource.getKind() == null ? null : resource.getKind().name(),
                resource.getUrl(), resource.getOrderIndex(),
                resource.getUpdatedAt(), resource.getUpdatedBy(), attached, resource.getSourceTemplateId(),
                resource.getSourceTemplateName() == null ? project.getName() : resource.getSourceTemplateName(),
                origin, project.getId(), editorPolicy.canManage(user, workspace, project));
    }

    private static ResponseStatusException notFound() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Resource or file was not found");
    }

    private static AccessDeniedException outsideScope() {
        return new AccessDeniedException("The resource is outside this workspace");
    }
}
