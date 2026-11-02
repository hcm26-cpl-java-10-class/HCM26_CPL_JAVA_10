package com.example.starter_project_2025.system.project.resources;

import com.example.starter_project_2025.system.project.workspace.domain.Workspace;
import com.example.starter_project_2025.system.project.workspace.service.WorkspaceAccessService;
import com.example.starter_project_2025.system.project.workspace.service.WorkspaceContextService;
import com.example.starter_project_2025.system.rbac.user.User;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.FileSystemResource;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class WorkspaceResourceService {
    public record Resource(Long id, String title, String description, String version, String fileName,
                           String contentType, long sizeBytes, String kind, String url) { }
    public record Group(Long projectId, String projectCode, String projectName, String origin, List<Resource> resources, Long sourceTemplateId) { }
    public record Listing(Long workspaceId, Long teamId, Long projectId, LocalDateTime capturedAt, List<Group> groups) { }
    public record DownloadLink(String url, Instant expiresAt) { }
    public record Download(ProjectResourceSnapshotService.File file, FileSystemResource content) { }
    private record Context(User user, Workspace workspace, WorkspaceResourceSnapshot snapshot) { }

    private final WorkspaceAccessService access;
    private final WorkspaceContextService contexts;
    private final WorkspaceResourceSnapshotRepository snapshots;
    private final ProjectResourceSnapshotService snapshotContent;
    private final ProjectResourceStorage storage;
    private final ResourceDownloadSigner signer;

    public Listing list(Long workspaceId) {
        Context context = context(workspaceId);
        Workspace workspace = context.workspace();
        List<Group> groups = context.snapshot() == null ? List.of() : snapshotContent.groups(context.snapshot()).stream()
                .map(group -> new Group(group.projectId(), group.projectCode(), group.projectName(), group.origin(),
                        group.resources().stream().map(file -> new Resource(file.id(), file.title(), file.description(),
                                file.version(), file.fileName(), file.contentType(), file.sizeBytes(),
                                file.kind() == null ? "FILE" : file.kind(), file.externalUrl())).toList(), group.sourceTemplateId()))
                .toList();
        return new Listing(workspaceId, workspace.getTeam().getId(),
                workspace.getProject() == null ? null : workspace.getProject().getId(),
                context.snapshot() == null ? null : context.snapshot().getCreatedAt(), groups);
    }

    public DownloadLink downloadLink(Long workspaceId, Long resourceId) {
        Context context = context(workspaceId);
        ProjectResourceSnapshotService.File file = file(context, resourceId);
        requireFile(file);
        storage.read(file.storageKey());
        long expires = Instant.now().getEpochSecond() + ResourceDownloadSigner.LIFETIME_SECONDS;
        String signature = signer.sign(context.user().getId(), context.workspace().getTenant().getId(),
                workspaceId, resourceId, expires);
        return new DownloadLink("/workspaces/" + workspaceId + "/resources/" + resourceId
                + "/download?expires=" + expires + "&signature=" + signature, Instant.ofEpochSecond(expires));
    }

    public Download download(Long workspaceId, Long resourceId, long expires, String signature) {
        Context context = context(workspaceId);
        ProjectResourceSnapshotService.File file = file(context, resourceId);
        requireFile(file);
        signer.verify(context.user().getId(), context.workspace().getTenant().getId(),
                workspaceId, resourceId, expires, signature);
        return new Download(file, storage.read(file.storageKey()));
    }

    private Context context(Long workspaceId) {
        User user = access.requireUser(false);
        Workspace workspace = contexts.require(user, workspaceId);
        WorkspaceResourceSnapshot snapshot = snapshots.findByWorkspaceId(workspaceId).orElse(null);
        if (snapshot != null && (!Objects.equals(snapshot.getTenantId(), workspace.getTenant().getId())
                || !Objects.equals(snapshot.getTeamId(), workspace.getTeam().getId())
                || workspace.getProject() == null
                || !Objects.equals(snapshot.getProjectId(), workspace.getProject().getId()))) {
            throw new AccessDeniedException("The resource snapshot does not belong to this workspace");
        }
        return new Context(user, workspace, snapshot);
    }

    private void requireFile(ProjectResourceSnapshotService.File file) {
        if ("LINK".equals(file.kind())) throw new org.springframework.web.server.ResponseStatusException(
                org.springframework.http.HttpStatus.UNPROCESSABLE_ENTITY, "Use the external link to open this resource");
    }

    private ProjectResourceSnapshotService.File file(Context context, Long resourceId) {
        if (context.snapshot() != null) {
            return snapshotContent.groups(context.snapshot()).stream().flatMap(group -> group.resources().stream())
                    .filter(file -> Objects.equals(file.id(), resourceId)).findFirst()
                    .orElseThrow(() -> new AccessDeniedException("The resource is outside this workspace"));
        }
        throw new AccessDeniedException("The resource is outside this workspace");
    }
}
