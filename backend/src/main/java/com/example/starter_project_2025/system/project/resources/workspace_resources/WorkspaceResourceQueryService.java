package com.example.starter_project_2025.system.project.resources.workspace_resources;

import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.resources.TemplateResourceFileStorage;
import com.example.starter_project_2025.system.project.resources.project_resource_files.ProjectResourceFile;
import com.example.starter_project_2025.system.project.resources.project_resource_files.ProjectResourceFileRepository;
import com.example.starter_project_2025.system.project.resources.project_resources.ProjectResource;
import com.example.starter_project_2025.system.project.resources.project_resources.ProjectResourceRepository;
import com.example.starter_project_2025.system.project.workspace.domain.Workspace;
import com.example.starter_project_2025.system.project.workspace.repository.WorkspaceRepository;
import com.example.starter_project_2025.system.project.workspace.service.WorkspaceAccessService;
import com.example.starter_project_2025.system.project.workspace.service.WorkspaceContextService;
import com.example.starter_project_2025.system.rbac.user.User;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Objects;

/**
 * Read-only trainee view of the resources of a workspace project (US-RES-004).
 * <p>
 * Every lookup starts from the workspace and therefore inherits the existing
 * access rule: the caller must be an active member (or mentor) of the
 * workspace team. A trainee of Team A can never read Team B by supplying
 * another {@code workspaceId}; the context resolution rejects it with 403.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class WorkspaceResourceQueryService {

    private static final String PUBLIC_DOWNLOAD_PATH = "/public/workspace-resources/download?token=";

    WorkspaceAccessService access;
    WorkspaceContextService contexts;
    WorkspaceRepository workspaces;
    ProjectResourceRepository resources;
    ProjectResourceFileRepository files;
    TemplateResourceFileStorage storage;
    WorkspaceResourceDownloadTokenService tokens;

    /** Resources of the workspace project, grouped as returned by the backend. */
    public WorkspaceResourceDtos.ResourceCollection list(Long workspaceId) {

        Workspace workspace = requireWorkspace(workspaceId);
        Project project = workspace.getProject();

        if (project == null) {
            return new WorkspaceResourceDtos.ResourceCollection(workspaceId, null,
                    workspace.getTeam().getId(), 0, List.of());
        }

        List<WorkspaceResourceDtos.ResourceItem> items = resources
                .findAllByProjectIdAndIsActiveTrueOrderByOrderIndexAscIdAsc(project.getId())
                .stream()
                .map(this::toItem)
                .toList();

        return new WorkspaceResourceDtos.ResourceCollection(workspaceId, project.getId(),
                workspace.getTeam().getId(), items.size(), items);
    }

    /** Creates a short-lived signed URL after re-checking the team data scope. */
    public WorkspaceResourceDtos.DownloadTicket createTicket(Long workspaceId,
                                                             Long resourceId,
                                                             Long fileId) {

        Workspace workspace = requireWorkspace(workspaceId);
        ProjectResourceFile file = requireWorkspaceFile(workspace, resourceId, fileId);
        WorkspaceResourceDownloadTokenService.IssuedToken issued =
                tokens.issue(workspaceId, resourceId, file.getId());

        return new WorkspaceResourceDtos.DownloadTicket(
                PUBLIC_DOWNLOAD_PATH + issued.token(),
                file.getOriginalName(),
                issued.expiresAt().toString());
    }

    /** Secure stream handler for callers that already have a valid session. */
    public WorkspaceResourceDtos.Download downloadForMember(Long workspaceId,
                                                            Long resourceId,
                                                            Long fileId) {

        Workspace workspace = requireWorkspace(workspaceId);
        return read(requireWorkspaceFile(workspace, resourceId, fileId));
    }

    /**
     * Public stream handler used by the signed URL. The signature replaces the
     * bearer token, but the resource is still re-validated against the
     * workspace/project relation before any bytes are read.
     */
    public WorkspaceResourceDtos.Download downloadWithToken(String token) {

        WorkspaceResourceDownloadTokenService.TokenPayload payload = tokens.verify(token);

        Workspace workspace = workspaces.findById(payload.workspaceId())
                .filter(value -> Boolean.TRUE.equals(value.getIsActive()))
                .orElseThrow(WorkspaceResourceQueryService::forbidden);

        ProjectResourceFile file = requireWorkspaceFile(workspace,
                payload.resourceId(), payload.fileId());

        return read(file);
    }

    private Workspace requireWorkspace(Long workspaceId) {

        User user = access.requireUser(false);
        return contexts.require(user, workspaceId);
    }

    private ProjectResourceFile requireWorkspaceFile(Workspace workspace,
                                                     Long resourceId,
                                                     Long fileId) {

        Project project = workspace.getProject();

        ProjectResource resource = resources.findById(resourceId)
                .filter(value -> Boolean.TRUE.equals(value.getIsActive()))
                .orElseThrow(WorkspaceResourceQueryService::notFound);

        if (project == null || !Objects.equals(resource.getProjectId(), project.getId())) {
            throw notFound();
        }

        return files.findById(fileId)
                .filter(value -> Boolean.TRUE.equals(value.getIsActive()))
                .filter(value -> Objects.equals(value.getResourceId(), resource.getId()))
                .orElseThrow(WorkspaceResourceQueryService::notFound);
    }

    private WorkspaceResourceDtos.ResourceItem toItem(ProjectResource resource) {

        List<WorkspaceResourceDtos.FileItem> attached = files
                .findAllByResourceIdOrderByIdAsc(resource.getId())
                .stream()
                .filter(file -> Boolean.TRUE.equals(file.getIsActive()))
                .map(file -> new WorkspaceResourceDtos.FileItem(file.getId(),
                        file.getOriginalName(), file.getContentType(), file.getSizeBytes()))
                .toList();

        return new WorkspaceResourceDtos.ResourceItem(resource.getId(), resource.getTitle(),
                resource.getDescription(), resource.getKind() == null ? null : resource.getKind().name(),
                resource.getUrl(), resource.getCategory(), resource.getOrderIndex(),
                resource.getUpdatedAt(), attached);
    }

    private WorkspaceResourceDtos.Download read(ProjectResourceFile file) {
        return new WorkspaceResourceDtos.Download(file.getOriginalName(), file.getContentType(),
                storage.read(file.getStorageKey()));
    }

    private static ResponseStatusException notFound() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Resource or file was not found");
    }

    private static ResponseStatusException forbidden() {
        return new ResponseStatusException(HttpStatus.FORBIDDEN,
                "This download link is invalid or has expired");
    }
}
