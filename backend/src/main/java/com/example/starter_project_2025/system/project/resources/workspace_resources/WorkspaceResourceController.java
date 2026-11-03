package com.example.starter_project_2025.system.project.resources.workspace_resources;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;

/**
 * Trainee-facing Resources tab of a workspace (US-RES-004).
 * <p>
 * Routes are workspace-scoped: the project is derived from the workspace and
 * the team membership check happens before any resource is returned.
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/workspaces/{workspaceId}/resources")
@PreAuthorize("hasAnyAuthority('WORKSPACE_READ', 'VIEW_PROJECT_WORKSPACE')")
public class WorkspaceResourceController {

    private final WorkspaceResourceQueryService service;

    @GetMapping
    public WorkspaceResourceDtos.ResourceCollection list(@PathVariable Long workspaceId) {
        return service.list(workspaceId);
    }

    /** Issues the short-lived signed URL used by the browser download. */
    @GetMapping("/{resourceId}/files/{fileId}/download-ticket")
    public WorkspaceResourceDtos.DownloadTicket ticket(@PathVariable Long workspaceId,
                                                       @PathVariable Long resourceId,
                                                       @PathVariable Long fileId) {
        return service.createTicket(workspaceId, resourceId, fileId);
    }

    /** Direct authenticated stream, kept as a fallback for same-origin clients. */
    @GetMapping("/{resourceId}/files/{fileId}/download")
    public ResponseEntity<byte[]> download(@PathVariable Long workspaceId,
                                           @PathVariable Long resourceId,
                                           @PathVariable Long fileId) {
        return stream(service.downloadForMember(workspaceId, resourceId, fileId));
    }

    static ResponseEntity<byte[]> stream(WorkspaceResourceDtos.Download download) {

        ContentDisposition disposition = ContentDisposition.attachment()
                .filename(download.fileName(), StandardCharsets.UTF_8)
                .build();

        MediaType mediaType;
        try {
            mediaType = MediaType.parseMediaType(download.contentType());
        } catch (IllegalArgumentException exception) {
            mediaType = MediaType.APPLICATION_OCTET_STREAM;
        }

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .header("X-Content-Type-Options", "nosniff")
                .contentType(mediaType)
                .body(download.content());
    }
}
